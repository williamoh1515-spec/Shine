import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import { exercisesById } from '../config/windows.config'
import { createGoal, metricFor, projectionFor, suggestTarget } from './goals'
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

  it('projects with conservative rates and plate rounding', () => {
    expect(projectionFor('oneRepMaxKg', boxSquat, progressionConfig)).toEqual({ weeklyRate: 1, roundTo: 5 })
    expect(projectionFor('maxReps', pullUp, progressionConfig).roundTo).toBe(1)
  })

  it('suggests a target above the baseline, rounded up', () => {
    expect(suggestTarget('oneRepMaxKg', 80, 5)).toBe(95)
    expect(suggestTarget('maxReps', 10, 1)).toBe(15)
    expect(suggestTarget('maxReps', 0, 1)).toBe(1)
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
