import { useState, useEffect, useCallback } from 'react'
import * as api from './lib/api'
import type { ExerciseRow as ExerciseDef, OpenSession, ProgramDetail, ProgramSummary } from './lib/api'
import type { MuscleFocusEntry, StrengthTrend, WeeklyStats } from './lib/api'

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

type ContinueCard =
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

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtWeight(w: number) {
  return w % 1 === 0 ? String(w) : w.toFixed(1)
}

function fmtDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h === 0 ? `${m}m` : `${h}h ${m}m`
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-ground text-ink font-body flex justify-center">
      <div className={`w-full min-h-screen flex flex-col ${wide ? 'max-w-[480px] md:max-w-[760px]' : 'max-w-[480px]'}`}>
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
  continueCards, starting,
  onResumeSession, onDiscardSession, onContinueProgram, onAdhoc, onBrowsePrograms,
}: {
  continueCards: ContinueCard[] | 'loading'
  starting: boolean
  onResumeSession: (open: OpenSession) => void
  onDiscardSession: () => void
  onContinueProgram: (programId: string, dayNumber: number) => void
  onAdhoc: () => void
  onBrowsePrograms: () => void
}) {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null)
  const [insightTab, setInsightTab] = useState<'trend' | 'focus'>('trend')

  useEffect(() => {
    api.getWeeklyStats().then(setWeeklyStats).catch(() => setWeeklyStats(null))
  }, [])

  return (
    <Shell wide>
      <header className="px-6 pt-12 pb-8 flex justify-between items-start">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-muted font-display">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <h1 className="text-4xl font-display font-700 text-ink mt-1 tracking-tight">LIFT</h1>
        </div>
        <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center mt-1 text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
      </header>

      <div className="flex-1 space-y-8">
        <section>
          <p className="text-xs tracking-[0.2em] uppercase text-muted mb-3 font-display px-6">Continue</p>
          {continueCards === 'loading' ? (
            <div className="mx-6 bg-surface border border-border rounded-sm p-5">
              <p className="text-xs text-muted">Loading your progress...</p>
            </div>
          ) : continueCards.length === 0 ? (
            <p className="mx-6 text-xs text-muted">No active session or program in progress.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-6 pb-1">
              {continueCards.map(card =>
                card.kind === 'session' ? (
                  <div
                    key={`session-${card.open.sessionId}`}
                    className="shrink-0 w-56 bg-surface border border-lime/25 rounded-sm p-4 flex flex-col relative"
                  >
                    <button
                      onClick={onDiscardSession}
                      title="Discard this session"
                      className="absolute top-2.5 right-2.5 text-muted hover:text-ink transition-colors text-xs w-5 h-5 flex items-center justify-center"
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => onResumeSession(card.open)}
                      disabled={starting}
                      className="text-left flex-1 disabled:opacity-50"
                    >
                      <p className="text-[10px] text-lime font-display uppercase tracking-[0.15em]">
                        Continue Session
                      </p>
                      <p className="text-base font-display font-600 text-ink mt-1.5 leading-tight">
                        {card.open.dayLabel}
                      </p>
                      <p className="text-xs text-muted mt-1 font-display">
                        {card.open.exercises.length} exercises
                      </p>
                      <div className="mt-3 flex justify-end items-center">
                        <span className="text-lime">{starting ? '···' : '→'}</span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <button
                    key={`program-${card.programId}`}
                    onClick={() => onContinueProgram(card.programId, card.dayNumber)}
                    disabled={starting}
                    className="shrink-0 w-56 bg-surface border border-border rounded-sm p-4 text-left hover:border-lime/40 transition-colors group flex flex-col disabled:opacity-50"
                  >
                    <p className="text-[10px] text-muted font-display uppercase tracking-[0.15em] truncate">
                      {card.title}
                    </p>
                    <p className="text-base font-display font-600 text-ink mt-1.5 leading-tight">
                      {card.dayLabel}
                    </p>
                    <p className="text-xs text-muted mt-1 font-display">
                      {card.completedDayCount}/{card.dayCount} days done
                    </p>
                    <div className="mt-3 flex justify-end items-center">
                      <span className="text-lime group-hover:translate-x-0.5 transition-transform inline-block">
                        {starting ? '···' : '→'}
                      </span>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
          <div className="px-6 mt-3">
            <button
              onClick={onBrowsePrograms}
              className="w-full border border-dashed border-border rounded-sm py-3 text-muted text-xs font-display uppercase tracking-[0.18em] hover:border-lime/30 hover:text-lime transition-colors"
            >
              Browse Programs
            </button>
          </div>
        </section>

        <div className="flex items-center gap-4 px-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted uppercase tracking-[0.2em] font-display">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <section className="px-6">
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

        <section className="px-6">
          <p className="text-xs tracking-[0.2em] uppercase text-muted mb-3 font-display">This Week</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface border border-border rounded-sm py-3.5 px-2 text-center" title="Monday–Sunday">
              <p className="text-xl font-display font-700 text-lime tabular-nums">
                {weeklyStats ? weeklyStats.sessions : '–'}
              </p>
              <p className="text-[9.5px] text-muted uppercase tracking-wider mt-1 font-display">Sessions</p>
            </div>
            <div
              className="bg-surface border border-border rounded-sm py-3.5 px-2 text-center"
              title="An exercise's total volume (reps × weight) beat its previous best"
            >
              <p className="text-xl font-display font-700 text-lime tabular-nums">
                {weeklyStats ? weeklyStats.prsSet : '–'}
              </p>
              <p className="text-[9.5px] text-muted uppercase tracking-wider mt-1 font-display">PRs Set</p>
            </div>
            <div className="bg-surface border border-border rounded-sm py-3.5 px-2 text-center" title="Monday–Sunday">
              <p className="text-xl font-display font-700 text-lime tabular-nums">
                {weeklyStats ? fmtDuration(weeklyStats.totalMinutes) : '–'}
              </p>
              <p className="text-[9.5px] text-muted uppercase tracking-wider mt-1 font-display">Total Time</p>
            </div>
          </div>
        </section>

        <section className="px-6">
          <div className="flex gap-2 mb-3.5 md:hidden">
            <button
              onClick={() => setInsightTab('trend')}
              className={`flex-1 py-2.5 rounded-sm text-xs font-display uppercase tracking-wider border transition-colors ${
                insightTab === 'trend' ? 'border-lime/40 text-lime bg-lime/10' : 'border-border text-muted'
              }`}
            >
              Strength Trend
            </button>
            <button
              onClick={() => setInsightTab('focus')}
              className={`flex-1 py-2.5 rounded-sm text-xs font-display uppercase tracking-wider border transition-colors ${
                insightTab === 'focus' ? 'border-lime/40 text-lime bg-lime/10' : 'border-border text-muted'
              }`}
            >
              Muscle Focus
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr] md:gap-4">
            <div className={insightTab === 'trend' ? 'block' : 'hidden md:block'}>
              <p className="text-xs tracking-[0.2em] uppercase text-muted mb-3 font-display">Strength Trend</p>
              <StrengthTrendCard />
            </div>
            <div className={insightTab === 'focus' ? 'block' : 'hidden md:block'}>
              <p className="text-xs tracking-[0.2em] uppercase text-muted mb-3 font-display">Muscle Focus</p>
              <MuscleFocusCard />
            </div>
          </div>
        </section>
      </div>

      <div className="pb-10" />
    </Shell>
  )
}

// ─── This Week insight cards ────────────────────────────────────────────────

function MuscleFocusCard() {
  const [entries, setEntries] = useState<MuscleFocusEntry[] | 'loading'>('loading')

  useEffect(() => {
    api.getMuscleFocus().then(setEntries).catch(() => setEntries([]))
  }, [])

  if (entries === 'loading') {
    return (
      <div className="bg-surface border border-border rounded-sm p-5">
        <p className="text-xs text-muted">Loading...</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-sm p-5">
        <p className="text-xs text-muted">Log a few sessions to see your muscle group focus here.</p>
      </div>
    )
  }

  const maxPct = Math.max(...entries.map(e => e.pct))
  const flagged = entries.filter(e => e.underFocused)

  return (
    <div className="bg-surface border border-border rounded-sm p-5">
      <div className="flex justify-between items-baseline mb-4">
        <span className="text-sm font-display font-600 text-ink">% of sets logged</span>
        <span className="text-xs text-muted">Last 30 days</span>
      </div>
      <div>
        {entries.map(e => (
          <div key={e.muscleGroup} className="grid grid-cols-[76px_1fr_40px] items-center gap-2.5 py-1.5">
            <span className="text-xs font-display text-ink flex items-center gap-1.5 truncate">
              {e.muscleGroup}
              {e.underFocused && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Under-focused" />
              )}
            </span>
            <span className="h-2 bg-surface2 rounded-sm overflow-hidden block">
              <span
                className="block h-full bg-lime rounded-sm"
                style={{ width: `${(e.pct / maxPct) * 100}%` }}
              />
            </span>
            <span className="text-xs text-muted font-display tabular-nums text-right">{e.pct}%</span>
          </div>
        ))}
      </div>
      {flagged.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex items-start gap-1.5 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
          <span>Under-focused relative to the rest — consider adding a {flagged[0].muscleGroup} day</span>
        </div>
      )}
    </div>
  )
}

function StrengthTrendChart({ trend }: { trend: StrengthTrend }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 320
  const H = 120
  const PAD = 10
  const n = trend.weeks.length

  const points = trend.weeks
    .map((w, i) => ({ i, weekStart: w.weekStart, weight: w.maxWeight }))
    .filter((p): p is { i: number; weekStart: string; weight: number } => p.weight !== null)

  if (points.length === 0) {
    return <p className="text-xs text-muted">No logged sets for this muscle group yet.</p>
  }

  const minW = Math.min(...points.map(p => p.weight))
  const maxW = Math.max(...points.map(p => p.weight))
  const range = maxW - minW || 1

  const xAt = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2)
  const yAt = (w: number) => PAD + (1 - (w - minW) / range) * (H - PAD * 2)

  const linePts = points.map(p => `${xAt(p.i)},${yAt(p.weight)}`)
  const areaD = `M${xAt(points[0].i)},${H} L${linePts.join(' L')} L${xAt(points[points.length - 1].i)},${H} Z`
  const deltaLabel = trend.deltaPct === null ? null : `${trend.deltaPct >= 0 ? '+' : ''}${trend.deltaPct}%`
  const hitWidth = W / n
  const hovered = hoverIdx !== null ? points.find(p => p.i === hoverIdx) ?? null : null

  return (
    <div>
      <div className="flex items-baseline gap-2.5 mb-1">
        <span className="text-sm font-display font-600 text-ink">{trend.exerciseName}</span>
        {deltaLabel && <span className="text-xs font-display font-600 text-lime tabular-nums">{deltaLabel}</span>}
      </div>
      <p className="text-xs text-muted mb-3.5">Top set weight · last {n} weeks</p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block overflow-visible" style={{ height: 120 }}>
          <line x1="0" y1={H * 0.15} x2={W} y2={H * 0.15} className="stroke-border" strokeWidth="1" />
          <line x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} className="stroke-border" strokeWidth="1" />
          <line x1="0" y1={H * 0.85} x2={W} y2={H * 0.85} className="stroke-border" strokeWidth="1" />
          <path d={areaD} className="fill-lime/10" />
          <polyline
            points={linePts.join(' ')}
            fill="none"
            className="stroke-lime"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, idx) => (
            <circle
              key={p.i}
              cx={xAt(p.i)}
              cy={yAt(p.weight)}
              r={idx === points.length - 1 ? 4 : 2.5}
              className={idx === points.length - 1 ? 'fill-lime stroke-lime' : 'fill-ground stroke-lime'}
              strokeWidth="2"
            />
          ))}
          {hovered && (
            <line
              x1={xAt(hovered.i)}
              y1="0"
              x2={xAt(hovered.i)}
              y2={H}
              className="stroke-muted"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          )}
          {points.map(p => (
            <rect
              key={`hit-${p.i}`}
              x={xAt(p.i) - hitWidth / 2}
              y="0"
              width={hitWidth}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(p.i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
        </svg>
        {hovered && (
          <div
            className="absolute -top-1.5 -translate-x-1/2 -translate-y-full bg-ground border border-border rounded-sm px-2.5 py-1.5 pointer-events-none whitespace-nowrap"
            style={{ left: `${(xAt(hovered.i) / W) * 100}%` }}
          >
            <p className="text-xs font-display font-600 text-lime tabular-nums">{fmtWeight(hovered.weight)} lbs</p>
            <p className="text-[10px] text-muted font-display">
              {new Date(hovered.weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StrengthTrendCard() {
  const [groups, setGroups] = useState<string[] | 'loading'>('loading')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [trend, setTrend] = useState<StrengthTrend | null | 'loading'>('loading')

  useEffect(() => {
    api
      .getTrainedMuscleGroups()
      .then(gs => {
        setGroups(gs)
        if (gs.length > 0) setSelectedGroup(gs[0])
      })
      .catch(() => setGroups([]))
  }, [])

  useEffect(() => {
    if (!selectedGroup) return
    setTrend('loading')
    api
      .getStrengthTrend(selectedGroup)
      .then(setTrend)
      .catch(() => setTrend(null))
  }, [selectedGroup])

  if (groups === 'loading') {
    return (
      <div className="bg-surface border border-border rounded-sm p-5">
        <p className="text-xs text-muted">Loading...</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-sm p-5">
        <p className="text-xs text-muted">Log a few sessions to see your strength trend here.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-sm p-5">
      <select
        value={selectedGroup ?? ''}
        onChange={e => setSelectedGroup(e.target.value)}
        className="bg-surface2 border border-border rounded-sm px-3 py-2 text-xs font-display uppercase tracking-wider text-ink mb-4 focus:outline-none focus:border-lime/40"
      >
        {groups.map(g => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      {trend === 'loading' ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : !trend ? (
        <p className="text-xs text-muted">No logged sets for this muscle group yet.</p>
      ) : (
        <StrengthTrendChart trend={trend} />
      )}
    </div>
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
  discarding: boolean
  onBack: () => void
  onBeginWorkout: (idx: number) => void
  onGoToExercise: (idx: number) => void
  onAddExercise: () => void
  onFinish: () => void
  onDiscard: () => void
}

function OverviewScreen({
  sessionType, programTitle, exercises, elapsed, finishing, discarding,
  onBack, onBeginWorkout, onGoToExercise, onAddExercise, onFinish, onDiscard,
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
        <button
          onClick={() => {
            if (window.confirm('Discard this session? Anything logged will be dropped.')) onDiscard()
          }}
          disabled={discarding}
          className="w-full py-2 text-muted text-xs font-display uppercase tracking-[0.18em] hover:text-ink transition-colors disabled:opacity-50"
        >
          {discarding ? 'Discarding...' : 'Discard Session'}
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

  const [continueCards, setContinueCards] = useState<ContinueCard[] | 'loading'>('loading')
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
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
  const showError = useCallback((e: unknown) => {
    if (e instanceof Error) {
      setError(e.message)
    } else if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
      // Supabase/PostgREST errors are plain objects ({ code, message, details, hint }), not Error instances.
      setError((e as { message: string }).message)
    } else {
      setError(String(e))
    }
  }, [])

  const refreshContinueCards = useCallback(async () => {
    setContinueCards('loading')
    try {
      const [open, overview] = await Promise.all([api.getOpenSession(), api.getProgramsOverview()])
      const cards: ContinueCard[] = []
      if (open) cards.push({ kind: 'session', open })

      // A program with an open session already has a card for it above —
      // don't also show its separate "next day due" program card.
      const inProgress = overview.filter(
        p => p.completedDayCount > 0 && p.completedDayCount < p.dayCount && p.id !== open?.programId
      )
      inProgress.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      for (const p of inProgress) {
        const dayNumber = (p.completedDayCount % p.dayCount) + 1
        cards.push({
          kind: 'program',
          programId: p.id,
          title: p.title,
          dayLabel: `Day ${dayNumber}`,
          dayNumber,
          completedDayCount: p.completedDayCount,
          dayCount: p.dayCount,
        })
      }
      setContinueCards(cards)
    } catch (e) {
      showError(e)
      setContinueCards([])
    }
  }, [showError])

  useEffect(() => {
    api.getMuscleGroups().then(setMuscleGroups).catch(showError)
    refreshContinueCards()
  }, [refreshContinueCards])

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

  const discardActiveSession = async () => {
    if (!sessionId) {
      setScreen('home')
      return
    }
    setDiscarding(true)
    try {
      await api.discardSession(sessionId)
      setScreen('home')
      setSessionId(null)
      setExercises([])
      setSessionStartTime(null)
      setElapsed(0)
      setActiveProgramId(null)
      refreshContinueCards()
    } catch (e) {
      showError(e)
    } finally {
      setDiscarding(false)
    }
  }

  const discardOpenSessionCard = async () => {
    try {
      // Clear the whole backlog, not just the one card shown — the app
      // never intends to have more than one open session at a time.
      await api.discardAllOpenSessions()
      refreshContinueCards()
    } catch (e) {
      showError(e)
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
          continueCards={continueCards}
          starting={starting}
          onResumeSession={resumeOpenSession}
          onDiscardSession={discardOpenSessionCard}
          onContinueProgram={(programId, dayNumber) => startProgramDay(programId, dayNumber)}
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
          discarding={discarding}
          onBack={() => setScreen('home')}
          onBeginWorkout={beginWorkout}
          onGoToExercise={goToExercise}
          onAddExercise={() => setScreen('library')}
          onFinish={finishSession}
          onDiscard={discardActiveSession}
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
            refreshContinueCards()
          }}
        />
      </>
    )

  return null
}
