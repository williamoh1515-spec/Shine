import type { Exercise, GoalMetric } from '../../domain/models'
import type { WeekProgram } from '../../domain/program'
import type { CyclingPrescription } from '../../domain/progression/cycling'
import type { RepsPrescription } from '../../domain/progression/endurance-reps'
import type { RunningPrescription } from '../../domain/progression/running'
import type { StrengthPrescription } from '../../domain/progression/strength'
import type { TimedPrescription } from '../../domain/progression/timed'
import {
  activeAdjustments,
  exerciseName,
  formatDate,
  formatDuration,
  formatKg,
  formatKm,
  formatMetric,
  strengthActionText,
  strengthNoteText,
  techniqueText,
} from '../format'

type Names = Record<string, Exercise>

function StrengthBlock({ p, title, names }: { p: StrengthPrescription; title?: string; names: Names }) {
  const [lo, hi] = p.repRange
  const loadType = names[p.exerciseId]?.loadType
  const load = loadType === 'bodyweight' ? 'bodyweight' : loadType === 'addedLoad' ? `+${formatKg(p.loadKg)}` : formatKg(p.loadKg)
  return (
    <div className="program-block">
      <strong>{title ?? exerciseName(p.exerciseId, names)}</strong>
      <p className="big tabular">
        {p.sets} × {lo}–{hi} reps @ {load}
      </p>
      {p.technique && <p className="small">➕ With {techniqueText[p.technique]}</p>}
      <p className="small">
        Leave ~{p.targetRir} reps in reserve. {strengthActionText[p.action]}
      </p>
      {p.regression && (p.action === 'regress' || p.action === 'stallReset') && (
        <p className="small">Try instead: {p.regression}</p>
      )}
      {p.notes.map((n) => (
        <p key={n} className="small muted">
          {strengthNoteText[n]}
        </p>
      ))}
    </div>
  )
}

const repsActionText: Record<RepsPrescription['action'], string> = {
  build: 'Build volume with clean submax sets',
  test: '🎯 Test week: one all-out max set (fresh, after warm-up)',
  deload: 'Deload: fewer sets this week',
  regress: 'Easier variation while building back',
}

function RepsBlock({ p, weighted, names }: { p: RepsPrescription; weighted?: StrengthPrescription; names: Names }) {
  return (
    <>
      <div className="program-block">
        <strong>
          {exerciseName(p.exerciseId, names)} · week {p.weekInCycle + 1} of cycle
        </strong>
        <p className="small">{repsActionText[p.action]}</p>
        {p.action === 'test' ? (
          <p className="big">Max set → log it as a Test session</p>
        ) : (
          <>
            <p className="big tabular">
              Day A: {p.sets} × {p.reps} reps
            </p>
            <p className="small muted">~{Math.round(p.fraction * 100)}% of your current max, ~2 reps in reserve.</p>
            <p className="tabular">
              Day B (density): {p.densityTotalReps} total reps, in as few sets as possible. Beat last time.
            </p>
          </>
        )}
        {p.regression && p.action === 'regress' && <p className="small">Use: {p.regression}</p>}
      </div>
      {weighted && p.action !== 'regress' && (
        <StrengthBlock p={weighted} names={names} title={`${exerciseName(weighted.exerciseId, names)} (Day A)`} />
      )}
      {p.accessories.length > 0 && (
        <div className="program-block">
          <strong>Accessories (both days)</strong>
          <p className="small">
            {p.accessories.map((id) => exerciseName(id, names)).join(' · ')}: 2–3 × 12–15, easy.
          </p>
        </div>
      )}
    </>
  )
}

const timedActionText: Record<TimedPrescription['action'], string> = {
  start: 'First session: find a hold you can do cleanly',
  addTime: 'Same load, a few seconds longer',
  increaseLoad: 'Every set reached the target → heavier, back to a shorter hold',
  hold: 'Felt too hard → same time as last session',
  regress: 'Pain reported → easier version, progression paused',
  maxed: 'Top of this progression: try a harder variation',
}

function TimedBlock({ p, names }: { p: TimedPrescription; names: Names }) {
  return (
    <div className="program-block">
      <strong>{exerciseName(p.exerciseId, names)}</strong>
      <p className="big tabular">
        {p.sets} × {p.seconds} s{p.loadKg > 0 ? ` @ ${formatKg(p.loadKg)}` : ''}
      </p>
      <p className="small">{timedActionText[p.action]}</p>
      {p.regression && <p className="small">Use: {p.regression}</p>}
    </div>
  )
}

const runningActionText: Record<RunningPrescription['action'], string> = {
  start: 'Start where you are: easy pace',
  build: 'Build: long run a little longer than your longest recent run',
  repeat: 'Repeat last week: it felt hard, so no increase',
  regress: 'Pain reported → shorter, easy runs only',
  goalReached: 'Goal duration reached: keep it easy and consistent',
}

function RunningBlock({ p }: { p: RunningPrescription }) {
  return (
    <div className="program-block">
      <strong>{runningActionText[p.action]}</strong>
      <p className="big tabular">
        {p.runs} easy runs: {formatDuration(p.longRunSec)}
        {p.runs > 1 ? ` + ${formatDuration(p.shortRunSec)}` : ''}
      </p>
      <ul className="small">
        <li>Talk test: you can speak in full sentences the whole time.</li>
        <li>
          No single run over <strong>{formatDuration(p.capSec)}</strong> this week (longest of the last 30 days +10%).
        </li>
        <li>Flat terrain preferred. No intervals until a speed goal exists.</li>
      </ul>
    </div>
  )
}

const cyclingActionText: Record<CyclingPrescription['action'], string> = {
  build: 'Build week: volume +≤10%',
  recovery: 'Recovery week: ~30% less volume',
  regress: 'Pain reported: easy riding only, less volume',
  hold: 'Hold volume steady this week',
}

function CyclingBlock({ p }: { p: CyclingPrescription }) {
  return (
    <div className="program-block">
      <strong>{cyclingActionText[p.action]}</strong>
      <p className="big tabular">{p.weeklyMinutes} min across {p.rides} rides</p>
      <ul className="small">
        <li>
          Long ride: <strong>{formatKm(p.longRideM)}</strong> easy (conversational pace)
        </li>
        <li>{p.easyMinutes} min easy (RPE 3–4, can talk in full sentences)</li>
        {p.hardMinutes > 0 && <li>{p.hardMinutes} min hard intervals (RPE 7–8), e.g. 4–5 × 4 min</li>}
      </ul>
    </div>
  )
}

interface Props {
  program: WeekProgram
  metric: GoalMetric
  names: Names
}

export function ProgramCard({ program, metric, names }: Props) {
  const adjustments = activeAdjustments(program.modifier)
  const { item } = program
  return (
    <section className="card" aria-label="This week's program">
      <div className="row spread wrap">
        <h3>This week's program</h3>
        <span className="small muted">
          Week of {formatDate(program.weekOf)} · {program.sessionsPerWeek}×/week
        </span>
      </div>
      {program.nextMilestone ? (
        <p className="small">
          Next milestone: <strong>{formatMetric(metric, program.nextMilestone.targetValue)}</strong> by{' '}
          {formatDate(program.nextMilestone.targetDate)}
        </p>
      ) : (
        <p className="small">🏆 Goal reached! Set a new one to keep going.</p>
      )}
      {adjustments.map((a) => (
        <p key={a} className={`notice small ${program.modifier.paused ? 'pain' : ''}`}>
          {a}
        </p>
      ))}
      {item.kind === 'strength' && <StrengthBlock p={item.prescription} names={names} />}
      {item.kind === 'reps' && <RepsBlock p={item.prescription} weighted={item.weighted} names={names} />}
      {item.kind === 'timed' && <TimedBlock p={item.prescription} names={names} />}
      {item.kind === 'running' && <RunningBlock p={item.prescription} />}
      {item.kind === 'cycling' && <CyclingBlock p={item.prescription} />}
      {item.kind === 'unsupported' && <p className="muted">No program model for this exercise yet.</p>}
    </section>
  )
}
