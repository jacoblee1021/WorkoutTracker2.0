import { supabase } from './supabase'

// ─── DB row shapes (mirror schema.sql + supabase/migrations) ───────────────

export interface ExerciseRow {
  id: string
  name: string
  muscle_group: string | null
  exercise_type: string | null
  category: string | null
}

export interface ProgramDayExerciseDetail {
  id: string // program_day_exercises.id
  exercise_number: number
  exercise: ExerciseRow
}

export interface SessionSetLog {
  set_number: number
  reps: number
  weight: number
}

export interface OpenSessionExercise {
  sessionExerciseId: string
  exerciseId: string
  name: string
  group: string
  sets: SessionSetLog[]
}

export interface OpenSession {
  sessionId: string
  programId: string | null
  sessionType: 'scheduled' | 'adhoc'
  dayLabel: string
  createdAt: string
  exercises: OpenSessionExercise[]
}

export interface ProgramSummary {
  id: string
  title: string
  description: string | null
  dayCount: number
  completedDayCount: number
  updatedAt: string | null
}

export interface ProgramDetailDay {
  id: string
  dayNumber: number
  dayTitle: string | null
  focusTags: string[]
  exercises: ProgramDayExerciseDetail[]
}

export interface ProgramDetail {
  id: string
  title: string
  description: string | null
  days: ProgramDetailDay[]
  completedDayCount: number
}

export interface ProgramDay {
  programDayId: string
  dayTitle: string | null
  exercises: ProgramDayExerciseDetail[]
}

// ─── Exercise library ───────────────────────────────────────────────────────

export async function getMuscleGroups(): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('muscle_group')
    .not('muscle_group', 'is', null)
  if (error) throw error
  const groups = Array.from(new Set((data ?? []).map(r => r.muscle_group as string))).sort()
  return ['All', ...groups]
}

export async function getExerciseLibrary(search: string, muscleGroup: string): Promise<ExerciseRow[]> {
  const term = search.trim()

  // Nothing typed and no pill selected: don't pull the whole table.
  if (!term && muscleGroup === 'All') return []

  let query = supabase
    .from('exercises')
    .select('id, name, muscle_group, exercise_type, category')
    .order('name')
    .limit(30)

  if (muscleGroup !== 'All') query = query.eq('muscle_group', muscleGroup)
  // Typeahead matches either the exercise name or its muscle group,
  // so typing "biceps" works the same as tapping the Biceps pill.
  if (term) query = query.or(`name.ilike.%${term}%,muscle_group.ilike.%${term}%`)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ─── Open session (resume where you left off) ───────────────────────────────

export async function getOpenSession(): Promise<OpenSession | null> {
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('id, program_id, program_day_number, created_at')
    .is('finished_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sessionErr) throw sessionErr
  if (!session) return null

  let dayLabel = 'Ad Hoc Session'
  if (session.program_id) {
    const [{ data: program, error: programErr }, { data: day, error: dayErr }] = await Promise.all([
      supabase.from('programs').select('title').eq('id', session.program_id).maybeSingle(),
      supabase
        .from('program_days')
        .select('day_title')
        .eq('program_id', session.program_id)
        .eq('day_number', session.program_day_number)
        .maybeSingle(),
    ])
    if (programErr) throw programErr
    if (dayErr) throw dayErr
    dayLabel = day?.day_title || program?.title || dayLabel
  }

  const { data: sessionExercises, error: exErr } = await supabase
    .from('session_exercises')
    .select(
      'id, exercise_number, exercise:exercises(id, name, muscle_group, exercise_type, category), logged_sets(set_number, reps, weight)'
    )
    .eq('session_id', session.id)
    .order('exercise_number')
  if (exErr) throw exErr

  const exercises: OpenSessionExercise[] = ((sessionExercises ?? []) as unknown as Array<{
    id: string
    exercise: ExerciseRow
    logged_sets: SessionSetLog[]
  }>).map(row => ({
    sessionExerciseId: row.id,
    exerciseId: row.exercise.id,
    name: row.exercise.name,
    group: row.exercise.muscle_group ?? '',
    sets: [...row.logged_sets].sort((a, b) => a.set_number - b.set_number),
  }))

  return {
    sessionId: session.id,
    programId: session.program_id,
    sessionType: session.program_id ? 'scheduled' : 'adhoc',
    dayLabel,
    createdAt: session.created_at,
    exercises,
  }
}

// ─── Programs: browse, author, track progress ───────────────────────────────

export async function getProgramsOverview(): Promise<ProgramSummary[]> {
  const [
    { data: programs, error: programsErr },
    { data: days, error: daysErr },
    { data: progress, error: progressErr },
  ] = await Promise.all([
    supabase.from('programs').select('id, title, description'),
    supabase.from('program_days').select('program_id, day_number'),
    supabase.from('program_progress').select('program_id, completed_day_count, updated_at'),
  ])
  if (programsErr) throw programsErr
  if (daysErr) throw daysErr
  if (progressErr) throw progressErr

  const dayCounts = new Map<string, number>()
  for (const d of days ?? []) {
    dayCounts.set(d.program_id, Math.max(dayCounts.get(d.program_id) ?? 0, d.day_number))
  }
  const progressByProgram = new Map(
    (progress ?? []).map(p => [p.program_id, { completedDayCount: p.completed_day_count, updatedAt: p.updated_at }])
  )

  return (programs ?? []).map(p => ({
    id: p.id,
    title: p.title,
    description: p.description,
    dayCount: dayCounts.get(p.id) ?? 0,
    completedDayCount: progressByProgram.get(p.id)?.completedDayCount ?? 0,
    updatedAt: progressByProgram.get(p.id)?.updatedAt ?? null,
  }))
}

export async function getProgramDetail(programId: string): Promise<ProgramDetail | null> {
  const [
    { data: program, error: programErr },
    { data: days, error: daysErr },
    { data: progress, error: progressErr },
  ] = await Promise.all([
    supabase.from('programs').select('id, title, description').eq('id', programId).maybeSingle(),
    supabase
      .from('program_days')
      .select(
        'id, day_number, day_title, program_day_exercises(id, exercise_number, exercise:exercises(id, name, muscle_group, exercise_type, category))'
      )
      .eq('program_id', programId)
      .order('day_number')
      .order('exercise_number', { referencedTable: 'program_day_exercises' }),
    supabase.from('program_progress').select('completed_day_count').eq('program_id', programId).maybeSingle(),
  ])
  if (programErr) throw programErr
  if (!program) return null
  if (daysErr) throw daysErr
  if (progressErr) throw progressErr

  const detailDays: ProgramDetailDay[] = ((days ?? []) as unknown as Array<{
    id: string
    day_number: number
    day_title: string | null
    program_day_exercises: ProgramDayExerciseDetail[]
  }>).map(d => ({
    id: d.id,
    dayNumber: d.day_number,
    dayTitle: d.day_title,
    focusTags: Array.from(new Set(d.program_day_exercises.map(e => e.exercise.muscle_group).filter(Boolean) as string[])),
    exercises: d.program_day_exercises,
  }))

  return {
    id: program.id,
    title: program.title,
    description: program.description,
    days: detailDays,
    completedDayCount: progress?.completed_day_count ?? 0,
  }
}

export async function getProgramDay(programId: string, dayNumber: number): Promise<ProgramDay | null> {
  const { data: day, error: dayErr } = await supabase
    .from('program_days')
    .select(
      'id, day_title, program_day_exercises(id, exercise_number, exercise:exercises(id, name, muscle_group, exercise_type, category))'
    )
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
    .order('exercise_number', { referencedTable: 'program_day_exercises' })
    .maybeSingle()
  if (dayErr) throw dayErr
  if (!day) return null

  return {
    programDayId: day.id,
    dayTitle: day.day_title,
    exercises: (day.program_day_exercises ?? []) as unknown as ProgramDayExerciseDetail[],
  }
}

export async function createProgram(input: {
  title: string
  description?: string
  days: { label: string; exerciseIds: string[] }[]
}): Promise<string> {
  const { data: program, error: programErr } = await supabase
    .from('programs')
    .insert({ title: input.title, description: input.description || null })
    .select('id')
    .single()
  if (programErr) throw programErr

  for (let i = 0; i < input.days.length; i++) {
    const day = input.days[i]
    const { data: dayRow, error: dayErr } = await supabase
      .from('program_days')
      .insert({ program_id: program.id, day_number: i + 1, day_title: day.label || null })
      .select('id')
      .single()
    if (dayErr) throw dayErr

    for (let j = 0; j < day.exerciseIds.length; j++) {
      const { error: exErr } = await supabase
        .from('program_day_exercises')
        .insert({ program_day_id: dayRow.id, exercise_number: j + 1, exercise_id: day.exerciseIds[j] })
      if (exErr) throw exErr
    }
  }

  return program.id
}

export async function resetProgramProgress(programId: string): Promise<void> {
  const { error } = await supabase
    .from('program_progress')
    .update({ completed_day_count: 0, updated_at: new Date().toISOString() })
    .eq('program_id', programId)
  if (error) throw error
}

// ─── Sessions / logging ─────────────────────────────────────────────────────

export async function discardAllOpenSessions(): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ finished_at: new Date().toISOString() })
    .is('finished_at', null)
  if (error) throw error
}

export async function createSession(opts: {
  programId?: string
  programWeekNumber?: number
  programDayNumber?: number
}): Promise<string> {
  // The app only ever works one session at a time — starting a new one
  // always closes out anything left open, so open sessions can't pile up.
  await discardAllOpenSessions()

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      exercise_date: new Date().toISOString().slice(0, 10),
      program_id: opts.programId ?? null,
      program_week_number: opts.programWeekNumber ?? null,
      program_day_number: opts.programDayNumber ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function addSessionExercise(
  sessionId: string,
  exerciseId: string,
  exerciseNumber: number
): Promise<string> {
  const { data, error } = await supabase
    .from('session_exercises')
    .insert({ session_id: sessionId, exercise_id: exerciseId, exercise_number: exerciseNumber })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function addLoggedSet(
  sessionExerciseId: string,
  setNumber: number,
  reps: number,
  weight: number
): Promise<void> {
  const { error } = await supabase
    .from('logged_sets')
    .insert({ session_exercise_id: sessionExerciseId, set_number: setNumber, reps, weight })
  if (error) throw error
}

export async function discardSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function finishSession(
  sessionId: string,
  durationSeconds: number,
  programId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ time_total: `${durationSeconds} seconds`, finished_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error

  if (!programId) return

  const { data: existing, error: selErr } = await supabase
    .from('program_progress')
    .select('id, completed_day_count')
    .eq('program_id', programId)
    .maybeSingle()
  if (selErr) throw selErr

  if (existing) {
    const { error: updErr } = await supabase
      .from('program_progress')
      .update({ completed_day_count: existing.completed_day_count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (updErr) throw updErr
  } else {
    const { error: insErr } = await supabase
      .from('program_progress')
      .insert({ program_id: programId, completed_day_count: 1 })
    if (insErr) throw insErr
  }
}

// ─── Home screen stats ──────────────────────────────────────────────────────

export async function getSessionCounts(): Promise<{ thisWeek: number; thisMonth: number }> {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const startOfWeekStr = startOfWeek.toISOString().slice(0, 10)
  const startOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const [{ count: thisWeek, error: weekErr }, { count: thisMonth, error: monthErr }] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('exercise_date', startOfWeekStr),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('exercise_date', startOfMonthStr),
  ])
  if (weekErr) throw weekErr
  if (monthErr) throw monthErr
  return { thisWeek: thisWeek ?? 0, thisMonth: thisMonth ?? 0 }
}
