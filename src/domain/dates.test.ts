import { describe, expect, it } from 'vitest'
import { addDays, diffDays, monthKey, weekStart } from './dates'

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('diffs days', () => {
    expect(diffDays('2026-10-17', '2026-10-10')).toBe(7)
    expect(diffDays('2026-10-10', '2026-10-17')).toBe(-7)
  })

  it('finds the Monday of the week', () => {
    expect(weekStart('2026-10-10')).toBe('2026-10-05') // Saturday
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // Monday
    expect(weekStart('2026-10-11')).toBe('2026-10-05') // Sunday
  })

  it('gives the month key', () => {
    expect(monthKey('2026-10-10')).toBe('2026-10')
  })

  it('rejects invalid dates', () => {
    expect(() => addDays('not-a-date', 1)).toThrow()
  })
})
