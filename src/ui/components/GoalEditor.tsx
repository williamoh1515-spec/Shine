import { useMemo, useState } from 'react'
import { progressionConfig } from '../../config/progression.config'
import { createGoal, metricsFor, projectionFor, suggestTarget } from '../../domain/goals'
import type { Exercise, Goal, GoalMetric } from '../../domain/models'
import { newId } from '../../data/db'
import { formatDate, formatMetric, metricInputUnit, metricOptionText } from '../format'
import { Sheet } from './Sheet'

interface Props {
  windowId: string
  exercise: Exercise
  today: string
  onSave: (goal: Goal) => Promise<void>
  onClose: () => void
}

const num = (s: string) => Number(s.replace(',', '.'))
const valid = (s: string) => s.trim() !== '' && Number.isFinite(num(s))

export function GoalEditor({ windowId, exercise, today, onSave, onClose }: Props) {
  const metrics = metricsFor(exercise)
  const [metric, setMetric] = useState<GoalMetric>(metrics[0] ?? 'maxReps')
  const unit = metricInputUnit(metric, exercise.progressionModel)
  const usesLoad = exercise.loadType !== undefined && exercise.loadType !== 'bodyweight'

  const [baseline, setBaseline] = useState('')
  const [target, setTarget] = useState('')
  const [minReps, setMinReps] = useState(String(exercise.overrides?.repRange?.[0] ?? 5))
  const [startLoad, setStartLoad] = useState('')
  const [sessionsPerWeek, setSessionsPerWeek] = useState('2')
  const [fromTest, setFromTest] = useState(true)

  const preview = useMemo(() => {
    if (!valid(baseline) || !valid(target)) return undefined
    const t = num(target) * unit.factor
    return createGoal(
      {
        id: newId('goal'),
        windowId,
        exercise,
        metric,
        title: `${exercise.name}: ${formatMetric(metric, t)}${metric === 'workingLoadKg' ? ` × ${minReps}` : ''}`,
        baseline: num(baseline) * unit.factor,
        baselineSource: fromTest ? 'test' : 'manual',
        target: t,
        startDate: today,
        sessionsPerWeek: Math.min(7, Math.max(1, Math.round(num(sessionsPerWeek) || 2))),
        ...(metric === 'workingLoadKg' && valid(minReps) ? { minReps: Math.round(num(minReps)) } : {}),
        ...(usesLoad && valid(startLoad) ? { startLoadKg: num(startLoad) } : {}),
      },
      progressionConfig,
    )
  }, [baseline, target, sessionsPerWeek, fromTest, exercise, windowId, today, metric, minReps, startLoad, unit.factor, usesLoad])

  const suggest = () => {
    if (!valid(baseline)) return
    const { roundTo } = projectionFor(metric, exercise, progressionConfig)
    setTarget(String(suggestTarget(metric, num(baseline) * unit.factor, roundTo) / unit.factor))
  }

  return (
    <Sheet title={`Goal: ${exercise.name}`} onClose={onClose}>
      {metrics.length > 1 && (
        <label>
          What to improve
          <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
            {metrics.map((m) => (
              <option key={m} value={m}>
                {metricOptionText[m]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="row">
        <label className="grow">
          Now ({unit.label})
          <input inputMode="decimal" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
        </label>
        <label className="grow">
          Goal ({unit.label})
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
      </div>
      {(metric === 'workingLoadKg' || usesLoad) && (
        <div className="row">
          {metric === 'workingLoadKg' && (
            <label className="grow">
              For at least (reps)
              <input inputMode="numeric" value={minReps} onChange={(e) => setMinReps(e.target.value)} />
            </label>
          )}
          {usesLoad && (
            <label className="grow">
              Current working load (kg)
              <input inputMode="decimal" value={startLoad} onChange={(e) => setStartLoad(e.target.value)} placeholder="e.g. 16" />
            </label>
          )}
        </div>
      )}
      <div className="row wrap">
        <button onClick={suggest} disabled={!valid(baseline)}>
          💡 Suggest a goal
        </button>
        <label className="grow">
          Sessions per week
          <input inputMode="numeric" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} />
        </label>
      </div>
      <label className="row" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={fromTest} onChange={(e) => setFromTest(e.target.checked)} />
        Baseline comes from a test I did (otherwise marked as a manual estimate)
      </label>
      {preview && (
        <div className="card">
          <strong>Your milestones</strong>
          <ol className="small">
            {preview.plans[0]?.milestones.map((m) => (
              <li key={m.index}>
                {formatMetric(metric, m.targetValue)} by {formatDate(m.targetDate)}
              </li>
            ))}
          </ol>
          <p className="small muted">Dates use a deliberately conservative rate and re-plan automatically as you log.</p>
        </div>
      )}
      <button className="primary" disabled={!preview} onClick={() => preview && void onSave(preview).then(onClose)}>
        Start this goal
      </button>
    </Sheet>
  )
}
