import { describe, expect, it } from 'vitest'
import { parseRoute } from './router'

describe('parseRoute', () => {
  it('parses the known routes', () => {
    expect(parseRoute('')).toEqual({ name: 'landing' })
    expect(parseRoute('#/')).toEqual({ name: 'landing' })
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' })
    expect(parseRoute('#/share')).toEqual({ name: 'share' })
    expect(parseRoute('#/w/strength/pull-up')).toEqual({ name: 'window', windowId: 'strength', exerciseId: 'pull-up' })
  })

  it('reads the join payload from the query, keeping base64url characters intact', () => {
    expect(parseRoute('#/join?p=eyJ2Ijox-_abc')).toEqual({ name: 'join', payload: 'eyJ2Ijox-_abc' })
    expect(parseRoute('#/join')).toEqual({ name: 'join', payload: '' })
  })

  it('parses achievements and plans', () => {
    expect(parseRoute('#/achievements')).toEqual({ name: 'achievements' })
    expect(parseRoute('#/plans')).toEqual({ name: 'plans', planId: undefined, dayId: undefined })
    expect(parseRoute('#/plans/legs-push-pull')).toEqual({ name: 'plans', planId: 'legs-push-pull', dayId: undefined })
    expect(parseRoute('#/plans/legs-push-pull/push')).toEqual({ name: 'plans', planId: 'legs-push-pull', dayId: 'push' })
  })

  it('falls back to landing for unknown routes', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'landing' })
  })
})
