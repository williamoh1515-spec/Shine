import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import type { Exercise, Goal } from './models'
import { suggestGoalTarget, suggestNextGoal } from './naturalPace'
import { priorRate, trainingLevel } from './priors'

const n = progressionConfig.naturalProgress
const squat: Exercise = { id: 'back-squat', name: 'Back squat', progressionModel: 'strength', region: 'lower', loadType: 'plates', liftClass: 'squat' }
const bench: Exercise = { id: 'bench', name: 'Bench', progressionModel: 'strength', region: 'upper', loadType: 'plates', liftClass: 'horizontalPush' }
const dbPress: Exercise = {
  id: 'db-press', name: 'DB press', progressionModel: 'strength', region: 'upper', loadType: 'plates',
  liftClass: 'verticalPush', implementCount: 2, overrides: { loadIncrementKg: 2 },
}
const lunge: Exercise = { id: 'lunge', name: 'Lunge', progressionModel: 'strength', region: 'lower' }
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

describe('priorRate (per-lift research priors)', () => {
  it('expects squat to progress faster than bench at the same level', () => {
    const s = priorRate('oneRepMaxKg', squat, 130, 80, progressionConfig)
    const b = priorRate('oneRepMaxKg', bench, 90, 80, progressionConfig)
    expect(s.level).toBe('intermediate')
    expect(b.level).toBe('intermediate')
    expect(s.perWeek).toBeCloseTo(22 / 52.18, 4)
    expect(b.perWeek).toBeCloseTo(11.5 / 52.18, 4)
    expect(s.basis).toBe('research')
  })

  it('doubles for novices and halves for advanced lifters', () => {
    expect(priorRate('oneRepMaxKg', squat, 93, 80, progressionConfig).perWeek).toBeCloseTo((22 * 2) / 52.18, 4)
    expect(priorRate('oneRepMaxKg', squat, 170, 80, progressionConfig).perWeek).toBeCloseTo((22 * 0.5) / 52.18, 4)
  })

  it('splits a dumbbell lift over both dumbbells and flags the extrapolation', () => {
    const p = priorRate('oneRepMaxKg', dbPress, 19, 80, progressionConfig)
    expect(p.level).toBe('novice') // 38 kg total ÷ 80 = 0.475 < 0.65
    expect(p.perWeek).toBeCloseTo((6 * 2) / 52.18 / 2, 4)
    expect(p.basis).toBe('extrapolated')
  })

  it('uses the conservative heuristics for exercises without research numbers', () => {
    expect(priorRate('oneRepMaxKg', lunge, 50, 80, progressionConfig)).toEqual({ perWeek: 1, basis: 'heuristic' })
    expect(priorRate('maxReps', pullUp, 10, 80, progressionConfig).perWeek).toBe(0.5)
  })
})

describe('suggestGoalTarget', () => {
  it('suggests a novice squat target about 12 weeks ahead from the research prior', () => {
    const s = suggestGoalTarget('oneRepMaxKg', 93.3, squat, 80, progressionConfig)
    expect(s.level).toBe('novice')
    expect(s.personal).toBe(false)
    expect(s.target).toBe(105) // 93.3 + 0.84 kg/week × 12 → nearest 5 kg
  })

  it('moves by at least one step, e.g. one dumbbell step', () => {
    expect(suggestGoalTarget('oneRepMaxKg', 19, dbPress, 80, progressionConfig).target).toBe(21)
    expect(suggestGoalTarget('oneRepMaxKg', 0, squat, 80, progressionConfig).target).toBe(5)
  })

  it('lets a fast personal trend raise the suggestion', () => {
    const points = [85, 87, 89, 91, 93].map((value, i) => ({ date: ['2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03', '2026-10-10'][i]!, value }))
    const s = suggestGoalTarget('oneRepMaxKg', 93, squat, 80, progressionConfig, { points, today: '2026-10-10' })
    expect(s.personal).toBe(true)
    expect(s.target).toBe(110) // blended ~1.37 kg/week instead of 0.84
  })

  it('uses priors for reps, runs and rides', () => {
    expect(suggestGoalTarget('maxReps', 25, pullUp, 80, progressionConfig).target).toBe(31)
    expect(suggestGoalTarget('maxDurationSec', 2400, { ...pullUp, progressionModel: 'running' }, 80, progressionConfig).target).toBe(3120)
    expect(suggestGoalTarget('distanceM', 60000, { ...pullUp, progressionModel: 'cycling' }, 80, progressionConfig).target).toBe(84000)
  })
})

describe('suggestNextGoal', () => {
  const goal: Goal = {
    id: 'g', windowId: 'strength', exerciseId: 'pull-up', title: '25 pull-ups', metric: 'maxReps',
    baseline: 10, baselineSource: 'test', target: 25, startDate: '2026-10-01', sessionsPerWeek: 2, plans: [],
  }

  it('suggests only once the goal is reached, above any overshoot', () => {
    expect(suggestNextGoal(goal, 24, pullUp, 80, progressionConfig)).toBeUndefined()
    expect(suggestNextGoal(goal, 25, pullUp, 80, progressionConfig)?.target).toBe(31)
    expect(suggestNextGoal(goal, 30, pullUp, 80, progressionConfig)?.target).toBe(36)
  })

  it('does not suggest for a completed goal', () => {
    expect(suggestNextGoal({ ...goal, completedOn: '2026-12-01' }, 30, pullUp, 80, progressionConfig)).toBeUndefined()
  })
})
