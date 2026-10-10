import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import type { Exercise, Goal } from './models'
import { naturalGain, suggestGoalTarget, suggestNextGoal, trainingLevel } from './naturalPace'

const n = progressionConfig.naturalProgress
const squat: Exercise = { id: 'back-squat', name: 'Back squat', progressionModel: 'strength', region: 'lower', loadType: 'plates', liftClass: 'squat' }
const dbPress: Exercise = {
  id: 'db-press', name: 'DB press', progressionModel: 'strength', region: 'upper', loadType: 'plates',
  liftClass: 'verticalPush', implementCount: 2, overrides: { loadIncrementKg: 2 },
}
const pullUp: Exercise = { id: 'pull-up', name: 'Pull-up', progressionModel: 'repsEndurance' }

describe('trainingLevel', () => {
  it('judges level from bodyweight ratio', () => {
    expect(trainingLevel('squat', 93, 80, n)).toBe('novice') // 1.16×
    expect(trainingLevel('squat', 120, 80, n)).toBe('intermediate') // 1.5×
    expect(trainingLevel('squat', 160, 80, n)).toBe('advanced') // 2.0×
  })

  it('falls back to the default level when inputs are missing', () => {
    expect(trainingLevel(undefined, 100, 80, n)).toBe(n.defaultLevel)
    expect(trainingLevel('squat', 100, undefined, n)).toBe(n.defaultLevel)
    expect(trainingLevel('squat', 0, 80, n)).toBe(n.defaultLevel)
  })
})

describe('naturalGain', () => {
  it('scales with level and time', () => {
    const novice = naturalGain(100, 'novice', 12, n)
    expect(novice).toBeCloseTo(100 * 0.06 * (12 / 4.345), 5)
    expect(naturalGain(100, 'advanced', 12, n)).toBeLessThan(naturalGain(100, 'intermediate', 12, n))
    expect(naturalGain(100, 'intermediate', 12, n)).toBeLessThan(novice)
    expect(naturalGain(100, 'novice', 0, n)).toBe(0)
  })
})

describe('suggestGoalTarget', () => {
  it('suggests a novice-paced squat target about 12 weeks ahead', () => {
    const s = suggestGoalTarget('oneRepMaxKg', 93.3, squat, 80, progressionConfig)
    expect(s.level).toBe('novice')
    expect(s.horizonWeeks).toBe(12)
    expect(s.target).toBe(110) // 93.3 + 16.6 → nearest 5 kg
  })

  it('counts both dumbbells when judging level, and rounds to the dumbbell step', () => {
    const s = suggestGoalTarget('oneRepMaxKg', 19, dbPress, 80, progressionConfig)
    expect(s.level).toBe('novice') // 38 kg total ÷ 80 = 0.475 < 0.65
    expect(s.target).toBe(22)
  })

  it('assumes the default level without bodyweight, and still moves up by at least one step', () => {
    const s = suggestGoalTarget('oneRepMaxKg', 40, squat, undefined, progressionConfig)
    expect(s.level).toBe('intermediate')
    expect(s.target).toBeGreaterThanOrEqual(45)
  })

  it('handles a zero current value with one step', () => {
    expect(suggestGoalTarget('oneRepMaxKg', 0, squat, 80, progressionConfig).target).toBe(5)
  })

  it('grows reps by a factor with a minimum step', () => {
    expect(suggestGoalTarget('maxReps', 25, pullUp, 80, progressionConfig).target).toBe(32)
    expect(suggestGoalTarget('maxReps', 3, pullUp, 80, progressionConfig).target).toBe(5)
  })

  it('grows durations and distances by their factors', () => {
    expect(suggestGoalTarget('maxDurationSec', 2400, { ...pullUp, progressionModel: 'running' }, 80, progressionConfig).target).toBe(2880)
    expect(suggestGoalTarget('distanceM', 60000, { ...pullUp, progressionModel: 'cycling' }, 80, progressionConfig).target).toBe(72000)
  })
})

describe('suggestNextGoal', () => {
  const goal: Goal = {
    id: 'g', windowId: 'strength', exerciseId: 'pull-up', title: '25 pull-ups', metric: 'maxReps',
    baseline: 10, baselineSource: 'test', target: 25, startDate: '2026-10-01', sessionsPerWeek: 2, plans: [],
  }

  it('suggests only once the goal is reached', () => {
    expect(suggestNextGoal(goal, 24, pullUp, 80, progressionConfig)).toBeUndefined()
    expect(suggestNextGoal(goal, 25, pullUp, 80, progressionConfig)?.target).toBe(32)
  })

  it('suggests above a goal that was overshot', () => {
    expect(suggestNextGoal(goal, 30, pullUp, 80, progressionConfig)?.target).toBe(38)
  })

  it('does not suggest for a goal already completed', () => {
    expect(suggestNextGoal({ ...goal, completedOn: '2026-12-01' }, 30, pullUp, 80, progressionConfig)).toBeUndefined()
  })
})
