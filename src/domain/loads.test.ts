import { describe, expect, it } from 'vitest'
import { availableLoads, loadAtOrBelow, nextLoad, pairLoads, relativeJump } from './loads'

const homeKit = { kettlebellsKg: [16, 4, 12, 8], pullUpBar: true, bands: false }

describe('loads', () => {
  it('lists owned kettlebells, sorted', () => {
    expect(availableLoads('kettlebell', homeKit)).toEqual([4, 8, 12, 16])
  })

  it('combines two different bells for pair exercises', () => {
    expect(pairLoads([4, 8, 12, 16])).toEqual([12, 16, 20, 24, 28])
    expect(pairLoads([16])).toEqual([])
  })

  it('treats added load as bodyweight plus an optional bell', () => {
    expect(availableLoads('addedLoad', homeKit)).toEqual([0, 4, 8, 12, 16])
  })

  it('falls back to continuous loads without equipment info', () => {
    expect(availableLoads('kettlebell', undefined)).toBe('continuous')
    expect(availableLoads('plates', homeKit)).toBe('continuous')
    expect(availableLoads('bodyweight', homeKit)).toEqual([0])
  })

  it('finds the next heavier load, or nothing at the top', () => {
    expect(nextLoad(12, [4, 8, 12, 16], 4)).toBe(16)
    expect(nextLoad(16, [4, 8, 12, 16], 4)).toBeUndefined()
    expect(nextLoad(60, 'continuous', 2.5)).toBe(62.5)
  })

  it('rounds a target down to an available load', () => {
    expect(loadAtOrBelow(14, [4, 8, 12, 16], 4)).toBe(12)
    expect(loadAtOrBelow(2, [4, 8], 4)).toBe(4)
    expect(loadAtOrBelow(63, 'continuous', 5)).toBe(60)
  })

  it('measures jumps against the mass moved', () => {
    expect(relativeJump(12, 16)).toBeCloseTo(0.333, 2)
    // +4 kg on a 75 kg pull-up is small
    expect(relativeJump(4, 8, 75)).toBeCloseTo(0.0506, 3)
    expect(relativeJump(0, 4)).toBe(Number.POSITIVE_INFINITY)
  })
})
