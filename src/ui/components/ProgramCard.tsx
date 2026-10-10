import type { GoalMetric } from '../../domain/models'
import type { WeekProgram } from '../../domain/program'
import type { CyclingPrescription } from '../../domain/progression/cycling'
import type { RepsPrescription } from '../../domain/progression/endurance-reps'
import type { StrengthPrescription } from '../../domain/progression/strength'
import {
  activeAdjustments,
  exerciseName,
  formatDate,
  formatKg,
  formatKm,
  formatMetric,
  strengthActionText,
  strengthNoteText,
} from '../format'

function StrengthBlock({ p, title }: { p: StrengthPrescription; title?: string }) {
  const [lo, hi] = p.repRange
  return (
    <div className="program-block">
      <strong>{title ?? exerciseName(p.exerciseId)}</strong>
      <p className="big tabular">
        {p.sets} × {lo}–{hi} reps @ {formatKg(p.loadKg)}
      </p>
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

function RepsBlock({ p, weighted }: { p: RepsPrescription; weighted?: StrengthPrescription }) {
  return (
    <>
      <div className="program-block">
        <strong>
          {exerciseName(p.exerciseId)} · week {p.weekInCycle + 1} of cycle
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
      {weighted && p.action !== 'regress' && <StrengthBlock p={weighted} title={`${exerciseName(weighted.exerciseId)} (Day A)`} />}
      {p.accessories.length > 0 && (
        <div className="program-block">
          <strong>Accessories (both days)</strong>
          <p className="small">{p.accessories.map(exerciseName).join(' · ')}: 2–3 × 12–15, easy.</p>
        </div>
      )}
    </>
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

export function ProgramCard({ program, metric }: { program: WeekProgram; metric: GoalMetric }) {
  const adjustments = activeAdjustments(program.modifier)
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
      {program.item.kind === 'strength' && <StrengthBlock p={program.item.prescription} />}
      {program.item.kind === 'reps' && <RepsBlock p={program.item.prescription} weighted={program.item.weighted} />}
      {program.item.kind === 'cycling' && <CyclingBlock p={program.item.prescription} />}
      {program.item.kind === 'unsupported' && <p className="muted">No program model for this exercise yet.</p>}
    </section>
  )
}
