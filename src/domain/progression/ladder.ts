import type { Technique } from '../models'

// When load can't go up (fixed kettlebells, no microplates), difficulty rises one lever at a
// time. Only ONE lever moves per step, so load and volume never increase together.

export type LadderStep = 'addSet' | Technique | 'nextLoad'

export interface LadderPosition {
  sets: number
  technique?: Technique
}

export interface LadderConfig {
  baseSets: number
  maxSets: number
  techniques: readonly Technique[]
}

export interface LadderMove {
  step: LadderStep
  sets: number
  technique?: Technique
}

/** The next rung after the current one. 'nextLoad' means the ladder is exhausted. */
export function nextLadderStep(position: LadderPosition, config: LadderConfig): LadderMove {
  if (position.sets < config.maxSets) {
    return { step: 'addSet', sets: position.sets + 1, technique: position.technique }
  }
  const index = position.technique === undefined ? -1 : config.techniques.indexOf(position.technique)
  const next = config.techniques[index + 1]
  if (next !== undefined) {
    // Techniques replace each other rather than stacking, and keep the sets reached.
    return { step: next, sets: position.sets, technique: next }
  }
  // Back to plain sets at the base volume with the next load.
  return { step: 'nextLoad', sets: config.baseSets }
}
