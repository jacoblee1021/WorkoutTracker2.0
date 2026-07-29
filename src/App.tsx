import { useState, useEffect, useCallback } from 'react'
import * as api from './lib/api'
import type { DueToday, ExerciseRow as ExerciseDef } from './lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'home' | 'overview' | 'active' | 'complete' | 'library'

interface SetLog { reps: number; weight: number }

interface ExerciseEntry {
  id: string
  sessionExerciseId: string
  name: string
  group: string
  sets: SetLog[]
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtWeight(w: number) {
  return w % 1 === 0 ? String(w) : w.toFixed(1)
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never done'
  const then = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const diff = Math.round((now.getTime() - then.getTime()) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
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

function HomeScreen({
  dueToday, dueLoading, sessionCounts, starting, onScheduled, onAdhoc,
}: {
  dueToday: DueToday | null
  dueLoading: boolean
  sessionCounts: { thisWeek: number; thisMonth: number } | null
  starting: boolean
  onScheduled: () => void
  onAdhoc: () => void
}) {
  const tags = dueToday
    ? [
        ...dueToday.exercises.slice(0, 3).map(e => e.exercise.name),
        ...(dueToday.exercises.length > 3 ? [`+${dueToday.exercises.length - 3} more`] : []),
      ]
    : []

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
          <p className="text-xs tracking-[0.2em] uppercase text-muted mb-3 font-display">Due Today</p>
          {dueLoading ? (
            <div className="w-full bg-surface border border-border rounded-sm p-5">
              <p className="text-xs text-muted">Loading your program...</p>
            </div>
          ) : dueToday ? (
            <button
              onClick={onScheduled}
              disabled={starting}
              className="w-full bg-surface border border-border rounded-sm p-5 text-left hover:border-lime/30 transition-colors group disabled:opacity-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-display font-600 text-ink">
                    {dueToday.dayTitle || `Day ${dueToday.dayNumber}`}
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    {dueToday.exercises.length} exercises · Last done {daysAgo(dueToday.lastDoneDate).toLowerCase()}
                  </p>
                </div>
                <span className="text-lime text-xl leading-none mt-0.5 inline-block group-hover:translate-x-0.5 transition-transform">
                  {starting ? '···' : '→'}
                </span>
              </div>
              {tags.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {tags.map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 bg-surface2 text-muted rounded-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ) : (
            <div className="w-full border border-dashed border-border rounded-sm p-5">
              <p className="text-sm text-muted">No active program scheduled.</p>
            </div>
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
            : '\u00A0'}
        </p>
      </footer>
    </Shell>
  )
}

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

      <div className="px-6 pt-4 pb-3">
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by name or muscle group..."
          className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-lime/30 transition-colors"
          autoFocus
        />
      </div>

      {addedExercises.length > 0 && (
        <div className="px-6 pb-4">
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
  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(135)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const [dueToday, setDueToday] = useState<DueToday | null>(null)
  const [dueLoading, setDueLoading] = useState(true)
  const [sessionCounts, setSessionCounts] = useState<{ thisWeek: number; thisMonth: number } | null>(null)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [logging, setLogging] = useState(false)

  const [muscleGroups, setMuscleGroups] = useState<string[]>(['All'])
  const [libFilter, setLibFilter] = useState('All')
  const [libSearch, setLibSearch] = useState('')
  const [libResults, setLibResults] = useState<ExerciseDef[]>([])
  const [libLoading, setLibLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const showError = (e: unknown) => setError(e instanceof Error ? e.message : String(e))

  useEffect(() => {
    api.getMuscleGroups().then(setMuscleGroups).catch(showError)
    api.getSessionCounts().then(setSessionCounts).catch(showError)
    api
      .getDueToday()
      .then(setDueToday)
      .catch(showError)
      .finally(() => setDueLoading(false))
  }, [])

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
  }, [screen, libSearch, libFilter])

  useEffect(() => {
    if (!sessionStartTime) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [sessionStartTime])

  const startScheduled = useCallback(async () => {
    if (!dueToday) return
    setStarting(true)
    try {
      const newSessionId = await api.createSession({
        programId: dueToday.programId,
        programDayNumber: dueToday.dayNumber,
      })
      const entries: ExerciseEntry[] = []
      for (const pde of dueToday.exercises) {
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
      setProgramTitle(dueToday.dayTitle || dueToday.programTitle)
      setExercises(entries)
      setCurrentIdx(0)
      setScreen('overview')
    } catch (e) {
      showError(e)
    } finally {
      setStarting(false)
    }
  }, [dueToday])

  const startAdhoc = useCallback(async () => {
    setStarting(true)
    try {
      const newSessionId = await api.createSession({})
      setSessionId(newSessionId)
      setSessionType('adhoc')
      setProgramTitle('')
      setExercises([])
      setCurrentIdx(0)
      setScreen('overview')
    } catch (e) {
      showError(e)
    } finally {
      setStarting(false)
    }
  }, [])

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
      await api.finishSession(sessionId, elapsed)
      setScreen('complete')
    } catch (e) {
      showError(e)
    } finally {
      setFinishing(false)
    }
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
          dueToday={dueToday}
          dueLoading={dueLoading}
          sessionCounts={sessionCounts}
          starting={starting}
          onScheduled={startScheduled}
          onAdhoc={startAdhoc}
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
            api.getSessionCounts().then(setSessionCounts).catch(showError)
            api.getDueToday().then(setDueToday).catch(showError)
          }}
        />
      </>
    )

  return null
}
