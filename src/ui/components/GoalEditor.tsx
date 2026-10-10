import { useMemo, useState } from 'react'
import { progressionConfig } from '../../config/progression.config'
import { exercisesById } from '../../config/windows.config'
import { createGoal, metricFor, projectionFor, suggestTarget } from '../../domain/goals'
import type { Goal, GoalMetric } from '../../domain/models'
import { newId } from '../../data/db'
import { formatDate, formatMetric } from '../format'
import { Sheet } from './Sheet'

interface Props {
  windowId: string
  exerciseId: string
  today: string
  onSave: (goal: Goal) => Promise<void>
  onClose: () => void
}

const unitFor = { oneRepMaxKg: 'kg (1RM)', maxReps: 'reps', distanceM: 'km' } as const

// Distances are typed in km but stored in metres.
const toInput = (metric: GoalMetric, v: number) => (metric === 'distanceM' ? v / 1000 : v)
const fromInput = (metric: GoalMetric, v: number) => (metric === 'distanceM' ? v * 1000 : v)

export function GoalEditor({ windowId, exerciseId, today, onSave, onClose }: Props) {
  const exercise = exercisesById[exerciseId]
  const metric = exercise ? metricFor(exercise) : 'oneRepMaxKg'

  const [baseline, setBaseline] = useState('')
  const [target, setTarget] = useState('')
  const [sessionsPerWeek, setSessionsPerWeek] = useState('2')
  const [fromTest, setFromTest] = useState(true)

  const preview = useMemo(() => {
    const b = Number(baseline.replace(',', '.'))
    const t = Number(target.replace(',', '.'))
    if (!exercise || baseline === '' || target === '' || !Number.isFinite(b) || !Number.isFinite(t)) return undefined
    return createGoal(
      {
        id: newId('goal'),
        windowId,
        exercise,
        title: `${exercise.name}: ${formatMetric(metric, fromInput(metric, t))}`,
        baseline: fromInput(metric, b),
        baselineSource: fromTest ? 'test' : 'manual',
        target: fromInput(metric, t),
        startDate: today,
        sessionsPerWeek: Math.max(1, Math.round(Number(sessionsPerWeek) || 2)),
      },
      progressionConfig,
    )
  }, [baseline, target, sessionsPerWeek, fromTest, exercise, windowId, today, metric])

  if (!exercise) return null

  const suggest = () => {
    const b = Number(baseline.replace(',', '.'))
    if (!Number.isFinite(b)) return
    const { roundTo } = projectionFor(metric, exercise, progressionConfig)
    setTarget(String(toInput(metric, suggestTarget(metric, fromInput(metric, b), roundTo))))
  }

  return (
    <Sheet title={`Goal: ${exercise.name}`} onClose={onClose}>
      <div className="row">
        <label className="grow">
          Where you are now ({unitFor[metric]})
          <input inputMode="decimal" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
        </label>
        <label className="grow">
          Goal ({unitFor[metric]})
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
      </div>
      <div className="row wrap">
        <button onClick={suggest} disabled={baseline === ''}>
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
