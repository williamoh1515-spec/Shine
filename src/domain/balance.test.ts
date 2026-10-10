import { describe, expect, it } from 'vitest'
import { balanceConfig, balancePairs } from '../config/balance.config'
import { exercisesById } from '../config/windows.config'
import { evaluateBalance, latestStrength, weeklySets } from './balance'
import type { Session } from './models'
import { session, sets } from './testUtils'

const today = '2026-10-10'
const pair = (id: string) => balancePairs.find((p) => p.id === id)!
const run = (sessions: Session[], ids = ['hamstrings-quads']) =>
  evaluateBalance(ids.map(pair), sessions, exercisesById, today, balanceConfig)

describe('weeklySets', () => {
  it('counts sets per week for the muscles an exercise trains, skipping deloads and old sessions', () => {
    const log = [
      session('2026-10-01', sets('back-squat', 80, [5, 5, 5])), // quads + glutes
      session('2026-10-03', sets('nordic-curl', 0, [4, 4])), // hamstrings
      session('2026-10-05', sets('back-squat', 70, [5, 5]), { kind: 'deload' }),
      session('2026-08-01', sets('back-squat', 80, [5, 5, 5])), // too old
    ]
    expect(weeklySets(log, exercisesById, ['quads'], today, 4)).toBe(3 / 4)
    expect(weeklySets(log, exercisesById, ['hamstrings'], today, 4)).toBe(2 / 4)
    // A set counts once per side even if the exercise trains several muscles of that side.
    expect(weeklySets(log, exercisesById, ['quads', 'glutes'], today, 4)).toBe(3 / 4)
  })

  it('counts timed sets', () => {
    const log = [session('2026-10-05', [{ exerciseId: 'copenhagen-plank', durationSec: 20 }, { exerciseId: 'copenhagen-plank', durationSec: 20 }])]
    expect(weeklySets(log, exercisesById, ['hipAdductors'], today, 4)).toBe(0.5)
  })
})

describe('latestStrength', () => {
  it('uses the best set of the most recent session within the window', () => {
    const log = [
      session('2026-09-20', sets('leg-curl', 60, [10])),
      session('2026-10-05', [...sets('leg-curl', 40, [12]), ...sets('leg-curl', 45, [10])]),
    ]
    expect(latestStrength(log, 'leg-curl', today, 8)).toBeCloseTo(45 * (1 + 10 / 30), 5)
    expect(latestStrength(log, 'leg-extension', today, 8)).toBeUndefined()
  })
})

describe('evaluateBalance', () => {
  it('flags low hamstrings from training volume and suggests fixes', () => {
    const log = ['2026-09-20', '2026-09-27', '2026-10-04'].map((d) => session(d, sets('back-squat', 80, [5, 5, 5, 5])))
    const [r] = run(log)
    expect(r?.volume?.verdict).toBe('lowA')
    expect(r?.fixes).toContain('nordic-curl')
  })

  it('accepts roughly equal volume', () => {
    const log = [session('2026-10-01', sets('back-squat', 80, [5, 5, 5])), session('2026-10-03', sets('nordic-curl', 0, [4, 4, 4]))]
    expect(run(log)[0]?.volume?.verdict).toBe('ok')
  })

  it('says nothing without enough data', () => {
    const [r] = run([])
    expect(r?.volume?.verdict).toBeUndefined()
    expect(r?.fixes).toEqual([])
  })

  it('prefers a measured strength ratio over set counts', () => {
    const log = [
      session('2026-10-01', sets('leg-extension', 60, [10])),
      session('2026-10-01', sets('leg-curl', 30, [10])), // 0.5 < 0.6
      session('2026-10-03', sets('nordic-curl', 0, [4, 4, 4, 4, 4, 4])), // lots of hamstring volume
    ]
    const [r] = run(log)
    expect(r?.measured?.ratio).toBeCloseTo(0.5, 5)
    expect(r?.measured?.verdict).toBe('lowA')
    expect(r?.fixes).toContain('nordic-curl')
  })

  it('accepts a healthy measured ratio', () => {
    const log = [session('2026-10-01', [...sets('leg-extension', 60, [10]), ...sets('leg-curl', 40, [10])])]
    expect(run(log)[0]?.measured?.verdict).toBe('ok')
  })

  it('accepts more pulling than pushing ("at least" pairs)', () => {
    const log = [session('2026-10-01', [...sets('barbell-row', 60, [8, 8, 8, 8, 8]), ...sets('bench-press', 50, [8, 8])])]
    expect(run(log, ['pull-push'])[0]?.volume?.verdict).toBe('ok')
    const pushHeavy = [session('2026-10-01', [...sets('barbell-row', 60, [8]), ...sets('bench-press', 50, [8, 8, 8, 8, 8])])]
    expect(run(pushHeavy, ['pull-push'])[0]?.volume?.verdict).toBe('lowA')
  })

  it('flags a shoulder external-rotation ratio above the healthy range as the other side', () => {
    const log = [session('2026-10-01', [...sets('cable-external-rotation', 10, [12]), ...sets('cable-internal-rotation', 10, [12])])]
    expect(run(log, ['shoulder-rotation'])[0]?.measured?.verdict).toBe('lowB') // 1.0 > 0.85
  })

  it('keeps info-only pairs (left : right) without verdicts', () => {
    const [r] = run([], ['left-right'])
    expect(r?.measured).toBeUndefined()
    expect(r?.volume).toBeUndefined()
  })

  it('only suggests exercises that exist and are not hidden', () => {
    const log = ['2026-09-20', '2026-09-27', '2026-10-04'].map((d) => session(d, sets('back-squat', 80, [5, 5, 5, 5])))
    const hidden = { ...exercisesById, 'nordic-curl': { ...exercisesById['nordic-curl']!, hidden: true } }
    const [r] = evaluateBalance([pair('hamstrings-quads')], log, hidden, today, balanceConfig)
    expect(r?.fixes).not.toContain('nordic-curl')
    expect(r?.fixes.length).toBeGreaterThan(0)
  })
})

describe('catalog consistency', () => {
  it('every pairWith and fix points at a real exercise', () => {
    const ids = new Set(Object.keys(exercisesById))
    for (const e of Object.values(exercisesById)) for (const p of e.pairWith ?? []) expect(ids.has(p), `${e.id} → ${p}`).toBe(true)
    for (const p of balancePairs) {
      for (const f of [...p.a.fixes, ...p.b.fixes]) expect(ids.has(f), `${p.id} fix ${f}`).toBe(true)
      if (p.strength) expect(ids.has(p.strength.testA) && ids.has(p.strength.testB)).toBe(true)
    }
  })
})
