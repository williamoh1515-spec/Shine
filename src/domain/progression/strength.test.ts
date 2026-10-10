import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../../config/progression.config'
import { NO_MODIFIER, type ProgressionModifier } from '../checkIn'
import type { Exercise, Session } from '../models'
import { session, sets } from '../testUtils'
import { isStalled, resolveStrengthParams, suggestStrength } from './strength'

const squat: Exercise = {
  id: 'box-squat',
  name: 'Box squat',
  progressionModel: 'strength',
  region: 'lower',
  regression: 'Higher box',
}
const params = resolveStrengthParams(squat, progressionConfig)

function suggest(windowSessions: Session[], modifier: ProgressionModifier = NO_MODIFIER, today = '2026-10-10') {
  return suggestStrength({
    exercise: squat,
    params,
    windowSessions,
    currentE1rm: 80,
    modifier,
    programStart: '2026-10-01',
    today,
  })
}

describe('resolveStrengthParams', () => {
  it('uses the lower-body increment and per-exercise overrides', () => {
    expect(params.loadIncrementKg).toBe(5)
    const custom = resolveStrengthParams(
      { ...squat, overrides: { loadIncrementKg: 2.5, repRange: [8, 12] } },
      progressionConfig,
    )
    expect(custom.loadIncrementKg).toBe(2.5)
    expect(custom.repRange).toEqual([8, 12])
  })
})

describe('suggestStrength', () => {
  it('starts at ~75% of e1RM rounded down to the increment', () => {
    const p = suggest([])
    expect(p.action).toBe('start')
    expect(p.loadKg).toBe(60)
  })

  it('flags a zero baseline', () => {
    const p = suggestStrength({
      exercise: squat, params, windowSessions: [], currentE1rm: 0, modifier: NO_MODIFIER,
      programStart: '2026-10-01', today: '2026-10-10',
    })
    expect(p.loadKg).toBe(0)
    expect(p.notes).toContain('zeroBaseline')
  })

  it('adds load when every set hits the top of the range with RIR in reserve', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 60, [8, 8, 8], 2))])
    expect(p.action).toBe('increaseLoad')
    expect(p.loadKg).toBe(65)
    expect(p.sets).toBe(params.workingSets)
  })

  it('keeps the load and asks for more reps below the top of the range', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 60, [8, 7, 6], 2))])
    expect(p.action).toBe('addReps')
    expect(p.loadKg).toBe(60)
  })

  it('does not progress when the sets were too close to failure', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 60, [8, 8, 8], 0))])
    expect(p.action).toBe('addReps')
  })

  it('still progresses with missing RIR but asks to log it', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 60, [8, 8, 8]))])
    expect(p.action).toBe('increaseLoad')
    expect(p.notes).toContain('rirMissing')
  })

  it('resets ~10% after a stall of 3 sessions', () => {
    const history = ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08'].map((d) =>
      session(d, sets('box-squat', 70, [6, 6, 5], 2)),
    )
    const p = suggest(history)
    expect(p.action).toBe('stallReset')
    expect(p.loadKg).toBe(60) // 63 rounded down to 5 kg steps
    expect(p.regression).toBe('Higher box')
  })

  it('deloads on a stall combined with low feeling', () => {
    const history = ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08'].map((d) =>
      session(d, sets('box-squat', 70, [6, 6, 5], 2), { feeling: 2 }),
    )
    const p = suggest(history)
    expect(p.action).toBe('deload')
    expect(p.notes).toContain('lowFeeling')
  })

  it('schedules a planned deload after the configured weeks, with fewer sets and the same load', () => {
    const p = suggest([session('2026-11-10', sets('box-squat', 60, [8, 8, 8], 2))], NO_MODIFIER, '2026-11-12')
    expect(p.action).toBe('deload')
    expect(p.notes).toContain('plannedDeload')
    expect(p.loadKg).toBe(60)
    expect(p.sets).toBeLessThan(params.workingSets)
  })

  it('a logged deload resets the deload clock', () => {
    const p = suggest(
      [
        session('2026-11-05', sets('box-squat', 60, [5, 5], 3), { kind: 'deload' }),
        session('2026-11-10', sets('box-squat', 60, [8, 8, 8], 2)),
      ],
      NO_MODIFIER,
      '2026-11-12',
    )
    expect(p.action).toBe('increaseLoad')
  })

  it('regresses and pauses progression on pain', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 60, [8, 8, 8], 2))], { ...NO_MODIFIER, paused: true })
    expect(p.action).toBe('regress')
    expect(p.loadKg).toBe(45) // 48 rounded down
    expect(p.regression).toBe('Higher box')
  })

  it('goes lighter after a "too hard" check-in', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 60, [8, 8, 8], 2))], { ...NO_MODIFIER, lighterLoad: true })
    expect(p.action).toBe('lighter')
    expect(p.loadKg).toBe(50)
  })

  it('never raises load and sets together', () => {
    const all = [
      suggest([session('2026-10-08', sets('box-squat', 60, [8, 8, 8], 2))]),
      suggest([session('2026-10-08', sets('box-squat', 60, [5, 5, 5], 2))], { ...NO_MODIFIER, forceProgress: true }),
    ]
    for (const p of all) expect(p.sets).toBeLessThanOrEqual(params.workingSets)
  })

  it('ignores test sessions for double progression', () => {
    const p = suggest([session('2026-10-08', sets('box-squat', 80, [1]), { kind: 'test' })])
    expect(p.action).toBe('start')
  })
})

describe('isStalled', () => {
  const perf = (loadKg: number, totalReps: number) => ({ date: '', loadKg, sets: [], totalReps })
  it('needs enough history', () => {
    expect(isStalled([perf(60, 20), perf(60, 20)], 3)).toBe(false)
  })
  it('detects no improvement and accepts any improvement', () => {
    expect(isStalled([perf(60, 20), perf(60, 20), perf(60, 19), perf(60, 20)], 3)).toBe(true)
    expect(isStalled([perf(60, 20), perf(60, 20), perf(60, 21), perf(60, 20)], 3)).toBe(false)
  })
})
