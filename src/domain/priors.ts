import type { ProgressionConfig } from '../config/progression.config'
import type { Exercise, GoalMetric, LiftClass } from './models'

// Expected progress per exercise, before any personal data ("prior"). Big lifts use per-lift
// research numbers scaled by training level; everything else uses the configured conservative
// rates. See naturalProgress in progression.config.ts for sources.

export type TrainingLevel = 'novice' | 'intermediate' | 'advanced'

/** How much the number rests on: studies, an extrapolation from studies, or a heuristic. */
export type PriorBasis = 'research' | 'extrapolated' | 'heuristic'

export interface PriorRate {
  /** Expected gain per week, in the goal metric's unit. */
  perWeek: number
  level?: TrainingLevel
  basis: PriorBasis
}

/** Level from strength relative to bodyweight; unknown inputs fall back to the configured default. */
export function trainingLevel(
  liftClass: LiftClass | undefined,
  totalLoadKg: number,
  bodyMassKg: number | undefined,
  config: ProgressionConfig['naturalProgress'],
): TrainingLevel {
  if (liftClass === undefined || bodyMassKg === undefined || bodyMassKg <= 0 || totalLoadKg <= 0) {
    return config.defaultLevel
  }
  const ratio = totalLoadKg / bodyMassKg
  const standard = config.standards[liftClass]
  if (ratio >= standard.advanced) return 'advanced'
  if (ratio >= standard.intermediate) return 'intermediate'
  return 'novice'
}

const BASIS_BY_LIFT: Record<LiftClass, PriorBasis> = {
  squat: 'research',
  hinge: 'research',
  horizontalPush: 'research',
  verticalPush: 'extrapolated',
}

/** Expected weekly progress for a goal metric on an exercise, at the lifter's current level. */
export function priorRate(
  metric: GoalMetric,
  exercise: Exercise,
  currentValue: number,
  bodyMassKg: number | undefined,
  config: ProgressionConfig,
): PriorRate {
  const n = config.naturalProgress
  switch (metric) {
    case 'oneRepMaxKg':
    case 'workingLoadKg': {
      const liftClass = exercise.liftClass
      if (liftClass === undefined) {
        return { perWeek: config.strength.conservativeGainKgPerWeek[exercise.region ?? 'upper'], basis: 'heuristic' }
      }
      const implementCount = exercise.implementCount ?? 1
      const level = trainingLevel(liftClass, currentValue * implementCount, bodyMassKg, n)
      const perWeek = (n.liftKgPerYear[liftClass] * n.levelMultiplier[level]) / n.weeksPerYear / implementCount
      return { perWeek, level, basis: BASIS_BY_LIFT[liftClass] }
    }
    case 'maxReps':
      return { perWeek: config.repsEndurance.conservativeGainRepsPerWeek, basis: 'heuristic' }
    case 'maxDurationSec':
      return exercise.progressionModel === 'running'
        ? { perWeek: config.running.conservativeGainSecPerWeek, basis: 'heuristic' }
        : { perWeek: config.timed.conservativeGainSecPerWeek, basis: 'heuristic' }
    case 'distanceM':
      return { perWeek: config.cycling.conservativeGainMetresPerWeek, basis: 'heuristic' }
  }
}
