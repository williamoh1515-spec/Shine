import { describe, expect, it } from 'vitest'
import { nextLadderStep } from './ladder'

const config = { baseSets: 3, maxSets: 4, techniques: ['tempo', 'pause', 'range'] as const }

describe('nextLadderStep', () => {
  it('adds a set first', () => {
    expect(nextLadderStep({ sets: 3 }, config)).toEqual({ step: 'addSet', sets: 4, technique: undefined })
  })

  it('then moves through techniques one at a time, keeping the sets', () => {
    expect(nextLadderStep({ sets: 4 }, config)).toEqual({ step: 'tempo', sets: 4, technique: 'tempo' })
    expect(nextLadderStep({ sets: 4, technique: 'tempo' }, config).technique).toBe('pause')
    expect(nextLadderStep({ sets: 4, technique: 'pause' }, config).technique).toBe('range')
  })

  it('finally asks for the next load at base sets', () => {
    expect(nextLadderStep({ sets: 4, technique: 'range' }, config)).toEqual({ step: 'nextLoad', sets: 3 })
  })
})
