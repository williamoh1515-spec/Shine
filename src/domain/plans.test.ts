import { describe, expect, it } from 'vitest'
import { balancePairs } from '../config/balance.config'
import { plans, plansById, planTimeConfig } from '../config/plans.config'
import { progressionConfig } from '../config/progression.config'
import { exercisesById } from '../config/windows.config'
import { createGoal } from './goals'
import { estimateMinutes, nextDay, planBalance, prescribeItem, type PlanItem } from './plans'
import { session, sets } from './testUtils'

const plan = plansById['legs-push-pull']!

describe('suggested plans', () => {
  it.each(plans.map((p) => [p.id, p] as const))('%s only uses exercises from the catalog', (_, p) => {
    for (const day of p.days) for (const item of day.items) expect(exercisesById[item.exerciseId], item.exerciseId).toBeDefined()
  })

  it.each(plans.map((p) => [p.id, p] as const))('%s is balanced on every opposite-muscle pair', (_, p) => {
    const result = planBalance(p, exercisesById, balancePairs)
    expect(result.length).toBeGreaterThan(0)
    for (const r of result) expect(r.ok, `${r.pairId}: ${r.a} vs ${r.b} sets`).toBe(true)
  })

  it.each(plans.map((p) => [p.id, p] as const))('%s fits in about an hour per session', (_, p) => {
    for (const day of p.days) {
      const min = estimateMinutes(day, exercisesById, planTimeConfig)
      expect(min, day.id).toBeGreaterThanOrEqual(45)
      expect(min, day.id).toBeLessThanOrEqual(65)
    }
  })

  it('has three days per plan (max three sessions a week)', () => {
    for (const p of plans) expect(p.days).toHaveLength(3)
  })
})

describe('nextDay', () => {
  it('starts with the first day and cycles through the plan', () => {
    expect(nextDay(plan, [])?.id).toBe('legs')
    const legs = session('2026-10-05', sets('back-squat', 80, [5]), { planId: plan.id, planDayId: 'legs' })
    expect(nextDay(plan, [legs])?.id).toBe('push')
    const pull = session('2026-10-09', sets('deadlift', 100, [5]), { planId: plan.id, planDayId: 'pull' })
    expect(nextDay(plan, [legs, pull])?.id).toBe('legs')
  })

  it('ignores sessions from other plans or without a plan', () => {
    const other = session('2026-10-05', sets('back-squat', 80, [5]), { planId: 'full-body-3', planDayId: 'b' })
    const loose = session('2026-10-06', sets('back-squat', 80, [5]))
    expect(nextDay(plan, [other, loose])?.id).toBe('legs')
  })
})

describe('prescribeItem', () => {
  const base = { checkIns: [], profile: { bodyMassKg: 80 }, exercises: exercisesById, windowId: 'strength', today: '2026-10-10', config: progressionConfig }
  const squatItem: PlanItem = { exerciseId: 'back-squat', sets: 3, reps: [5, 8], main: true }

  it('asks to find a starting weight without history', () => {
    const p = prescribeItem({ ...base, item: squatItem, exercise: exercisesById['back-squat']!, sessions: [] })
    expect(p).toMatchObject({ source: 'start', sets: 3, repRange: [5, 8] })
    expect(p.loadKg).toBeUndefined()
  })

  it('progresses from history with the plan rep range', () => {
    const history = [session('2026-10-07', sets('back-squat', 80, [8, 8, 8], 2))]
    const p = prescribeItem({ ...base, item: squatItem, exercise: exercisesById['back-squat']!, sessions: history })
    expect(p).toMatchObject({ source: 'history', action: 'increaseLoad', loadKg: 85, repRange: [5, 8] })
  })

  it("follows the exercise's goal when there is one", () => {
    const goal = createGoal(
      { id: 'g', windowId: 'strength', exercise: exercisesById['back-squat']!, title: 'Squat', baseline: 93, baselineSource: 'manual', target: 105, startDate: '2026-10-01', sessionsPerWeek: 2, bodyMassKg: 80 },
      progressionConfig,
    )
    const p = prescribeItem({ ...base, item: squatItem, exercise: exercisesById['back-squat']!, goal, sessions: [] })
    expect(p.source).toBe('goal')
    expect(p.loadKg).toBe(65) // 75% of 93 rounded down to 5 kg
  })

  it('prescribes holds for timed exercises', () => {
    const item: PlanItem = { exerciseId: 'copenhagen-plank', sets: 2, holdSec: [20, 30] }
    expect(prescribeItem({ ...base, item, exercise: exercisesById['copenhagen-plank']!, sessions: [] })).toMatchObject({ sets: 2, seconds: 20, source: 'start' })
    const history = [session('2026-10-07', [{ exerciseId: 'copenhagen-plank', durationSec: 22 }, { exerciseId: 'copenhagen-plank', durationSec: 22 }])]
    expect(prescribeItem({ ...base, item, exercise: exercisesById['copenhagen-plank']!, sessions: history })).toMatchObject({ seconds: 27, source: 'history' })
  })

  it('prefills bodyweight reps from last time', () => {
    const item: PlanItem = { exerciseId: 'hanging-knee-raise', sets: 3, reps: [8, 12] }
    expect(prescribeItem({ ...base, item, exercise: exercisesById['hanging-knee-raise']!, sessions: [] }).reps).toBe(8)
    const history = [session('2026-10-07', [{ exerciseId: 'hanging-knee-raise', reps: 11 }])]
    expect(prescribeItem({ ...base, item, exercise: exercisesById['hanging-knee-raise']!, sessions: history }).reps).toBe(11)
  })
})
