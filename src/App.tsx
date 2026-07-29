import { useState, useEffect, useCallback } from 'react'
import * as api from './lib/api'
import type { ExerciseRow as ExerciseDef, OpenSession, ProgramDetail, ProgramSummary } from './lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'home' | 'overview' | 'active' | 'complete' | 'library'
  | 'programs' | 'program-detail' | 'day-detail' | 'create-program'

interface SetLog { reps: number; weight: number }

interface ExerciseEntry {
  id: string
  sessionExerciseId: string
  name: string
  group: string
  sets: SetLog[]
}

type HomeCard =
  | { kind: 'loading' }
  | { kind: 'session'; open: OpenSession }
  | {
      kind: 'program'
      programId: string
      title: string
      dayLabel: string
      dayNumber: number
      completedDayCount: number
      dayCount: number
    }
  | { kind: 'none' }

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtWeight(w: number) {
  return w % 1 === 0 ? String(w) : w.toFixed(1)
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ground text-ink font-body flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  )
}

function Stepper({
  label, display, onDec, onInc,
}: {
  label: string
  display: string
  onDec: () => void
  onInc: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-[0.18em] text-muted font-display w-12">{label}</span>
      <div className="flex items-center gap-4">
        <button
          onClick={onDec}
          className="w-10 h-10 border border-border rounded-sm text-muted hover:border-ink hover:text-ink transition-colors font-display text-lg flex items-center justify-center select-none"
        >
          −
        </button>
        <span className="text-4xl font-display font-700 text-ink tabular-nums w-20 text-center">{display}</span>
        <button
          onClick={onInc}
          className="w-10 h-10 border border-border rounded-sm text-muted hover:border-ink hover:text-ink transition-colors font-display text-lg flex items-center justify-center select-none"
        >
          +
        </button>
      </div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span className="text-xs px-2.5 py-1 bg-surface2 text-muted rounded-sm font-display tracking-wide">
      {label}
    </span>
  )
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

function HomeScreen({
  homeCard, sessionCounts, starting,
  onResumeSession, onContinueProgram, onAdhoc, onBrowsePrograms,
}: {
  homeCard: HomeCard
  sessionCounts: { thisWeek: number; thisMonth: number } | null
  starting: boolean
  onResumeSession: () => void
  onContinueProgram: () => void
  onAdhoc: () => void
  onBrowsePrograms: () => void
}) {
  return (
    <Shell>
      <header className="px-6 pt-12 pb-8 flex justify-between items-start">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-muted font-display">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <h1 className="text-4xl font-display font-700 text-ink mt-1 tracking-tight">LIFT</h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center mt-1">
          <span className="text-xs font-display text-muted tracking-wide">JS</span>
        </div>
      </header>

      <div className="px-6 flex-1 space-y-6">
        <section>
          <p className="text-xs tracking-[0.2em] uppercase text-muted mb-3 font-display">
            {homeCard.kind === 'session' ? 'Continue Session' : 'Continue'}
          </p>
          {homeCard.kind === 'loading' ? (
            <div className="w-full bg-surface border border-border rounded-sm p-5">
              <p className="text-xs text-muted">Loading your progress...</p>
            </div>
          ) : homeCard.kind === 'session' ? (
            <button
              onClick={onResumeSession}
              disabled={starting}
              className="w-full bg-surface border border-lime/25 rounded-sm p-5 text-left hover:border-lime/40 transition-colors group disabled:opacity-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-display font-600 text-ink">{homeCard.open.dayLabel}</h2>
                  <p className="text-xs text-muted mt-1">
                    {homeCard.open.exercises.length} exercises · session in progress
                  </p>
                </div>
                <span className="text-lime text-xl leading-none mt-0.5 inline-block group-hover:translate-x-0.5 transition-transform">
                  {starting ? '···' : '→'}
                </span>
              </div>
            </button>
          ) : homeCard.kind === 'program' ? (
            <button
              onClick={onContinueProgram}
              disabled={starting}
              className="w-full bg-surface border border-border rounded-sm p-5 text-left hover:border-lime/30 transition-colors group disabled:opacity-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted font-display uppercase tracking-[0.15em]">
                    {homeCard.title}
                  </p>
                  <h2 className="text-lg font-display font-600 text-ink mt-1">{homeCard.dayLabel}</h2>
                  <p className="text-xs text-muted mt-1">
                    {homeCard.completedDayCount}/{homeCard.dayCount} days done
                  </p>
                </div>
                <span className="text-lime text-xl leading-none mt-0.5 inline-block group-hover:translate-x-0.5 transition-transform">
                  {starting ? '···' : '→'}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={onBrowsePrograms}
              className="w-full bg-surface border border-border rounded-sm p-5 text-left hover:border-lime/30 transition-colors group flex justify-between items-center"
            >
              <div>
                <h2 className="text-base font-display font-600 text-ink">Start a Program</h2>
                <p className="text-xs text-muted mt-1">Follow a structured routine and track progress</p>
              </div>
              <span className="text-lime text-xl opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
          )}
          {homeCard.kind !== 'loading' && (
            <button
              onClick={onBrowsePrograms}
              className="mt-3 text-xs text-muted hover:text-ink transition-colors font-display uppercase tracking-wider"
            >
              Browse all programs →
            </button>
          )}
        </section>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted uppercase tracking-[0.2em] font-display">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <section>
          <button
            onClick={onAdhoc}
            disabled={starting}
            className="w-full border border-border rounded-sm p-5 text-left hover:border-lime/30 transition-colors group flex justify-between items-center disabled:opacity-50"
          >
            <div>
              <h2 className="text-base font-display font-500 text-ink">Start Empty Session</h2>
              <p className="text-xs text-muted mt-1">Build your set from the exercise library</p>
            </div>
            <span className="text-lime text-xl opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </button>
        </section>
      </div>

      <footer className="px-6 pb-10 mt-8">
        <p className="text-xs text-muted text-center font-display tracking-wide">
          {sessionCounts
            ? `${sessionCounts.thisWeek} sessions this week · ${sessionCounts.thisMonth} this month`
            : ' '}
        </p>
      </footer>
    </Shell>
  )
}

// ─── Programs list ────────────────────────────────────────────────────────────

function ProgramsScreen({
  programs, loading, onBack, onSelectProgram, onCreateProgram,
}: {
  programs: ProgramSummary[]
  loading: boolean
  onBack: () => void
  onSelectProgram: (id: string) => void
  onCreateProgram: () => void
}) {
  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
        <button onClick={onBack} className="text-muted hover:text-ink transition-colors text-sm min-w-[3rem]">
          ← Back
        </button>
        <h1 className="text-xs font-display font-600 uppercase tracking-[0.2em] text-ink">Programs</h1>
        <span className="min-w-[3rem]" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 scrollbar-hide">
        <button
          onClick={onCreateProgram}
          className="w-full border border-dashed border-border rounded-sm py-4 text-muted text-xs font-display uppercase tracking-[0.2em] hover:border-lime/30 hover:text-lime transition-colors"
        >
          + Create Program
        </button>

        {loading && <p className="text-center text-muted text-sm py-12">Loading...</p>}
        {!loading && programs.length === 0 && (
          <p className="text-center text-muted text-sm py-12">No programs yet. Create your first one above.</p>
        )}
        {!loading && programs.map(p => {
          const isActive = p.completedDayCount > 0 && p.completedDayCount < p.dayCount
          const isDone = p.completedDayCount > 0 && p.completedDayCount >= p.dayCount
          return (
            <button
              key={p.id}
              onClick={() => onSelectProgram(p.id)}
              className={`w-full rounded-sm p-5 text-left transition-colors group ${
                isActive
                  ? 'bg-surface border border-lime/25 hover:border-lime/40'
                  : 'bg-surface border border-border hover:border-lime/30'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-3">
                  {isActive && (
                    <p className="text-xs text-lime font-display uppercase tracking-widest mb-1.5">
                      In Progress · Day {p.completedDayCount + 1} of {p.dayCount}
                    </p>
                  )}
                  {isDone && (
                    <p className="text-xs text-muted font-display uppercase tracking-widest mb-1.5">
                      Complete
                    </p>
                  )}
                  <h2 className="text-base font-display font-600 text-ink">{p.title}</h2>
                  {p.description && (
                    <p className="text-xs text-muted mt-1 leading-relaxed">{p.description}</p>
                  )}
                </div>
                <span className="text-muted group-hover:text-lime transition-colors shrink-0 text-xl mt-0.5">→</span>
              </div>
              <p className="text-xs text-muted font-display mt-3">{p.dayCount} days</p>
            </button>
          )
        })}
      </div>
    </Shell>
  )
}

// ─── Program Detail ───────────────────────────────────────────────────────────

function ProgramDetailScreen({
  detail, loading, onBack, onOpenDay, onRestart,
}: {
  detail: ProgramDetail | null
  loading: boolean
  onBack: () => void
  onOpenDay: (dayNumber: number) => void
  onRestart: () => void
}) {
  if (loading || !detail) {
    return (
      <Shell>
        <header className="px-6 pt-10 pb-5 flex items-center gap-4 border-b border-border">
          <button onClick={onBack} className="text-muted hover:text-ink transition-colors text-sm">
            ← Programs
          </button>
        </header>
        <p className="text-center text-muted text-sm py-16">Loading...</p>
      </Shell>
    )
  }

  const dayCount = detail.days.length
  const completedCount = detail.completedDayCount
  const isStarted = completedCount > 0
  const isDone = isStarted && completedCount >= dayCount
  const nextDayNumber = isDone ? null : (completedCount % dayCount) + 1

  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex items-center gap-4 border-b border-border">
        <button onClick={onBack} className="text-muted hover:text-ink transition-colors text-sm shrink-0">
          ← Programs
        </button>
      </header>

      <div className="px-6 pt-7 pb-6 border-b border-border">
        <h1 className="text-2xl font-display font-700 text-ink leading-tight">{detail.title}</h1>
        {detail.description && (
          <p className="text-sm text-muted mt-2 leading-relaxed">{detail.description}</p>
        )}

        <div className="mt-5 flex items-center gap-4">
          <div className="text-center">
            <p className="text-xl font-display font-700 text-ink tabular-nums">{dayCount}</p>
            <p className="text-xs text-muted font-display uppercase tracking-widest mt-0.5">Days</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex-1" />
          {!isStarted ? (
            <button
              onClick={() => onOpenDay(1)}
              disabled={dayCount === 0}
              className="shrink-0 px-4 py-2 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.15em] rounded-sm hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              Start
            </button>
          ) : isDone ? (
            <button
              onClick={onRestart}
              className="shrink-0 px-4 py-2 border border-border text-muted text-xs font-display uppercase tracking-[0.15em] rounded-sm hover:border-ink hover:text-ink transition-colors"
            >
              Restart
            </button>
          ) : (
            <button
              onClick={() => onOpenDay(nextDayNumber!)}
              className="shrink-0 px-4 py-2 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.15em] rounded-sm hover:opacity-90 transition-opacity"
            >
              Resume
            </button>
          )}
        </div>

        {isStarted && (
          <div className="mt-5">
            <div className="flex items-center gap-2 flex-wrap">
              {detail.days.map(d => (
                <div
                  key={d.id}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    d.dayNumber <= completedCount
                      ? 'bg-lime'
                      : d.dayNumber === nextDayNumber
                      ? 'bg-transparent border-2 border-lime'
                      : 'bg-surface2 border border-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted font-display mt-2">
              {isDone ? `All ${dayCount} days complete` : `Day ${completedCount + 1} of ${dayCount}`}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2 scrollbar-hide">
        <p className="text-xs tracking-[0.2em] uppercase text-muted font-display mb-3">Schedule</p>
        {detail.days.map(day => {
          const isCompleted = isStarted && day.dayNumber <= completedCount
          const isNext = isStarted && day.dayNumber === nextDayNumber

          return (
            <button
              key={day.id}
              onClick={() => onOpenDay(day.dayNumber)}
              className={`w-full rounded-sm p-4 text-left group flex gap-4 items-start transition-colors ${
                isNext
                  ? 'bg-surface border border-lime/25 hover:border-lime/40'
                  : isCompleted
                  ? 'bg-surface border border-border opacity-60 hover:opacity-80'
                  : 'bg-surface border border-border hover:border-lime/20'
              }`}
            >
              <div className="shrink-0 mt-0.5 w-5 flex justify-center">
                {isCompleted ? (
                  <span className="text-lime text-xs font-display">✓</span>
                ) : isNext ? (
                  <span className="text-lime text-sm">→</span>
                ) : (
                  <span className="text-muted text-xs font-display tabular-nums">{day.dayNumber}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted font-display uppercase tracking-wider">
                        Day {day.dayNumber}
                      </p>
                      {isNext && (
                        <span className="text-[10px] font-display uppercase tracking-widest text-lime bg-lime/10 px-1.5 py-0.5 rounded-sm">
                          Next
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-display font-600 text-ink mt-0.5">
                      {day.dayTitle || `Day ${day.dayNumber}`}
                    </p>
                  </div>
                  <span className="text-muted group-hover:text-lime transition-colors ml-2 text-lg shrink-0">→</span>
                </div>
                {day.focusTags.length > 0 && (
                  <div className="mt-2.5 flex gap-2 flex-wrap">
                    {day.focusTags.map(t => <Tag key={t} label={t} />)}
                  </div>
                )}
                <p className="text-xs text-muted mt-2 font-display">{day.exercises.length} exercises</p>
              </div>
            </button>
          )
        })}
      </div>

      {isStarted && !isDone && (
        <div className="px-6 pb-8 pt-4 border-t border-border">
          <button
            onClick={onRestart}
            className="w-full py-3 border border-border text-muted text-xs font-display font-500 uppercase tracking-[0.18em] hover:border-ink hover:text-ink transition-colors rounded-sm"
          >
            Start from Beginning
          </button>
        </div>
      )}
    </Shell>
  )
}

// ─── Day Detail ───────────────────────────────────────────────────────────────

function DayDetailScreen({
  detail, dayNumber, onBack, onStartWorkout, starting,
}: {
  detail: ProgramDetail
  dayNumber: number
  onBack: () => void
  onStartWorkout: () => void
  starting: boolean
}) {
  const day = detail.days.find(d => d.dayNumber === dayNumber)
  if (!day) return null

  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
        <button onClick={onBack} className="text-muted hover:text-ink transition-colors text-sm min-w-[4rem]">
          ← Back
        </button>
        <span className="text-xs font-display uppercase tracking-[0.2em] text-muted">{detail.title}</span>
        <span className="min-w-[4rem] text-right text-xs text-muted font-display">
          {day.dayNumber}/{detail.days.length}
        </span>
      </header>

      <div className="px-6 pt-8 pb-6 border-b border-border">
        <p className="text-xs text-muted font-display uppercase tracking-[0.2em] mb-2">Day {day.dayNumber}</p>
        <h2 className="text-3xl font-display font-700 text-ink leading-tight">
          {day.dayTitle || `Day ${day.dayNumber}`}
        </h2>
        {day.focusTags.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {day.focusTags.map(t => <Tag key={t} label={t} />)}
          </div>
        )}
        <p className="text-xs text-muted mt-3 font-display">{day.exercises.length} exercises</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-hide">
        <p className="text-xs tracking-[0.2em] uppercase text-muted font-display mb-3">Exercises</p>
        <div className="space-y-px border-t border-border">
          {day.exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-center justify-between py-3.5 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted font-display tabular-nums w-4 text-right">{i + 1}</span>
                <div>
                  <p className="text-sm font-display font-500 text-ink">{ex.exercise.name}</p>
                  <p className="text-xs text-muted uppercase tracking-wider mt-0.5">{ex.exercise.muscle_group}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 pt-4 border-t border-border">
        <button
          onClick={onStartWorkout}
          disabled={starting}
          className="w-full py-4 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.2em] rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {starting ? 'Starting...' : 'Start This Workout'}
        </button>
      </div>
    </Shell>
  )
}

// ─── Create Program ───────────────────────────────────────────────────────────

interface DraftDay {
  label: string
  exercises: ExerciseDef[]
}

function ExercisePickerBody({
  library, loading, allGroups, filter, search, addedIds,
  onFilterChange, onSearchChange, onAdd,
}: {
  library: ExerciseDef[]
  loading: boolean
  allGroups: string[]
  filter: string
  search: string
  addedIds: string[]
  onFilterChange: (g: string) => void
  onSearchChange: (s: string) => void
  onAdd: (ex: ExerciseDef) => void
}) {
  return (
    <>
      <div className="px-6 pt-4 pb-3">
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by name or muscle group..."
          className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/30 transition-colors"
          autoFocus
        />
      </div>

      <div className="px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {allGroups.map(g => (
          <button
            key={g}
            onClick={() => onFilterChange(g)}
            className={`shrink-0 px-3 py-1.5 rounded-sm text-xs font-display uppercase tracking-wider border transition-colors ${
              filter === g
                ? 'border-lime/40 text-lime bg-lime/10'
                : 'border-border text-muted hover:border-ink hover:text-ink'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-2 scrollbar-hide">
        {loading && <p className="text-center text-muted text-sm py-12">Loading...</p>}
        {!loading && library.length === 0 && !search.trim() && filter === 'All' && (
          <p className="text-center text-muted text-sm py-12">
            Start typing an exercise name or muscle group.
          </p>
        )}
        {!loading && library.length === 0 && (search.trim() || filter !== 'All') && (
          <p className="text-center text-muted text-sm py-12">No exercises found.</p>
        )}
        {!loading && library.map(ex => {
          const added = addedIds.includes(ex.id)
          return (
            <div
              key={ex.id}
              className="bg-surface border border-border rounded-sm flex justify-between items-center px-4 py-3"
            >
              <div>
                <p className="text-sm font-display font-500 text-ink">{ex.name}</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-0.5">{ex.muscle_group}</p>
              </div>
              <button
                onClick={() => !added && onAdd(ex)}
                disabled={added}
                className={`text-xs font-display uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-colors ${
                  added
                    ? 'border-border text-muted opacity-40 cursor-default'
                    : 'border-lime/40 text-lime hover:bg-lime/10 cursor-pointer'
                }`}
              >
                {added ? '✓' : '+ Add'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function CreateProgramScreen({
  muscleGroups, onBack, onSave, onError,
}: {
  muscleGroups: string[]
  onBack: () => void
  onSave: (input: { title: string; description: string; days: { label: string; exerciseIds: string[] }[] }) => Promise<void>
  onError: (e: unknown) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState<DraftDay[]>([{ label: '', exercises: [] }])
  const [saving, setSaving] = useState(false)

  const [pickerDayIdx, setPickerDayIdx] = useState<number | null>(null)
  const [libFilter, setLibFilter] = useState('All')
  const [libSearch, setLibSearch] = useState('')
  const [libResults, setLibResults] = useState<ExerciseDef[]>([])
  const [libLoading, setLibLoading] = useState(false)

  useEffect(() => {
    if (pickerDayIdx === null) return
    if (!libSearch.trim() && libFilter === 'All') {
      setLibResults([])
      setLibLoading(false)
      return
    }
    setLibLoading(true)
    const timeout = setTimeout(() => {
      api
        .getExerciseLibrary(libSearch, libFilter)
        .then(setLibResults)
        .catch(onError)
        .finally(() => setLibLoading(false))
    }, 300)
    return () => clearTimeout(timeout)
  }, [pickerDayIdx, libSearch, libFilter, onError])

  const addDay = () => setDays(prev => [...prev, { label: '', exercises: [] }])
  const removeDay = (idx: number) => setDays(prev => prev.filter((_, i) => i !== idx))
  const setDayLabel = (idx: number, label: string) =>
    setDays(prev => prev.map((d, i) => (i === idx ? { ...d, label } : d)))
  const removeExercise = (idx: number, exId: string) =>
    setDays(prev =>
      prev.map((d, i) => (i === idx ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) } : d))
    )

  const openPicker = (idx: number) => {
    setPickerDayIdx(idx)
    setLibSearch('')
    setLibFilter('All')
    setLibResults([])
  }

  const canSave = title.trim().length > 0 && days.length > 0 && days.every(d => d.exercises.length > 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        days: days.map(d => ({ label: d.label.trim(), exerciseIds: d.exercises.map(e => e.id) })),
      })
    } catch (e) {
      onError(e)
    } finally {
      setSaving(false)
    }
  }

  if (pickerDayIdx !== null) {
    const dayLabel = days[pickerDayIdx].label || `Day ${pickerDayIdx + 1}`
    return (
      <Shell>
        <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
          <button
            onClick={() => setPickerDayIdx(null)}
            className="text-muted hover:text-ink transition-colors text-sm min-w-[3rem]"
          >
            ← Back
          </button>
          <h1 className="text-xs font-display font-600 uppercase tracking-[0.2em] text-ink truncate max-w-[55%]">
            Add to {dayLabel}
          </h1>
          <button
            onClick={() => setPickerDayIdx(null)}
            className="text-lime text-xs font-display uppercase tracking-wider min-w-[3rem] text-right"
          >
            Done
          </button>
        </header>
        <ExercisePickerBody
          library={libResults}
          loading={libLoading}
          allGroups={muscleGroups}
          filter={libFilter}
          search={libSearch}
          addedIds={days[pickerDayIdx].exercises.map(e => e.id)}
          onFilterChange={setLibFilter}
          onSearchChange={setLibSearch}
          onAdd={ex =>
            setDays(prev =>
              prev.map((d, i) => (i === pickerDayIdx ? { ...d, exercises: [...d.exercises, ex] } : d))
            )
          }
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
        <button onClick={onBack} className="text-muted hover:text-ink transition-colors text-sm min-w-[3rem]">
          ← Cancel
        </button>
        <h1 className="text-xs font-display font-600 uppercase tracking-[0.2em] text-ink">Create Program</h1>
        <span className="min-w-[3rem]" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-hide">
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-muted font-display">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Push / Pull / Legs"
            className="mt-2 w-full bg-surface border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/30 transition-colors"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-muted font-display">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this program for?"
            rows={2}
            className="mt-2 w-full bg-surface border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/30 transition-colors resize-none"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted font-display">
            Days ({days.length})
          </p>
          {days.map((day, idx) => (
            <div key={idx} className="bg-surface border border-border rounded-sm p-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted font-display tabular-nums w-4 text-right shrink-0">
                  {idx + 1}
                </span>
                <input
                  value={day.label}
                  onChange={e => setDayLabel(idx, e.target.value)}
                  placeholder={`Day ${idx + 1} label, e.g. Push`}
                  className="flex-1 bg-transparent border-b border-border px-1 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/40 transition-colors"
                />
                {days.length > 1 && (
                  <button
                    onClick={() => removeDay(idx)}
                    className="text-muted hover:text-ink transition-colors text-xs shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>

              {day.exercises.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {day.exercises.map(ex => (
                    <span
                      key={ex.id}
                      className="text-xs pl-2.5 pr-1.5 py-1 rounded-sm bg-lime/10 border border-lime/30 text-lime flex items-center gap-1.5"
                    >
                      {ex.name}
                      <button
                        onClick={() => removeExercise(idx, ex.id)}
                        className="hover:text-ink transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => openPicker(idx)}
                className="mt-3 w-full border border-dashed border-border rounded-sm py-2.5 text-muted text-xs font-display uppercase tracking-[0.18em] hover:border-lime/30 hover:text-lime transition-colors"
              >
                + Add Exercise
              </button>
            </div>
          ))}
          <button
            onClick={addDay}
            className="w-full border border-dashed border-border rounded-sm py-3 text-muted text-xs font-display uppercase tracking-[0.2em] hover:border-lime/30 hover:text-lime transition-colors"
          >
            + Add Day
          </button>
        </div>
      </div>

      <div className="px-6 pb-8 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-4 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.2em] rounded-sm disabled:opacity-30 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Saving...' : 'Save Program'}
        </button>
      </div>
    </Shell>
  )
}

// ─── Workout screens (unchanged behavior) ────────────────────────────────────

function ExerciseRow({ ex, idx, onGo }: { ex: ExerciseEntry; idx: number; onGo: () => void }) {
  const dotCount = Math.max(3, ex.sets.length)

  return (
    <li className="bg-surface border border-border rounded-sm">
      <button onClick={onGo} className="w-full px-4 pt-4 pb-4 text-left group flex gap-3 items-start">
        <span className="text-xs text-muted font-display tabular-nums pt-0.5 w-4 shrink-0 text-right">
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-display font-500 text-ink truncate">{ex.name}</p>
              <p className="text-xs text-muted uppercase tracking-wider mt-0.5">{ex.group}</p>
            </div>
            <span className="text-muted group-hover:text-lime transition-colors shrink-0 mt-0.5">→</span>
          </div>

          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: dotCount }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < ex.sets.length ? 'bg-lime' : 'bg-surface2 border border-border'
                }`}
              />
            ))}
            {ex.sets.length > 0 && (
              <span className="text-xs text-muted ml-1">
                {ex.sets.length} sets
              </span>
            )}
          </div>

          {ex.sets.length > 0 && (
            <div className="mt-2 flex gap-3 flex-wrap">
              {ex.sets.map((s, i) => (
                <span key={i} className="text-xs text-muted tabular-nums font-display">
                  {s.reps}×{fmtWeight(s.weight)}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    </li>
  )
}

interface OverviewProps {
  sessionType: 'scheduled' | 'adhoc'
  programTitle: string
  exercises: ExerciseEntry[]
  elapsed: number | null
  finishing: boolean
  onBack: () => void
  onBeginWorkout: (idx: number) => void
  onGoToExercise: (idx: number) => void
  onAddExercise: () => void
  onFinish: () => void
}

function OverviewScreen({
  sessionType, programTitle, exercises, elapsed, finishing,
  onBack, onBeginWorkout, onGoToExercise, onAddExercise, onFinish,
}: OverviewProps) {
  const hasAnySet = exercises.some(e => e.sets.length > 0)
  const hasExercises = exercises.length > 0

  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink transition-colors text-sm min-w-[3rem]"
        >
          ← Back
        </button>
        <h1 className="text-xs font-display font-600 uppercase tracking-[0.2em] text-ink">
          {sessionType === 'scheduled' ? programTitle : 'Ad Hoc Session'}
        </h1>
        {elapsed !== null ? (
          <span className="text-sm font-display font-500 text-lime tabular-nums min-w-[3rem] text-right">
            {fmtTime(elapsed)}
          </span>
        ) : (
          <span className="min-w-[3rem]" />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-hide">
        {!hasExercises ? (
          <div className="py-16 text-center">
            <p className="text-muted text-sm">No exercises yet.</p>
            <p className="text-xs text-muted mt-1 opacity-60">Add from the library below.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {exercises.map((ex, i) => (
              <ExerciseRow
                key={ex.sessionExerciseId}
                ex={ex}
                idx={i}
                onGo={() => onGoToExercise(i)}
              />
            ))}
          </ul>
        )}

        <button
          onClick={onAddExercise}
          className="mt-4 w-full border border-dashed border-border rounded-sm py-4 text-muted text-xs font-display uppercase tracking-[0.2em] hover:border-lime/30 hover:text-lime transition-colors"
        >
          + Add Exercise
        </button>
      </div>

      <div className="px-6 pb-8 pt-4 border-t border-border space-y-3">
        {hasAnySet && (
          <button
            onClick={onFinish}
            disabled={finishing}
            className="w-full py-3 border border-border text-muted text-xs font-display font-500 uppercase tracking-[0.18em] hover:border-ink hover:text-ink transition-colors rounded-sm disabled:opacity-50"
          >
            {finishing ? 'Finishing...' : 'Finish Session'}
          </button>
        )}
        <button
          onClick={() => onBeginWorkout(0)}
          disabled={!hasExercises}
          className="w-full py-4 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.2em] rounded-sm disabled:opacity-30 hover:opacity-90 transition-opacity"
        >
          {hasAnySet ? 'Continue Workout' : 'Begin Workout'}
        </button>
      </div>
    </Shell>
  )
}

interface ActiveProps {
  exercise: ExerciseEntry
  exerciseIdx: number
  totalExercises: number
  reps: number
  weight: number
  elapsed: number
  logging: boolean
  onSetReps: (v: number) => void
  onSetWeight: (v: number) => void
  onLogSet: () => void
  onNext: () => void
  onBack: () => void
  isLast: boolean
}

function ActiveScreen({
  exercise, exerciseIdx, totalExercises, reps, weight, elapsed, logging,
  onSetReps, onSetWeight, onLogSet, onNext, onBack, isLast,
}: ActiveProps) {
  const [justLogged, setJustLogged] = useState(false)
  const nextSetNum = exercise.sets.length + 1

  const handleLog = () => {
    onLogSet()
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 1200)
  }

  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink transition-colors text-sm min-w-[4rem]"
        >
          ← Overview
        </button>
        <span className="text-xs text-muted font-display uppercase tracking-[0.2em]">
          {exerciseIdx + 1} / {totalExercises}
        </span>
        <span className="text-sm font-display font-500 text-lime tabular-nums min-w-[4rem] text-right">
          {fmtTime(elapsed)}
        </span>
      </header>

      <div className="px-6 pt-8 pb-5">
        <p className="text-xs text-muted uppercase tracking-[0.2em] mb-2 font-display">{exercise.group}</p>
        <h2 className="text-2xl font-display font-700 text-ink leading-tight">{exercise.name}</h2>
      </div>

      {exercise.sets.length > 0 && (
        <div className="px-6 mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3 font-display">Logged</p>
          <div className="space-y-0 border-t border-border">
            {exercise.sets.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-border"
              >
                <span className="text-xs uppercase tracking-wider text-muted font-display">
                  Set {i + 1}
                </span>
                <span className="text-sm tabular-nums text-ink font-display font-500">
                  {s.reps}{' '}
                  <span className="text-muted text-xs font-400">reps</span>
                  {' '}×{' '}
                  {fmtWeight(s.weight)}{' '}
                  <span className="text-muted text-xs font-400">lbs</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 flex-1">
        <div className="bg-surface border border-border rounded-sm p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted mb-6 font-display">
            Set {nextSetNum}
          </p>
          <div className="space-y-5">
            <Stepper
              label="Reps"
              display={String(reps)}
              onDec={() => onSetReps(Math.max(1, reps - 1))}
              onInc={() => onSetReps(reps + 1)}
            />
            <div className="h-px bg-border" />
            <Stepper
              label="lbs"
              display={fmtWeight(weight)}
              onDec={() => onSetWeight(Math.max(0, weight - 5))}
              onInc={() => onSetWeight(weight + 5)}
            />
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 pt-6 space-y-3">
        <button
          onClick={handleLog}
          disabled={logging}
          className={`w-full py-4 rounded-sm text-xs font-display font-700 uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-50 ${
            justLogged
              ? 'bg-transparent border border-lime/40 text-lime'
              : 'bg-lime text-ground hover:opacity-90'
          }`}
        >
          {justLogged ? '✓ Set Logged' : logging ? 'Logging...' : `Log Set ${nextSetNum}`}
        </button>
        <button
          onClick={onNext}
          className="w-full py-3 border border-border text-muted text-xs font-display font-500 uppercase tracking-[0.18em] hover:border-ink hover:text-ink transition-colors rounded-sm"
        >
          {isLast ? 'Done — Back to Overview' : 'Next Exercise →'}
        </button>
      </div>
    </Shell>
  )
}

interface LibraryProps {
  library: ExerciseDef[]
  loading: boolean
  allGroups: string[]
  filter: string
  search: string
  addedExercises: ExerciseEntry[]
  onFilterChange: (g: string) => void
  onSearchChange: (s: string) => void
  onAdd: (ex: ExerciseDef) => void
  onBack: () => void
}

function LibraryScreen({
  library, loading, allGroups, filter, search, addedExercises,
  onFilterChange, onSearchChange, onAdd, onBack,
}: LibraryProps) {
  const addedIds = addedExercises.map(e => e.id)
  return (
    <Shell>
      <header className="px-6 pt-10 pb-5 flex justify-between items-center border-b border-border">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink transition-colors text-sm min-w-[3rem]"
        >
          ← Back
        </button>
        <h1 className="text-xs font-display font-600 uppercase tracking-[0.2em] text-ink">
          Add Exercise
        </h1>
        <span className="min-w-[3rem]" />
      </header>

      {addedExercises.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">
            Added so far ({addedExercises.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {addedExercises.map(ex => (
              <span
                key={ex.sessionExerciseId}
                className="text-xs px-2.5 py-1 rounded-sm bg-lime/10 border border-lime/30 text-lime"
              >
                {ex.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <ExercisePickerBody
        library={library}
        loading={loading}
        allGroups={allGroups}
        filter={filter}
        search={search}
        addedIds={addedIds}
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
        onAdd={onAdd}
      />
    </Shell>
  )
}

interface CompleteProps {
  exercises: ExerciseEntry[]
  elapsed: number
  totalVolume: number
  totalSets: number
  onDone: () => void
}

function CompleteScreen({ exercises, elapsed, totalVolume, totalSets, onDone }: CompleteProps) {
  const logged = exercises.filter(e => e.sets.length > 0)
  const volDisplay = totalVolume >= 1000
    ? `${(totalVolume / 1000).toFixed(1)}k`
    : `${totalVolume}lbs`

  return (
    <Shell>
      <div className="px-6 pt-12 pb-8 text-center border-b border-border">
        <div className="w-14 h-14 rounded-full border border-lime flex items-center justify-center mx-auto mb-6">
          <span className="text-lime text-xl leading-none">✓</span>
        </div>
        <h1 className="text-2xl font-display font-700 text-ink">Session Complete</h1>
        <p className="text-muted text-xs mt-2 font-display uppercase tracking-widest">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="px-6 py-6 grid grid-cols-3 gap-4 border-b border-border">
        {[
          { label: 'Duration', value: fmtTime(elapsed) },
          { label: 'Sets', value: String(totalSets) },
          { label: 'Volume', value: volDisplay },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="text-2xl font-display font-700 text-lime tabular-nums">{s.value}</p>
            <p className="text-xs text-muted uppercase tracking-widest mt-1.5 font-display">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-hide">
        {logged.map(ex => (
          <div key={ex.sessionExerciseId} className="bg-surface border border-border rounded-sm p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-display font-600 text-ink">{ex.name}</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-0.5">{ex.group}</p>
              </div>
              <span className="text-xs text-muted font-display">{ex.sets.length} sets</span>
            </div>
            <div className="space-y-1.5 border-t border-border pt-3">
              {ex.sets.map((s, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs text-muted font-display uppercase tracking-wider">
                    Set {i + 1}
                  </span>
                  <span className="text-sm text-ink tabular-nums font-display font-500">
                    {s.reps} reps × {fmtWeight(s.weight)} lbs
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-8 pt-4">
        <button
          onClick={onDone}
          className="w-full py-4 bg-lime text-ground text-xs font-display font-700 uppercase tracking-[0.2em] rounded-sm hover:opacity-90 transition-opacity"
        >
          Finalize &amp; Done
        </button>
      </div>
    </Shell>
  )
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[440px] w-[92%] bg-surface border border-red-500/40 rounded-sm px-4 py-3 flex justify-between items-center gap-3">
      <p className="text-xs text-ink">{message}</p>
      <button onClick={onDismiss} className="text-muted hover:text-ink text-xs shrink-0">✕</button>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionType, setSessionType] = useState<'scheduled' | 'adhoc'>('scheduled')
  const [programTitle, setProgramTitle] = useState('')
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(135)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const [homeCard, setHomeCard] = useState<HomeCard>({ kind: 'loading' })
  const [sessionCounts, setSessionCounts] = useState<{ thisWeek: number; thisMonth: number } | null>(null)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [logging, setLogging] = useState(false)

  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [viewProgramId, setViewProgramId] = useState<string | null>(null)
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null)
  const [programDetailLoading, setProgramDetailLoading] = useState(false)
  const [viewDayNumber, setViewDayNumber] = useState(1)

  const [muscleGroups, setMuscleGroups] = useState<string[]>(['All'])
  const [libFilter, setLibFilter] = useState('All')
  const [libSearch, setLibSearch] = useState('')
  const [libResults, setLibResults] = useState<ExerciseDef[]>([])
  const [libLoading, setLibLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const showError = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), [])

  const refreshHomeCard = useCallback(async () => {
    setHomeCard({ kind: 'loading' })
    try {
      const open = await api.getOpenSession()
      if (open) {
        setHomeCard({ kind: 'session', open })
        return
      }
      const overview = await api.getProgramsOverview()
      const inProgress = overview.filter(p => p.completedDayCount > 0 && p.completedDayCount < p.dayCount)
      if (inProgress.length > 0) {
        inProgress.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        const top = inProgress[0]
        const dayNumber = (top.completedDayCount % top.dayCount) + 1
        setHomeCard({
          kind: 'program',
          programId: top.id,
          title: top.title,
          dayLabel: `Day ${dayNumber}`,
          dayNumber,
          completedDayCount: top.completedDayCount,
          dayCount: top.dayCount,
        })
        return
      }
      setHomeCard({ kind: 'none' })
    } catch (e) {
      showError(e)
      setHomeCard({ kind: 'none' })
    }
  }, [showError])

  useEffect(() => {
    api.getMuscleGroups().then(setMuscleGroups).catch(showError)
    api.getSessionCounts().then(setSessionCounts).catch(showError)
    refreshHomeCard()
  }, [refreshHomeCard])

  useEffect(() => {
    if (screen !== 'library') return

    // Empty box + "All" pill = nothing to search for yet; don't hit the DB.
    if (!libSearch.trim() && libFilter === 'All') {
      setLibResults([])
      setLibLoading(false)
      return
    }

    setLibLoading(true)
    const timeout = setTimeout(() => {
      api
        .getExerciseLibrary(libSearch, libFilter)
        .then(setLibResults)
        .catch(showError)
        .finally(() => setLibLoading(false))
    }, 300) // debounce: wait for the person to stop typing

    return () => clearTimeout(timeout)
  }, [screen, libSearch, libFilter, showError])

  useEffect(() => {
    if (screen !== 'programs') return
    setProgramsLoading(true)
    api.getProgramsOverview().then(setPrograms).catch(showError).finally(() => setProgramsLoading(false))
  }, [screen, showError])

  useEffect(() => {
    if (screen !== 'program-detail' || !viewProgramId) return
    setProgramDetailLoading(true)
    api
      .getProgramDetail(viewProgramId)
      .then(setProgramDetail)
      .catch(showError)
      .finally(() => setProgramDetailLoading(false))
  }, [screen, viewProgramId, showError])

  useEffect(() => {
    if (!sessionStartTime) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [sessionStartTime])

  const resumeOpenSession = useCallback((open: OpenSession) => {
    setSessionId(open.sessionId)
    setSessionType(open.sessionType)
    setProgramTitle(open.dayLabel)
    setActiveProgramId(open.programId)
    setExercises(
      open.exercises.map(e => ({
        id: e.exerciseId,
        sessionExerciseId: e.sessionExerciseId,
        name: e.name,
        group: e.group,
        sets: e.sets.map(s => ({ reps: s.reps, weight: s.weight })),
      }))
    )
    setCurrentIdx(0)
    setSessionStartTime(new Date(open.createdAt).getTime())
    setScreen('overview')
  }, [])

  const startProgramDay = useCallback(
    async (programId: string, dayNumber: number) => {
      setStarting(true)
      try {
        const day = await api.getProgramDay(programId, dayNumber)
        if (!day) throw new Error('Could not find that day.')
        const newSessionId = await api.createSession({ programId, programDayNumber: dayNumber })
        const entries: ExerciseEntry[] = []
        for (const pde of day.exercises) {
          const sessionExerciseId = await api.addSessionExercise(newSessionId, pde.exercise.id, pde.exercise_number)
          entries.push({
            id: pde.exercise.id,
            sessionExerciseId,
            name: pde.exercise.name,
            group: pde.exercise.muscle_group ?? '',
            sets: [],
          })
        }
        setSessionId(newSessionId)
        setSessionType('scheduled')
        setProgramTitle(day.dayTitle || `Day ${dayNumber}`)
        setActiveProgramId(programId)
        setExercises(entries)
        setCurrentIdx(0)
        setScreen('overview')
      } catch (e) {
        showError(e)
      } finally {
        setStarting(false)
      }
    },
    [showError]
  )

  const startAdhoc = useCallback(async () => {
    setStarting(true)
    try {
      const newSessionId = await api.createSession({})
      setSessionId(newSessionId)
      setSessionType('adhoc')
      setProgramTitle('')
      setActiveProgramId(null)
      setExercises([])
      setCurrentIdx(0)
      setScreen('overview')
    } catch (e) {
      showError(e)
    } finally {
      setStarting(false)
    }
  }, [showError])

  const beginWorkout = (idx: number) => {
    const ex = exercises[idx]
    setCurrentIdx(idx)
    setReps(10)
    setWeight(ex?.sets.at(-1)?.weight ?? 135)
    if (!sessionStartTime) setSessionStartTime(Date.now())
    setScreen('active')
  }

  const goToExercise = (idx: number) => {
    const ex = exercises[idx]
    setCurrentIdx(idx)
    setReps(ex?.sets.at(-1)?.reps ?? 10)
    setWeight(ex?.sets.at(-1)?.weight ?? 135)
    setScreen('active')
  }

  const logSet = async () => {
    const ex = exercises[currentIdx]
    if (!ex) return
    setLogging(true)
    try {
      await api.addLoggedSet(ex.sessionExerciseId, ex.sets.length + 1, reps, weight)
      setExercises(prev =>
        prev.map((e, i) => (i === currentIdx ? { ...e, sets: [...e.sets, { reps, weight }] } : e))
      )
    } catch (e) {
      showError(e)
    } finally {
      setLogging(false)
    }
  }

  const nextExercise = () => {
    if (currentIdx < exercises.length - 1) {
      goToExercise(currentIdx + 1)
    } else {
      setScreen('overview')
    }
  }

  const addExercise = async (def: ExerciseDef) => {
    if (!sessionId || exercises.find(e => e.id === def.id)) return
    try {
      const sessionExerciseId = await api.addSessionExercise(sessionId, def.id, exercises.length + 1)
      setExercises(prev => [
        ...prev,
        { id: def.id, sessionExerciseId, name: def.name, group: def.muscle_group ?? '', sets: [] },
      ])
    } catch (e) {
      showError(e)
    }
  }

  const finishSession = async () => {
    if (!sessionId) {
      setScreen('complete')
      return
    }
    setFinishing(true)
    try {
      await api.finishSession(sessionId, elapsed, activeProgramId)
      setScreen('complete')
    } catch (e) {
      showError(e)
    } finally {
      setFinishing(false)
    }
  }

  const openProgramDetail = (programId: string) => {
    setViewProgramId(programId)
    setScreen('program-detail')
  }

  const openDayDetail = (dayNumber: number) => {
    setViewDayNumber(dayNumber)
    setScreen('day-detail')
  }

  const handleRestartProgram = async () => {
    if (!viewProgramId) return
    try {
      await api.resetProgramProgress(viewProgramId)
      const detail = await api.getProgramDetail(viewProgramId)
      setProgramDetail(detail)
      openDayDetail(1)
    } catch (e) {
      showError(e)
    }
  }

  const handleCreateProgram = async (input: {
    title: string
    description: string
    days: { label: string; exerciseIds: string[] }[]
  }) => {
    const id = await api.createProgram(input)
    setViewProgramId(id)
    setProgramDetail(null)
    setScreen('program-detail')
  }

  const totalVolume = exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0),
    0
  )
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)

  const errorBanner = error && <ErrorBanner message={error} onDismiss={() => setError(null)} />

  if (screen === 'home')
    return (
      <>
        {errorBanner}
        <HomeScreen
          homeCard={homeCard}
          sessionCounts={sessionCounts}
          starting={starting}
          onResumeSession={() => {
            if (homeCard.kind === 'session') resumeOpenSession(homeCard.open)
          }}
          onContinueProgram={() => {
            if (homeCard.kind === 'program') startProgramDay(homeCard.programId, homeCard.dayNumber)
          }}
          onAdhoc={startAdhoc}
          onBrowsePrograms={() => setScreen('programs')}
        />
      </>
    )

  if (screen === 'programs')
    return (
      <>
        {errorBanner}
        <ProgramsScreen
          programs={programs}
          loading={programsLoading}
          onBack={() => setScreen('home')}
          onSelectProgram={openProgramDetail}
          onCreateProgram={() => setScreen('create-program')}
        />
      </>
    )

  if (screen === 'create-program')
    return (
      <>
        {errorBanner}
        <CreateProgramScreen
          muscleGroups={muscleGroups}
          onBack={() => setScreen('programs')}
          onSave={handleCreateProgram}
          onError={showError}
        />
      </>
    )

  if (screen === 'program-detail')
    return (
      <>
        {errorBanner}
        <ProgramDetailScreen
          detail={programDetail}
          loading={programDetailLoading || programDetail?.id !== viewProgramId}
          onBack={() => setScreen('programs')}
          onOpenDay={openDayDetail}
          onRestart={handleRestartProgram}
        />
      </>
    )

  if (screen === 'day-detail' && programDetail)
    return (
      <>
        {errorBanner}
        <DayDetailScreen
          detail={programDetail}
          dayNumber={viewDayNumber}
          onBack={() => setScreen('program-detail')}
          onStartWorkout={() => viewProgramId && startProgramDay(viewProgramId, viewDayNumber)}
          starting={starting}
        />
      </>
    )

  if (screen === 'overview')
    return (
      <>
        {errorBanner}
        <OverviewScreen
          sessionType={sessionType}
          programTitle={programTitle}
          exercises={exercises}
          elapsed={sessionStartTime ? elapsed : null}
          finishing={finishing}
          onBack={() => setScreen('home')}
          onBeginWorkout={beginWorkout}
          onGoToExercise={goToExercise}
          onAddExercise={() => setScreen('library')}
          onFinish={finishSession}
        />
      </>
    )

  if (screen === 'active' && exercises[currentIdx])
    return (
      <>
        {errorBanner}
        <ActiveScreen
          exercise={exercises[currentIdx]}
          exerciseIdx={currentIdx}
          totalExercises={exercises.length}
          reps={reps}
          weight={weight}
          elapsed={elapsed}
          logging={logging}
          onSetReps={setReps}
          onSetWeight={setWeight}
          onLogSet={logSet}
          onNext={nextExercise}
          onBack={() => setScreen('overview')}
          isLast={currentIdx === exercises.length - 1}
        />
      </>
    )

  if (screen === 'library')
    return (
      <>
        {errorBanner}
        <LibraryScreen
          library={libResults}
          loading={libLoading}
          allGroups={muscleGroups}
          filter={libFilter}
          search={libSearch}
          addedExercises={exercises}
          onFilterChange={setLibFilter}
          onSearchChange={setLibSearch}
          onAdd={addExercise}
          onBack={() => setScreen('overview')}
        />
      </>
    )

  if (screen === 'complete')
    return (
      <>
        {errorBanner}
        <CompleteScreen
          exercises={exercises}
          elapsed={elapsed}
          totalVolume={totalVolume}
          totalSets={totalSets}
          onDone={() => {
            setScreen('home')
            setSessionId(null)
            setExercises([])
            setSessionStartTime(null)
            setElapsed(0)
            setActiveProgramId(null)
            api.getSessionCounts().then(setSessionCounts).catch(showError)
            refreshHomeCard()
          }}
        />
      </>
    )

  return null
}
