import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import {
  buildMilestones,
  evaluateReplan,
  initialPlan,
  milestoneStatuses,
  projectedValueOn,
} from './milestones'
import type { Goal } from './models'

const fractions = progressionConfig.milestones.fractions

describe('buildMilestones', () => {
  it('splits 70 → 90 kg into rounded milestones with conservative dates', () => {
    const ms = buildMilestones({
      baseline: 70,
      target: 90,
      startDate: '2026-10-01',
      weeklyRate: 1,
      roundTo: 2.5,
      fractions,
    })
    expect(ms.map((m) => m.targetValue)).toEqual([75, 80, 85, 87.5, 90])
    // 5 kg at 1 kg/week = 5 weeks
    expect(ms[0]?.targetDate).toBe('2026-11-05')
    expect(ms.at(-1)?.targetDate).toBe('2027-02-18')
  })

  it('handles a zero baseline', () => {
    const ms = buildMilestones({ baseline: 0, target: 4, startDate: '2026-10-01', weeklyRate: 0.5, roundTo: 1, fractions })
    expect(ms.map((m) => m.targetValue)).toEqual([1, 2, 3, 4])
  })

  it('returns a single reached milestone when the goal is already met', () => {
    const ms = buildMilestones({ baseline: 30, target: 25, startDate: '2026-10-01', weeklyRate: 0.5, roundTo: 1, fractions })
    expect(ms).toEqual([{ index: 0, fraction: 1, targetValue: 25, targetDate: '2026-10-01' }])
  })

  it('drops duplicate milestones when the gap is smaller than the rounding step', () => {
    const ms = buildMilestones({ baseline: 10, target: 12, startDate: '2026-10-01', weeklyRate: 0.5, roundTo: 1, fractions })
    expect(ms.map((m) => m.targetValue)).toEqual([11, 12])
  })

  it('rejects a non-positive rate', () => {
    expect(() =>
      buildMilestones({ baseline: 1, target: 2, startDate: '2026-10-01', weeklyRate: 0, roundTo: 1, fractions }),
    ).toThrow()
  })
})

describe('re-planning', () => {
  const plan = initialPlan({ baseline: 10, target: 25, startDate: '2026-10-01', weeklyRate: 0.5, roundTo: 1, fractions })

  it('interpolates the projected value', () => {
    expect(projectedValueOn(plan, '2026-10-01')).toBe(10)
    // 4 weeks at 0.5/week ≈ 12
    expect(projectedValueOn(plan, '2026-10-29')).toBeCloseTo(12, 0)
  })

  it('keeps the plan when on track', () => {
    expect(evaluateReplan(plan, 12, '2026-10-29', 0.5, 2)).toBeUndefined()
  })

  it('re-plans when ≥ 2 weeks ahead, keeping only remaining milestones', () => {
    const next = evaluateReplan(plan, 15, '2026-10-29', 0.5, 2)
    expect(next?.reason).toBe('ahead')
    expect(next?.fromValue).toBe(15)
    expect(next?.milestones.every((m) => m.targetValue > 15)).toBe(true)
  })

  it('re-plans when ≥ 2 weeks behind', () => {
    expect(evaluateReplan(plan, 10, '2026-11-26', 0.5, 2)?.reason).toBe('behind')
  })

  it('never re-plans a finished goal', () => {
    expect(evaluateReplan(plan, 25, '2026-11-26', 0.5, 2)).toBeUndefined()
  })

  it('reports when each milestone was hit', () => {
    const goal: Goal = {
      id: 'g', windowId: 'strength', exerciseId: 'pull-up', title: '', metric: 'maxReps',
      baseline: 10, baselineSource: 'test', target: 25, startDate: '2026-10-01', sessionsPerWeek: 2,
      plans: [plan],
    }
    const statuses = milestoneStatuses(goal, [
      { date: '2026-10-10', value: 13 },
      { date: '2026-10-20', value: 15 },
    ])
    expect(statuses.map((s) => s.milestone.targetValue)).toEqual([14, 18, 21, 24, 25])
    expect(statuses[0]?.hitOn).toBe('2026-10-20')
    expect(statuses[1]?.hitOn).toBeUndefined()
  })
})
