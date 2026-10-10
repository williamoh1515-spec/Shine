import { describe, expect, it } from 'vitest'
import { activeModifier, lastPainDate } from './checkIn'
import { checkIn, session, sets } from './testUtils'

describe('activeModifier', () => {
  it('is neutral without check-ins', () => {
    const m = activeModifier('strength', undefined, [], [])
    expect(m.paused).toBe(false)
    expect(m.lighterLoad).toBe(false)
  })

  it('pauses progression after a pain check-in until a later pain-free session', () => {
    const pain = checkIn('2026-10-05', 'pain')
    expect(activeModifier('strength', undefined, [], [pain]).paused).toBe(true)
    const painful = session('2026-10-07', sets('box-squat', 60, [5]), { painFlag: true })
    expect(activeModifier('strength', undefined, [painful], [pain]).paused).toBe(true)
    const fine = session('2026-10-09', sets('box-squat', 50, [5]))
    expect(activeModifier('strength', undefined, [painful, fine], [pain]).paused).toBe(false)
  })

  it('treats a session pain flag like a pain report', () => {
    const painful = session('2026-10-07', sets('box-squat', 60, [5]), { painFlag: true })
    expect(lastPainDate('strength', [painful], [])).toBe('2026-10-07')
    expect(activeModifier('strength', undefined, [painful], []).paused).toBe(true)
  })

  it('only affects the window it was reported in', () => {
    expect(activeModifier('cycling', undefined, [], [checkIn('2026-10-05', 'pain')]).paused).toBe(false)
  })

  it('applies "too hard" until the next session is logged', () => {
    const c = checkIn('2026-10-05', 'tooHard')
    expect(activeModifier('strength', undefined, [], [c]).lighterLoad).toBe(true)
    const later = session('2026-10-06', sets('box-squat', 60, [5]))
    expect(activeModifier('strength', undefined, [later], [c]).lighterLoad).toBe(false)
  })

  it('never lets "too easy" override pain', () => {
    const m = activeModifier('strength', undefined, [], [checkIn('2026-10-05', 'pain'), checkIn('2026-10-05', 'tooEasy')])
    expect(m.paused).toBe(true)
    expect(m.forceProgress).toBe(false)
  })

  it('maps plateau and missed sessions', () => {
    const m = activeModifier('strength', undefined, [], [checkIn('2026-10-05', 'plateau'), checkIn('2026-10-05', 'missedSessions')])
    expect(m.suggestDeload).toBe(true)
    expect(m.replanDates).toBe(true)
  })
})
