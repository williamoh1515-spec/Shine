import type { Equipment, LoadType } from './models'

// Which loads exist for an exercise, given the athlete's equipment.

/** 'continuous' = plates, any multiple of the increment is reachable. */
export type LoadSet = number[] | 'continuous'

const EPS = 1e-9

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.filter((v) => Number.isFinite(v) && v >= 0))].sort((a, b) => a - b)
}

/** Two *different* owned bells held together (one of each is the common home setup). */
export function pairLoads(bells: number[]): number[] {
  const sums: number[] = []
  for (let i = 0; i < bells.length; i++) {
    for (let j = i + 1; j < bells.length; j++) {
      const a = bells[i]
      const b = bells[j]
      if (a !== undefined && b !== undefined) sums.push(a + b)
    }
  }
  return uniqueSorted(sums)
}

export function availableLoads(loadType: LoadType, equipment: Equipment | undefined): LoadSet {
  const bells = uniqueSorted(equipment?.kettlebellsKg ?? [])
  switch (loadType) {
    case 'plates':
      return 'continuous'
    case 'bodyweight':
      return [0]
    case 'kettlebell':
      return bells.length > 0 ? bells : 'continuous'
    case 'kettlebellPair':
      return bells.length > 1 ? pairLoads(bells) : 'continuous'
    case 'addedLoad':
      return equipment === undefined ? 'continuous' : uniqueSorted([0, ...bells])
  }
}

/** Next heavier load, or undefined when the equipment has nothing heavier. */
export function nextLoad(current: number, loads: LoadSet, increment: number): number | undefined {
  if (loads === 'continuous') return current + increment
  return loads.find((l) => l > current + EPS)
}

/** Heaviest available load ≤ target (or the lightest one if none is that light). */
export function loadAtOrBelow(target: number, loads: LoadSet, increment: number): number {
  if (loads === 'continuous') {
    return increment > 0 ? Math.max(0, Math.floor(target / increment + EPS) * increment) : Math.max(0, target)
  }
  const below = loads.filter((l) => l <= target + EPS)
  return below.at(-1) ?? loads[0] ?? 0
}

/**
 * Size of a load jump relative to what is actually moved. For added load, the moved mass
 * includes bodyweight (+4 kg on a 75 kg pull-up is ~5%, not 100%).
 */
export function relativeJump(from: number, to: number, baseKg = 0): number {
  const moved = from + baseKg
  return moved > 0 ? (to - from) / moved : Number.POSITIVE_INFINITY
}
