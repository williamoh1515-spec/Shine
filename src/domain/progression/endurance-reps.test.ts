import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../../config/progression.config'
import { NO_MODIFIER, type ProgressionModifier } from '../checkIn'
import type { Exercise, Session } from '../models'
import { session } from '../testUtils'
import { suggestReps } from './endurance-reps'

const pullUp: Exercise = {
  id: 'pull-up',
  name: 'Pull-up',
  progressionModel: 'repsEndurance',
  regression: 'Band-assisted',
  accessories: ['face-pull'],
}

function suggest(
  currentMax: number,
  today: string,
  windowSessions: Session[] = [],
  modifier: ProgressionModifier = NO_MODIFIER,
) {
  return suggestReps({
    exercise: pullUp,
    config: progressionConfig.repsEndurance,
    windowSessions,
    currentMax,
    modifier,
    programStart: '2026-10-05',
    today,
  })
}

describe('suggestReps', () => {
  it('starts the cycle at ~50% of max with accessories', () => {
    const p = suggest(10, '2026-10-05')
    expect(p.action).toBe('build')
    expect(p.fraction).toBe(0.5)
    expect(p.reps).toBe(5)
    expect(p.accessories).toEqual(['face-pull'])
  })

  it('ramps the submax fraction each week, capped at 80%', () => {
    expect(suggest(10, '2026-10-19').fraction).toBeCloseTo(0.7)
    expect(suggest(10, '2026-10-26').fraction).toBeCloseTo(0.8)
  })

  it('schedules a max test every 4 weeks, counting from the last test', () => {
    expect(suggest(10, '2026-11-02').action).toBe('test')
    const test = session('2026-11-02', [{ exerciseId: 'pull-up', reps: 12 }], { kind: 'test' })
    const after = suggest(12, '2026-11-04', [test])
    expect(after.action).toBe('build')
    expect(after.weekInCycle).toBe(0)
  })

  it('regresses with a zero baseline', () => {
    const p = suggest(0, '2026-10-05')
    expect(p.action).toBe('regress')
    expect(p.regression).toBe('Band-assisted')
    expect(p.reps).toBeGreaterThanOrEqual(1)
  })

  it('regresses on pain and does not test', () => {
    const p = suggest(10, '2026-11-02', [], { ...NO_MODIFIER, paused: true })
    expect(p.action).toBe('regress')
    expect(p.fraction).toBe(0.5)
  })

  it('steps back on "too hard" and forward on "too easy"', () => {
    expect(suggest(10, '2026-10-12', [], { ...NO_MODIFIER, lighterLoad: true }).fraction).toBe(0.5)
    expect(suggest(10, '2026-10-12', [], { ...NO_MODIFIER, forceProgress: true }).fraction).toBeCloseTo(0.7)
  })

  it('halves the sets on a deload', () => {
    const p = suggest(10, '2026-10-12', [], { ...NO_MODIFIER, suggestDeload: true })
    expect(p.action).toBe('deload')
    expect(p.sets).toBeLessThan(progressionConfig.repsEndurance.submaxSets)
  })
})
