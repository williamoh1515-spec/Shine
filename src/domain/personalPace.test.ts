import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../config/progression.config'
import { changeGoalTarget, createGoal } from './goals'
import type { ValuePoint } from './metrics'
import type { Exercise } from './models'
import { blendedRate, fastProgressSuggestion, observedRate } from './personalPace'
import { priorRate } from './priors'

const cfg = progressionConfig.personalPace
const weekly = (values: number[], start = '2026-09-12'): ValuePoint[] =>
  values.map((value, i) => ({ date: new Date(Date.parse(start) + i * 7 * 864e5).toISOString().slice(0, 10), value }))

describe('observedRate', () => {
  it('measures a clean trend per week', () => {
    const r = observedRate(weekly([85, 87, 89, 91, 93]), '2026-10-10', cfg)
    expect(r?.perWeek).toBeCloseTo(2, 5)
    expect(r?.points).toBe(5)
  })

  it('reads through noise', () => {
    expect(observedRate(weekly([85, 88, 86, 90, 91]), '2026-10-10', cfg)?.perWeek).toBeCloseTo(1.4, 5)
  })

  it('reports a flat line as zero', () => {
    expect(observedRate(weekly([90, 90, 90, 90]), '2026-10-03', cfg)?.perWeek).toBe(0)
  })

  it('needs enough sessions over enough weeks', () => {
    expect(observedRate(weekly([85, 87, 89]), '2026-10-10', cfg)).toBeUndefined()
    const twoWeeks = [85, 86, 87, 88].map((value, i) => ({ date: `2026-10-0${1 + i * 3}`, value }))
    expect(observedRate(twoWeeks, '2026-10-10', cfg)).toBeUndefined()
  })

  it('ignores sessions older than the lookback window', () => {
    const old = weekly([50, 52], '2026-06-01')
    expect(observedRate([...old, ...weekly([85, 87, 89, 91, 93])], '2026-10-10', cfg)?.points).toBe(5)
  })
})

describe('blendedRate', () => {
  it('is the prior without personal data and moves toward the personal pace with more sessions', () => {
    expect(blendedRate(0.5, undefined, cfg)).toBe(0.5)
    expect(blendedRate(0.5, { perWeek: 2, points: 6 }, cfg)).toBeCloseTo(1.25, 5)
    expect(blendedRate(0.5, { perWeek: 2, points: 1000 }, cfg)).toBeCloseTo(2, 1)
  })
})

describe('fastProgressSuggestion', () => {
  const squat: Exercise = { id: 'back-squat', name: 'Back squat', progressionModel: 'strength', region: 'lower', liftClass: 'squat' }
  const goal = createGoal(
    {
      id: 'g', windowId: 'strength', exercise: squat, title: 'Squat 100', metric: 'oneRepMaxKg', baseline: 85,
      baselineSource: 'test', target: 100, startDate: '2026-09-12', sessionsPerWeek: 2, bodyMassKg: 80,
    },
    progressionConfig,
  )
  const fast = weekly([85, 87, 89, 91, 93])
  const prior = priorRate('oneRepMaxKg', squat, 93, 80, progressionConfig).perWeek
  const suggest = (g = goal, history = fast, current = 93) =>
    fastProgressSuggestion(g, history, current, prior, 5, '2026-10-10', progressionConfig)

  it('proposes a higher goal when progress is clearly faster than expected', () => {
    const s = suggest()
    expect(s).toBeDefined()
    expect(s!.target).toBe(110) // 93 + ~1.37 kg/week × 12 → up to the next 5 kg
    expect(s!.ratio).toBeCloseTo(2 / prior, 3)
  })

  it('stays quiet when the goal already matches the pace', () => {
    expect(suggest({ ...goal, target: 110 })).toBeUndefined()
  })

  it('looks one training block ahead and caps the pace at maxRaiseFactor × expected', () => {
    const s = suggest()!
    expect(s.weeks).toBeLessThanOrEqual(progressionConfig.naturalProgress.horizonWeeks)
    expect(s.perWeek).toBeLessThanOrEqual(cfg.maxRaiseFactor * prior + 1e-9)
    expect(s.target).toBeLessThanOrEqual(93 + cfg.maxRaiseFactor * prior * s.weeks + 5)
  })

  it('does not propose another raise right after one is accepted (no loop)', () => {
    const s = suggest()!
    const raised = changeGoalTarget(goal, { target: s.target }, 93, squat, '2026-10-10', progressionConfig, 80, s.perWeek)
    expect(suggest(raised)).toBeUndefined()
  })

  it('does not inflate a far-away manual goal', () => {
    const far = changeGoalTarget(goal, { target: 200 }, 93, squat, '2026-10-10', progressionConfig, 80)
    expect(suggest(far)).toBeUndefined()
  })

  it('stays quiet at a normal pace', () => {
    expect(suggest(goal, weekly([85, 85.8, 86.6, 87.4, 88.2]), 88.2)).toBeUndefined()
  })

  it('stays quiet once the goal is reached or completed', () => {
    expect(suggest(goal, fast, 100)).toBeUndefined()
    expect(suggest({ ...goal, completedOn: '2026-10-10' })).toBeUndefined()
  })

  it('respects "Not now" until a newer session is logged', () => {
    expect(suggest({ ...goal, dismissedRaiseAt: '2026-10-10' })).toBeUndefined()
    expect(suggest({ ...goal, dismissedRaiseAt: '2026-10-05' })).toBeDefined()
  })

  it('never lowers a goal', () => {
    expect(suggest({ ...goal, target: 400 }, fast, 93)).toBeUndefined()
  })
})
