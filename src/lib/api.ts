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

export interface DateRange {
  /** Inclusive ISO date, or null for no lower bound ("all time"). */
  start: string | null
  /** Inclusive ISO date. */
  end: string
}

export interface RangeStats {
  sessions: number
  prsSet: number
  totalMinutes: number
}

export interface MuscleFocusEntry {
  muscleGroup: string
  pct: number
  setCount: number
  underFocused: boolean
}

export interface StrengthTrendPoint {
  bucketStart: string
  maxWeight: number | null
}

export type StrengthTrendBucketUnit = 'day' | 'week' | 'month'

export interface StrengthTrend {
  exerciseName: string
  bucketUnit: StrengthTrendBucketUnit
  points: StrengthTrendPoint[]
  deltaPct: number | null
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

// ─── Home dashboard: stats, muscle focus, strength trend ───────────────────

export async function getStatsForRange(range: DateRange): Promise<RangeStats> {
  let sessQuery = supabase
    .from('sessions')
    .select('id, time_total')
    .not('finished_at', 'is', null)
    .lte('exercise_date', range.end)
  if (range.start) sessQuery = sessQuery.gte('exercise_date', range.start)
  const { data: rangeSessions, error: sessErr } = await sessQuery
  if (sessErr) throw sessErr

  const sessions = rangeSessions?.length ?? 0
  const totalSeconds = (rangeSessions ?? []).reduce((sum, s) => {
    const match = /^(\d+)/.exec(String(s.time_total ?? ''))
    return sum + (match ? parseInt(match[1], 10) : 0)
  }, 0)
  const totalMinutes = Math.round(totalSeconds / 60)

  // Volume-based PRs: an exercise counts if its total volume in a session
  // within the range beats the best volume it ever hit in a session before
  // the range started.
  const { data: rows, error: volErr } = await supabase
    .from('session_exercises')
    .select('exercise_id, logged_sets(reps, weight), session:sessions(exercise_date)')
  if (volErr) throw volErr

  const bestPrior = new Map<string, number>()
  const bestInRange = new Map<string, number>()
  for (const row of (rows ?? []) as unknown as Array<{
    exercise_id: string
    logged_sets: { reps: number; weight: number }[]
    session: { exercise_date: string } | null
  }>) {
    const date = row.session?.exercise_date
    if (!date) continue
    const volume = row.logged_sets.reduce((s, set) => s + set.reps * set.weight, 0)
    if (volume <= 0) continue
    const inRange = date <= range.end && (!range.start || date >= range.start)
    const target = inRange ? bestInRange : bestPrior
    target.set(row.exercise_id, Math.max(target.get(row.exercise_id) ?? 0, volume))
  }

  let prsSet = 0
  for (const [exerciseId, volume] of bestInRange) {
    if (volume > (bestPrior.get(exerciseId) ?? 0)) prsSet++
  }

  return { sessions, prsSet, totalMinutes }
}

export async function getMuscleFocus(range: DateRange): Promise<MuscleFocusEntry[]> {
  let sessQuery = supabase.from('sessions').select('id').lte('exercise_date', range.end)
  if (range.start) sessQuery = sessQuery.gte('exercise_date', range.start)
  const { data: sessions, error: sessErr } = await sessQuery
  if (sessErr) throw sessErr
  const sessionIds = (sessions ?? []).map(s => s.id)
  if (sessionIds.length === 0) return []

  const { data: rows, error } = await supabase
    .from('session_exercises')
    .select('exercise:exercises(muscle_group), logged_sets(id)')
    .in('session_id', sessionIds)
  if (error) throw error

  const counts = new Map<string, number>()
  let total = 0
  for (const row of (rows ?? []) as unknown as Array<{
    exercise: { muscle_group: string | null }
    logged_sets: { id: string }[]
  }>) {
    const group = row.exercise?.muscle_group
    const setCount = row.logged_sets.length
    if (!group || setCount === 0) continue
    counts.set(group, (counts.get(group) ?? 0) + setCount)
    total += setCount
  }
  if (total === 0) return []

  const evenShare = 100 / counts.size
  const entries: MuscleFocusEntry[] = Array.from(counts.entries()).map(([muscleGroup, setCount]) => {
    const pct = (setCount / total) * 100
    return { muscleGroup, pct: Math.round(pct), setCount, underFocused: pct < evenShare / 2 }
  })
  entries.sort((a, b) => b.pct - a.pct)
  return entries
}

export async function getTrainedMuscleGroups(): Promise<string[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('exercise:exercises(muscle_group), logged_sets(id)')
  if (error) throw error

  const groups = new Set<string>()
  for (const row of (data ?? []) as unknown as Array<{
    exercise: { muscle_group: string | null }
    logged_sets: { id: string }[]
  }>) {
    if (row.exercise?.muscle_group && row.logged_sets.length > 0) groups.add(row.exercise.muscle_group)
  }
  return Array.from(groups).sort()
}

// Daily buckets for short ranges (readable as a line without being noisy),
// weekly for medium ranges, monthly once a range spans over a year —
// otherwise "All Time" over several years would produce hundreds of points.
function chooseBucketUnit(startMs: number, endMs: number): StrengthTrendBucketUnit {
  const days = (endMs - startMs) / 86400000
  if (days <= 31) return 'day'
  if (days <= 366) return 'week'
  return 'month'
}

function buildBucketStarts(start: Date, end: Date, unit: StrengthTrendBucketUnit): string[] {
  const starts: string[] = []
  if (unit === 'day') {
    const d = new Date(start)
    while (d <= end) {
      starts.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
  } else if (unit === 'week') {
    const d = new Date(start)
    while (d <= end) {
      starts.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 7)
    }
  } else {
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= end) {
      starts.push(d.toISOString().slice(0, 10))
      d.setMonth(d.getMonth() + 1)
    }
  }
  return starts
}

export async function getStrengthTrend(muscleGroup: string, range: DateRange): Promise<StrengthTrend | null> {
  // Find the most-logged exercise within this muscle group (all-time, so the
  // chosen exercise stays consistent as the timeframe is switched).
  const { data: candidates, error: candErr } = await supabase
    .from('session_exercises')
    .select('exercise_id, exercise:exercises!inner(name, muscle_group), logged_sets(id)')
    .eq('exercise.muscle_group', muscleGroup)
  if (candErr) throw candErr

  const setCounts = new Map<string, { name: string; count: number }>()
  for (const row of (candidates ?? []) as unknown as Array<{
    exercise_id: string
    exercise: { name: string }
    logged_sets: { id: string }[]
  }>) {
    const entry = setCounts.get(row.exercise_id) ?? { name: row.exercise.name, count: 0 }
    entry.count += row.logged_sets.length
    setCounts.set(row.exercise_id, entry)
  }

  let topExerciseId: string | null = null
  let topEntry: { name: string; count: number } | null = null
  for (const [id, entry] of setCounts) {
    if (!topEntry || entry.count > topEntry.count) {
      topExerciseId = id
      topEntry = entry
    }
  }
  if (!topExerciseId || !topEntry || topEntry.count === 0) return null

  let startStr = range.start
  if (!startStr) {
    const { data: earliest, error: earliestErr } = await supabase
      .from('session_exercises')
      .select('session:sessions!inner(exercise_date)')
      .eq('exercise_id', topExerciseId)
      .order('exercise_date', { referencedTable: 'sessions', ascending: true })
      .limit(1)
      .maybeSingle()
    if (earliestErr) throw earliestErr
    const earliestRow = earliest as unknown as { session: { exercise_date: string } } | null
    startStr = earliestRow?.session?.exercise_date ?? range.end
  }

  const startDate = new Date(startStr + 'T00:00:00')
  const endDate = new Date(range.end + 'T00:00:00')
  const unit = chooseBucketUnit(startDate.getTime(), endDate.getTime())
  const bucketStarts = buildBucketStarts(startDate, endDate, unit)
  if (bucketStarts.length === 0) bucketStarts.push(startStr)

  const { data: sets, error: setsErr } = await supabase
    .from('session_exercises')
    .select('logged_sets(weight), session:sessions!inner(exercise_date)')
    .eq('exercise_id', topExerciseId)
    .gte('session.exercise_date', bucketStarts[0])
    .lte('session.exercise_date', range.end)
  if (setsErr) throw setsErr

  const maxByBucket = new Map<string, number>()
  for (const row of (sets ?? []) as unknown as Array<{
    logged_sets: { weight: number }[]
    session: { exercise_date: string } | null
  }>) {
    const date = row.session?.exercise_date
    if (!date || row.logged_sets.length === 0) continue
    let bucket = bucketStarts[0]
    for (const b of bucketStarts) {
      if (b <= date) bucket = b
      else break
    }
    const maxWeightInRow = Math.max(...row.logged_sets.map(s => s.weight))
    if (maxWeightInRow <= 0) continue
    maxByBucket.set(bucket, Math.max(maxByBucket.get(bucket) ?? 0, maxWeightInRow))
  }

  const points: StrengthTrendPoint[] = bucketStarts.map(b => ({
    bucketStart: b,
    maxWeight: maxByBucket.get(b) ?? null,
  }))

  const withData = points.filter(p => p.maxWeight !== null)
  const deltaPct =
    withData.length >= 2
      ? Math.round(
          ((withData[withData.length - 1].maxWeight! - withData[0].maxWeight!) / withData[0].maxWeight!) * 100
        )
      : null

  return { exerciseName: topEntry.name, bucketUnit: unit, points, deltaPct }
}
