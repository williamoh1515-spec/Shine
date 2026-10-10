import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../../config/progression.config'
import { NO_MODIFIER, type ProgressionModifier } from '../checkIn'
import type { Session } from '../models'
import { session } from '../testUtils'
import { recentWeeklyMinutes, suggestCycling } from './cycling'

const ride = (date: string, minutes: number, km: number): Session =>
  session(date, [{ exerciseId: 'ride', durationSec: minutes * 60, distanceM: km * 1000 }], { windowId: 'cycling' })

function suggest(
  windowSessions: Session[],
  today: string,
  modifier: ProgressionModifier = NO_MODIFIER,
  currentLongestM = 30000,
) {
  return suggestCycling({
    config: progressionConfig.cycling,
    exerciseId: 'ride',
    windowSessions,
    currentLongestM,
    targetLongestM: 60000,
    sessionsPerWeek: 2,
    modifier,
    programStart: '2026-09-28',
    today,
  })
}

describe('recentWeeklyMinutes', () => {
  it('averages completed weeks that had riding', () => {
    const rides = [ride('2026-09-29', 60, 20), ride('2026-10-01', 60, 20), ride('2026-10-06', 100, 30)]
    expect(recentWeeklyMinutes(rides, 'ride', '2026-10-14', 3)).toBe(110)
  })
  it('is undefined with no history', () => {
    expect(recentWeeklyMinutes([], 'ride', '2026-10-14', 3)).toBeUndefined()
  })
})

describe('suggestCycling', () => {
  it('uses the default volume without history, growing ≤ 10%', () => {
    const p = suggest([], '2026-10-06')
    expect(p.action).toBe('build')
    expect(p.weeklyMinutes).toBeLessThanOrEqual(progressionConfig.cycling.defaultWeeklyMinutes * 1.1)
  })

  it('splits ~80/20 easy/hard', () => {
    const p = suggest([ride('2026-09-29', 100, 30)], '2026-10-06')
    expect(p.weeklyMinutes).toBe(110)
    expect(p.easyMinutes).toBe(88)
    expect(p.hardMinutes).toBe(22)
  })

  it('takes a recovery week every 4th week', () => {
    const p = suggest([ride('2026-10-13', 100, 30)], '2026-10-19')
    expect(p.action).toBe('recovery')
    expect(p.weeklyMinutes).toBe(70)
  })

  it('makes everything easy and reduces volume on pain', () => {
    const p = suggest([ride('2026-09-29', 100, 30)], '2026-10-06', { ...NO_MODIFIER, paused: true })
    expect(p.action).toBe('regress')
    expect(p.hardMinutes).toBe(0)
  })

  it('grows the long ride ≤ 10% and never past the target', () => {
    expect(suggest([], '2026-10-06').longRideM).toBe(33000)
    expect(suggest([], '2026-10-06', NO_MODIFIER, 58000).longRideM).toBe(60000)
  })

  it('falls back to a default long ride with a zero baseline', () => {
    expect(suggest([], '2026-10-06', NO_MODIFIER, 0).longRideM).toBe(22000)
  })
})
