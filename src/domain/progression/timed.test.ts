import { describe, expect, it } from 'vitest'
import { progressionConfig } from '../../config/progression.config'
import { NO_MODIFIER, type ProgressionModifier } from '../checkIn'
import type { Exercise, Session } from '../models'
import { session } from '../testUtils'
import { suggestTimed } from './timed'

const carry: Exercise = {
  id: 'carry',
  name: 'Suitcase carry',
  progressionModel: 'timed',
  loadType: 'kettlebell',
  overrides: { maxHoldSec: 45 },
  regression: 'Lighter bell, shorter walk',
}
const holds = (date: string, loadKg: number, secs: number[]): Session =>
  session(date, secs.map((s) => ({ exerciseId: 'carry', loadKg, durationSec: s })))

function suggest(history: Session[], modifier: ProgressionModifier = NO_MODIFIER, exercise = carry) {
  return suggestTimed({
    exercise,
    config: progressionConfig.timed,
    windowSessions: history,
    loads: [4, 8, 12, 16],
    loadIncrementKg: 4,
    startLoadKg: 12,
    modifier,
  })
}

describe('suggestTimed', () => {
  it('starts at the start hold with the given load', () => {
    expect(suggest([])).toMatchObject({ action: 'start', seconds: 20, loadKg: 12 })
  })

  it('adds a few seconds, based on the shortest set', () => {
    expect(suggest([holds('2026-10-05', 12, [30, 25, 30])])).toMatchObject({ action: 'addTime', seconds: 30, loadKg: 12 })
  })

  it('never goes past the max hold', () => {
    expect(suggest([holds('2026-10-05', 12, [44, 44, 44])]).seconds).toBe(45)
  })

  it('moves to the next bell and restarts the hold once every set hits the max', () => {
    expect(suggest([holds('2026-10-05', 12, [45, 45, 45])])).toMatchObject({ action: 'increaseLoad', loadKg: 16, seconds: 20 })
  })

  it('reports maxed out at the heaviest bell', () => {
    expect(suggest([holds('2026-10-05', 16, [45, 45, 45])]).action).toBe('maxed')
  })

  it('holds steady after "too hard" and regresses on pain', () => {
    expect(suggest([holds('2026-10-05', 12, [30, 30, 30])], { ...NO_MODIFIER, lighterLoad: true })).toMatchObject({ action: 'hold', seconds: 30 })
    expect(suggest([holds('2026-10-05', 12, [30, 30, 30])], { ...NO_MODIFIER, paused: true })).toMatchObject({ action: 'regress', loadKg: 0 })
  })

  it('treats bodyweight holds as maxed at the max hold', () => {
    const plank: Exercise = { id: 'carry', name: 'Side plank', progressionModel: 'timed', loadType: 'bodyweight' }
    expect(suggest([holds('2026-10-05', 0, [60, 60, 60])], NO_MODIFIER, plank).action).toBe('maxed')
  })
})
