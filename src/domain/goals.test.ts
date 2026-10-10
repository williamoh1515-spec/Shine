import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import { exercisesById } from '../config/windows.config'
import { changeGoalTarget, createGoal, metricFor, projectionFor } from './goals'
import { earnedMilestoneDates, milestoneStatuses } from './milestones'
import { currentGoalValue, goalProgress } from './metrics'
import { session, sets } from './testUtils'

const boxSquat = exercisesById['box-squat']!
const pullUp = exercisesById['pull-up']!

describe('goals', () => {
  it('derives the metric from the progression model', () => {
    expect(metricFor(boxSquat)).toBe('oneRepMaxKg')
    expect(metricFor(pullUp)).toBe('maxReps')
    expect(metricFor(exercisesById.ride!)).toBe('distanceM')
  })

  it('projects big lifts with the research prior (slowed for reachable dates) and plate rounding', () => {
    const intermediate = projectionFor('oneRepMaxKg', boxSquat, progressionConfig, { currentValue: 130, bodyMassKg: 80 })
    expect(intermediate.weeklyRate).toBeCloseTo((22 / 52.18) * 0.8, 4)
    expect(intermediate.roundTo).toBe(5)
    const novice = projectionFor('oneRepMaxKg', boxSquat, progressionConfig, { currentValue: 90, bodyMassKg: 80 })
    expect(novice.weeklyRate).toBeCloseTo(intermediate.weeklyRate * 2, 4)
    expect(projectionFor('maxReps', pullUp, progressionConfig).roundTo).toBe(1)
  })

  it('keeps the conservative region rate for lifts without research numbers', () => {
    expect(projectionFor('oneRepMaxKg', exercisesById['hip-thrust']!, progressionConfig)).toEqual({ weeklyRate: 1, roundTo: 5 })
  })

  it('creates a goal with an initial milestone plan', () => {
    const goal = createGoal(
      {
        id: 'g', windowId: 'strength', exercise: boxSquat, title: 'Box squat 90 kg',
        baseline: 70, baselineSource: 'manual', target: 90, startDate: '2026-10-01', sessionsPerWeek: 2,
      },
      progressionConfig,
    )
    expect(goal.metric).toBe('oneRepMaxKg')
    expect(goal.plans).toHaveLength(1)
    expect(goal.plans[0]?.milestones.map((m) => m.targetValue)).toEqual([75, 80, 85, 90])
  })

  it('tracks current value and progress from sessions', () => {
    const goal = createGoal(
      {
        id: 'g', windowId: 'strength', exercise: boxSquat, title: '', baseline: 70,
        baselineSource: 'manual', target: 90, startDate: '2026-10-01', sessionsPerWeek: 2,
      },
      progressionConfig,
    )
    const value = currentGoalValue(goal, [
      session('2026-09-01', sets('box-squat', 100, [5])), // before start: ignored
      session('2026-10-05', sets('box-squat', 70, [3])),
    ])
    expect(value).toBe(77)
    expect(goalProgress(goal, value)).toBeCloseTo(0.35)
    expect(goalProgress(goal, 200)).toBe(1)
    expect(goalProgress({ ...goal, target: 60 }, 70)).toBe(1)
  })
})

describe('changeGoalTarget', () => {
  const goal = createGoal(
    {
      id: 'g', windowId: 'strength', exercise: pullUp, title: '25 pull-ups', baseline: 10,
      baselineSource: 'test', target: 25, startDate: '2026-10-01', sessionsPerWeek: 2,
    },
    progressionConfig,
  )

  it('re-plans milestones from the current value to the new target and keeps history', () => {
    const changed = changeGoalTarget(goal, { target: 30, title: '30 pull-ups' }, 19, pullUp, '2026-11-01', progressionConfig)
    expect(changed.target).toBe(30)
    expect(changed.title).toBe('30 pull-ups')
    expect(changed.plans).toHaveLength(2)
    expect(changed.plans[1]).toMatchObject({ reason: 'manual', fromValue: 19, createdOn: '2026-11-01' })
    expect(changed.plans[1]?.milestones.at(-1)?.targetValue).toBe(30)
    expect(changed.plans[1]?.milestones.every((m) => m.targetValue > 19)).toBe(true)
  })

  it('accepts a lower target (the goal then counts as reached)', () => {
    const changed = changeGoalTarget(goal, { target: 15 }, 19, pullUp, '2026-11-01', progressionConfig)
    expect(changed.plans.at(-1)?.milestones).toEqual([{ index: 0, fraction: 1, targetValue: 15, targetDate: '2026-11-01' }])
  })

  it('refuses to change a completed goal', () => {
    expect(() => changeGoalTarget({ ...goal, completedOn: '2026-11-01' }, { target: 40 }, 25, pullUp, '2026-11-02', progressionConfig)).toThrow()
  })

  it('shows milestones toward the new target, but keeps milestones already earned', () => {
    const history = [
      { date: '2026-10-10', value: 14 },
      { date: '2026-10-20', value: 19 },
    ]
    const changed = changeGoalTarget(goal, { target: 30 }, 19, pullUp, '2026-11-01', progressionConfig)
    const shown = milestoneStatuses(changed, history)
    expect(shown.at(-1)?.milestone.targetValue).toBe(30)
    expect(shown.every((s) => s.hitOn === undefined)).toBe(true)
    // 14 and 18 were reached under the old target and still count.
    expect(earnedMilestoneDates(changed, history).sort()).toEqual(['2026-10-10', '2026-10-20'])
  })
})
