import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../../config/progression.config'
import { NO_MODIFIER, type ProgressionModifier } from '../checkIn'
import type { Session } from '../models'
import { session } from '../testUtils'
import { longestRunSince, suggestRunning } from './running'

const run = (date: string, minutes: number): Session =>
  session(date, [{ exerciseId: 'run', durationSec: minutes * 60 }], { windowId: 'running' })

function suggest(history: Session[], modifier: ProgressionModifier = NO_MODIFIER, targetMin = 40) {
  return suggestRunning({
    config: progressionConfig.running,
    exerciseId: 'run',
    windowSessions: history,
    baselineSec: 25 * 60,
    targetSec: targetMin * 60,
    sessionsPerWeek: 2,
    modifier,
    today: '2026-10-10',
  })
}

describe('longestRunSince', () => {
  it('only looks inside the window', () => {
    const runs = [run('2026-08-01', 50), run('2026-09-20', 30), run('2026-10-05', 28)]
    expect(longestRunSince(runs, 'run', '2026-09-10', '2026-10-10')).toBe(30 * 60)
  })
})

describe('suggestRunning', () => {
  it('starts from the baseline without history', () => {
    expect(suggest([])).toMatchObject({ action: 'start', longRunSec: 25 * 60, shortRunSec: 20 * 60, runs: 2 })
  })

  it('builds ~5% beyond the longest run of the last 30 days', () => {
    const p = suggest([run('2026-09-25', 30), run('2026-10-05', 25)])
    expect(p.action).toBe('build')
    expect(p.longRunSec).toBe(32 * 60) // 31.5 → 32 min
    expect(p.longRunSec).toBeLessThanOrEqual(p.capSec)
  })

  it('never exceeds the single-run cap (+10%)', () => {
    const p = suggest([run('2026-10-05', 30)], { ...NO_MODIFIER, forceProgress: true })
    expect(p.longRunSec).toBeLessThanOrEqual(33 * 60)
  })

  it('ignores an old long run outside the 30-day window', () => {
    const p = suggest([run('2026-08-01', 60), run('2026-10-05', 30)])
    expect(p.longest30dSec).toBe(30 * 60)
  })

  it('repeats the week after "too hard"', () => {
    expect(suggest([run('2026-10-05', 30)], { ...NO_MODIFIER, lighterLoad: true })).toMatchObject({ action: 'repeat', longRunSec: 30 * 60 })
  })

  it('shortens runs on pain', () => {
    const p = suggest([run('2026-10-05', 30)], { ...NO_MODIFIER, paused: true })
    expect(p.action).toBe('regress')
    expect(p.longRunSec).toBeLessThan(30 * 60)
  })

  it('stops building at the goal', () => {
    expect(suggest([run('2026-10-05', 40)]).action).toBe('goalReached')
  })
})
