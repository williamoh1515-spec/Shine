import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import { exercisesById } from '../config/windows.config'
import { createGoal } from './goals'
import { buildWeekProgram } from './program'
import { checkIn, session, sets } from './testUtils'

function goalFor(exerciseId: string, windowId: string, baseline: number, target: number) {
  return createGoal(
    {
      id: exerciseId, windowId, exercise: exercisesById[exerciseId]!, title: '', baseline,
      baselineSource: 'test', target, startDate: '2026-10-05', sessionsPerWeek: 2,
    },
    progressionConfig,
  )
}

const base = { exercises: exercisesById, checkIns: [], today: '2026-10-07', config: progressionConfig }

describe('buildWeekProgram', () => {
  it('builds a strength program toward the next milestone', () => {
    const p = buildWeekProgram({ ...base, goal: goalFor('box-squat', 'strength', 70, 90), windowSessions: [] })
    expect(p.weekOf).toBe('2026-10-05')
    expect(p.nextMilestone?.targetValue).toBe(75)
    expect(p.item.kind).toBe('strength')
  })

  it('builds a pull-up program with weighted work and rear-delt accessories', () => {
    const p = buildWeekProgram({ ...base, goal: goalFor('pull-up', 'strength', 10, 25), windowSessions: [] })
    if (p.item.kind !== 'reps') throw new Error('expected reps program')
    expect(p.item.prescription.accessories).toContain('face-pull')
    expect(p.item.weighted?.action).toBe('start')
    expect(p.item.weighted?.loadKg).toBe(2.5)
  })

  it('builds a cycling program', () => {
    const p = buildWeekProgram({ ...base, goal: goalFor('ride', 'cycling', 30000, 60000), windowSessions: [] })
    expect(p.item.kind).toBe('cycling')
  })

  it('pauses on pain and reflects it in the modifier', () => {
    const goal = goalFor('box-squat', 'strength', 70, 90)
    const p = buildWeekProgram({
      ...base,
      goal,
      windowSessions: [session('2026-10-05', sets('box-squat', 50, [8, 8, 8], 2))],
      checkIns: [checkIn('2026-10-06', 'pain')],
    })
    expect(p.modifier.paused).toBe(true)
    if (p.item.kind !== 'strength') throw new Error('expected strength program')
    expect(p.item.prescription.action).toBe('regress')
  })

  it('has no next milestone once the goal is reached', () => {
    const goal = goalFor('pull-up', 'strength', 10, 12)
    const p = buildWeekProgram({
      ...base,
      goal,
      windowSessions: [session('2026-10-06', [{ exerciseId: 'pull-up', reps: 13 }], { kind: 'test' })],
    })
    expect(p.nextMilestone).toBeUndefined()
    expect(p.currentValue).toBe(13)
  })
})
