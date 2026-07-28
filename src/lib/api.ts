import { supabase } from './supabase'

// ─── DB row shapes (mirror schema.sql) ─────────────────────────────────────

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

export interface DueToday {
  programId: string
  programTitle: string
  programDayId: string
  dayNumber: number
  dayTitle: string | null
  exercises: ProgramDayExerciseDetail[]
  lastDoneDate: string | null
}

export interface LastExerciseStats {
  lastDate: string
  setCount: number
  avgReps: number | null
  avgWeight: number | null
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
  let query = supabase.from('exercises').select('id, name, muscle_group, exercise_type, category').order('name')
  if (muscleGroup !== 'All') query = query.eq('muscle_group', muscleGroup)
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ─── "Due today" — next unfinished day in the active program ───────────────

export async function getDueToday(): Promise<DueToday | null> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: program, error: programErr } = await supabase
    .from('programs')
    .select('id, title')
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (programErr) throw programErr
  if (!program) return null

  const { data: days, error: daysErr } = await supabase
    .from('program_days')
    .select('id, day_number, day_title')
    .eq('program_id', program.id)
    .order('day_number')
  if (daysErr) throw daysErr
  if (!days || days.length === 0) return null

  const { data: lastSession, error: lastErr } = await supabase
    .from('sessions')
    .select('program_day_number, exercise_date')
    .eq('program_id', program.id)
    .order('exercise_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastErr) throw lastErr

  const maxDay = days.length
  const nextDayNumber = lastSession ? (lastSession.program_day_number % maxDay) + 1 : 1
  const nextDay = days.find(d => d.day_number === nextDayNumber) ?? days[0]

  const { data: dayExercises, error: dayExErr } = await supabase
    .from('program_day_exercises')
    .select('id, exercise_number, exercise:exercises(id, name, muscle_group, exercise_type, category)')
    .eq('program_day_id', nextDay.id)
    .order('exercise_number')
  if (dayExErr) throw dayExErr

  return {
    programId: program.id,
    programTitle: program.title,
    programDayId: nextDay.id,
    dayNumber: nextDay.day_number,
    dayTitle: nextDay.day_title,
    exercises: (dayExercises ?? []) as unknown as ProgramDayExerciseDetail[],
    lastDoneDate: lastSession?.exercise_date ?? null,
  }
}

// ─── Sessions / logging ─────────────────────────────────────────────────────

export async function createSession(opts: {
  programId?: string
  programWeekNumber?: number
  programDayNumber?: number
}): Promise<string> {
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

export async function finishSession(sessionId: string, durationSeconds: number): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ time_total: `${durationSeconds} seconds` })
    .eq('id', sessionId)
  if (error) throw error
}

// ─── Last-time stats for the insight banner (used once we add it back) ─────

export async function getLastExerciseStats(
  exerciseId: string,
  currentSessionId: string
): Promise<LastExerciseStats | null> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('id, session:sessions(id, exercise_date), stats:session_exercise_stats(set_total, avg_reps, avg_weight)')
    .eq('exercise_id', exerciseId)
    .neq('session_id', currentSessionId)
    .order('session(exercise_date)', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const session = data.session as unknown as { exercise_date: string }
  const stats = data.stats as unknown as { set_total: number; avg_reps: number | null; avg_weight: number | null }
  return {
    lastDate: session.exercise_date,
    setCount: stats?.set_total ?? 0,
    avgReps: stats?.avg_reps ?? null,
    avgWeight: stats?.avg_weight ?? null,
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
