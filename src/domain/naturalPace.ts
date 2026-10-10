import type { ProgressionConfig } from '../config/progression.config'
import { projectionFor } from './goals'
import type { ValuePoint } from './metrics'
import type { Exercise, Goal, GoalMetric, IsoDate } from './models'
import { blendedRate, observedRate } from './personalPace'
import { priorRate, type PriorBasis, type TrainingLevel } from './priors'

// Goal suggestions: one training block ahead at the pace expected for this exercise and lifter
// (research prior), adjusted by the lifter's own logged pace once there is enough data.

export interface GoalSuggestion {
  target: number
  level?: TrainingLevel
  /** Pace used, per week, in the metric's unit. */
  perWeek: number
  /** Gain the pace adds over the horizon. */
  expectedGain: number
  horizonWeeks: number
  basis: PriorBasis
  /** True when the user's own logged trend shaped the pace. */
  personal: boolean
}

function roundNearest(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}

/**
 * A target one training block ahead of where you are now. Always at least one step above
 * `current`, so there is always something to chase.
 */
export function suggestGoalTarget(
  metric: GoalMetric,
  current: number,
  exercise: Exercise,
  bodyMassKg: number | undefined,
  config: ProgressionConfig,
  history?: { points: ValuePoint[]; today: IsoDate },
): GoalSuggestion {
  const horizonWeeks = config.naturalProgress.horizonWeeks
  const { roundTo } = projectionFor(metric, exercise, config)
  const prior = priorRate(metric, exercise, current, bodyMassKg, config)
  const observed = history ? observedRate(history.points, history.today, config.personalPace) : undefined
  const perWeek = Math.max(0, blendedRate(prior.perWeek, observed, config.personalPace))
  const expectedGain = perWeek * horizonWeeks
  const target = Math.max(roundNearest(current + expectedGain, roundTo), current + roundTo)
  return {
    target,
    level: prior.level,
    perWeek,
    expectedGain,
    horizonWeeks,
    basis: prior.basis,
    personal: observed !== undefined,
  }
}

/** A reached goal's suggested successor. Undefined while the goal is still open. */
export function suggestNextGoal(
  goal: Goal,
  currentValue: number,
  exercise: Exercise,
  bodyMassKg: number | undefined,
  config: ProgressionConfig,
  history?: { points: ValuePoint[]; today: IsoDate },
): GoalSuggestion | undefined {
  if (goal.completedOn !== undefined || currentValue < goal.target) return undefined
  return suggestGoalTarget(goal.metric, currentValue, exercise, bodyMassKg, config, history)
}
