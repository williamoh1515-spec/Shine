import { useMemo, useState } from 'react'
import { progressionConfig } from '../../config/progression.config'
import { saveGoal } from '../../data/repositories/training'
import { changeGoalTarget } from '../../domain/goals'
import type { Exercise, Goal } from '../../domain/models'
import { formatDate, formatMetric, metricInputUnit } from '../format'
import { Sheet } from './Sheet'

interface Props {
  goal: Goal
  exercise: Exercise
  currentValue: number
  today: string
  bodyMassKg?: number
  /** Prefilled new target in stored units, e.g. from "Raise goal". */
  suggestedTarget?: number
  /** Your own pace per week, to plan milestone dates (otherwise the research prior is used). */
  paceOverride?: number
  title?: string
  onClose: () => void
}

const num = (s: string) => Number(s.replace(',', '.'))
const valid = (s: string) => s.trim() !== '' && Number.isFinite(num(s)) && num(s) >= 0

/** Change the target of an open goal; milestones re-plan from where you are now. */
export function GoalChangeEditor({ goal, exercise, currentValue, today, bodyMassKg, suggestedTarget, paceOverride, title, onClose }: Props) {
  const unit = metricInputUnit(goal.metric, exercise.progressionModel)
  const shown = (stored: number) => String(Math.round((stored / unit.factor) * 100) / 100)
  const [target, setTarget] = useState(shown(suggestedTarget ?? goal.target))
  const [sessionsPerWeek, setSessionsPerWeek] = useState(String(goal.sessionsPerWeek))

  const preview = useMemo(() => {
    if (!valid(target)) return undefined
    const t = num(target) * unit.factor
    const oldText = formatMetric(goal.metric, goal.target)
    // Keep the user's own title, but update the number in it when it shows the old target.
    const newTitle = goal.title.includes(oldText) ? goal.title.replace(oldText, formatMetric(goal.metric, t)) : goal.title
    return changeGoalTarget(
      goal,
      { target: t, title: newTitle, sessionsPerWeek: Math.min(7, Math.max(1, Math.round(num(sessionsPerWeek) || goal.sessionsPerWeek))) },
      currentValue,
      exercise,
      today,
      progressionConfig,
      bodyMassKg,
      paceOverride,
    )
  }, [target, sessionsPerWeek, goal, currentValue, exercise, today, bodyMassKg, paceOverride, unit.factor])

  const newPlan = preview?.plans.at(-1)
  const reached = preview !== undefined && preview.target <= currentValue

  return (
    <Sheet title={title ?? 'Change goal'} onClose={onClose}>
      <p className="small">
        Now: <strong>{formatMetric(goal.metric, currentValue)}</strong> · current goal:{' '}
        <strong>{formatMetric(goal.metric, goal.target)}</strong>
      </p>
      <div className="row">
        <label className="grow">
          New goal ({unit.label})
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label style={{ width: 120 }}>
          Sessions/week
          <input inputMode="numeric" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} />
        </label>
      </div>
      {reached && <p className="notice small">That's at or below where you are now: the goal will count as reached.</p>}
      {newPlan && !reached && (
        <div className="card">
          <strong>New milestones</strong>
          <ol className="small">
            {newPlan.milestones.map((m) => (
              <li key={m.index}>
                {formatMetric(goal.metric, m.targetValue)} by {formatDate(m.targetDate)}
              </li>
            ))}
          </ol>
          <p className="small muted">
            {paceOverride !== undefined ? 'Dates follow your own logged pace. ' : 'Dates follow the expected pace for this lift. '}
            Milestones you already reached stay in your history and achievements.
          </p>
        </div>
      )}
      <button className="primary" disabled={!preview} onClick={() => preview && void saveGoal(preview).then(onClose)}>
        Save new goal
      </button>
    </Sheet>
  )
}
