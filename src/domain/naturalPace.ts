import type { ProgressionConfig } from '../config/progression.config'
import { projectionFor } from './goals'
import type { Exercise, Goal, GoalMetric, LiftClass } from './models'

// Realistic progress for a natural lifter, to suggest goals that push without being fantasy.
// All numbers come from config/progression.config.ts (naturalProgress) and are estimates.

export type TrainingLevel = 'novice' | 'intermediate' | 'advanced'

type NaturalConfig = ProgressionConfig['naturalProgress']

/** Level from strength relative to bodyweight; unknown inputs fall back to the configured default. */
export function trainingLevel(
  liftClass: LiftClass | undefined,
  totalLoadKg: number,
  bodyMassKg: number | undefined,
  config: NaturalConfig,
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

/** Expected gain (same unit as `current`) over `weeks` at a level. */
export function naturalGain(current: number, level: TrainingLevel, weeks: number, config: NaturalConfig): number {
  return current * config.monthlyGain[level] * (weeks / config.weeksPerMonth)
}

export interface GoalSuggestion {
  target: number
  level?: TrainingLevel
  /** What the natural pace adds over the horizon (load goals only). */
  expectedGain?: number
  horizonWeeks: number
}

function roundNearest(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}

/**
 * A target one training block ahead of where you are now. Load goals follow the natural pace for
 * your level (judged from bodyweight when known); reps, time and distance grow by a configured factor.
 * Always at least one step above `current`, so there is always something to chase.
 */
export function suggestGoalTarget(
  metric: GoalMetric,
  current: number,
  exercise: Exercise,
  bodyMassKg: number | undefined,
  config: ProgressionConfig,
): GoalSuggestion {
  const n = config.naturalProgress
  const { roundTo } = projectionFor(metric, exercise, config)
  const horizonWeeks = n.horizonWeeks
  const atLeastOneStep = (value: number) => Math.max(roundNearest(value, roundTo), current + roundTo)

  switch (metric) {
    case 'oneRepMaxKg':
    case 'workingLoadKg': {
      const implementCount = exercise.implementCount ?? 1
      const level = trainingLevel(exercise.liftClass, current * implementCount, bodyMassKg, n)
      const expectedGain = naturalGain(current, level, horizonWeeks, n)
      return { target: atLeastOneStep(current + expectedGain), level, expectedGain, horizonWeeks }
    }
    case 'maxReps':
      return { target: Math.max(Math.ceil(current * n.repsFactor), current + n.minRepsStep), horizonWeeks }
    case 'maxDurationSec':
      return { target: atLeastOneStep(current * n.durationFactor), horizonWeeks }
    case 'distanceM':
      return { target: atLeastOneStep(current * n.distanceFactor), horizonWeeks }
  }
}

/** A reached goal and its suggested successor. Undefined while the goal is still open. */
export function suggestNextGoal(
  goal: Goal,
  currentValue: number,
  exercise: Exercise,
  bodyMassKg: number | undefined,
  config: ProgressionConfig,
): GoalSuggestion | undefined {
  if (goal.completedOn !== undefined || currentValue < goal.target) return undefined
  return suggestGoalTarget(goal.metric, currentValue, exercise, bodyMassKg, config)
}
