import { describe, expect, it } from 'vitest'
import { bestEstimatedOneRepMax, estimateOneRepMax } from './oneRepMax'

describe('estimateOneRepMax', () => {
  it('uses Epley by default', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1)
  })

  it('supports Brzycki', () => {
    expect(estimateOneRepMax(100, 5, 'brzycki')).toBeCloseTo(112.5, 1)
  })

  it('returns the load itself for a single', () => {
    expect(estimateOneRepMax(90, 1)).toBe(90)
  })

  it('refuses sets above 10 reps, zero reps or zero load', () => {
    expect(estimateOneRepMax(60, 11)).toBeUndefined()
    expect(estimateOneRepMax(60, 0)).toBeUndefined()
    expect(estimateOneRepMax(0, 5)).toBeUndefined()
  })
})

describe('bestEstimatedOneRepMax', () => {
  it('picks the best qualifying set and ignores incomplete ones', () => {
    const best = bestEstimatedOneRepMax([
      { exerciseId: 'x', loadKg: 60, reps: 12 },
      { exerciseId: 'x', loadKg: 70, reps: 5 },
      { exerciseId: 'x', loadKg: 72.5 },
    ])
    expect(best).toBeCloseTo(81.67, 1)
  })

  it('returns undefined with no usable sets', () => {
    expect(bestEstimatedOneRepMax([])).toBeUndefined()
  })
})
