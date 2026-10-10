import type { SetLog } from './models'

/** Estimates are only trusted from sets of ≤ this many reps; above it error grows quickly. */
export const MAX_REPS_FOR_ESTIMATE = 10

export type E1rmFormula = 'epley' | 'brzycki'

/** Estimated 1RM (kg). Returns undefined when the set can't give a trustworthy estimate. */
export function estimateOneRepMax(
  loadKg: number,
  reps: number,
  formula: E1rmFormula = 'epley',
): number | undefined {
  if (loadKg <= 0 || reps <= 0 || reps > MAX_REPS_FOR_ESTIMATE) return undefined
  if (reps === 1) return loadKg
  if (formula === 'epley') return loadKg * (1 + reps / 30)
  return loadKg * (36 / (37 - reps))
}

/** Best estimated 1RM across sets, or undefined if none qualify. */
export function bestEstimatedOneRepMax(sets: SetLog[]): number | undefined {
  let best: number | undefined
  for (const set of sets) {
    if (set.loadKg === undefined || set.reps === undefined) continue
    const e1rm = estimateOneRepMax(set.loadKg, set.reps)
    if (e1rm !== undefined && (best === undefined || e1rm > best)) best = e1rm
  }
  return best
}
