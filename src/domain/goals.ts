import type { ProgressionConfig } from '../config/progression.config'
import { currentGoalValue } from './metrics'
import { activePlan, evaluateReplan, initialPlan, replan } from './milestones'
import type { Exercise, Goal, GoalMetric, IsoDate, Session } from './models'

export interface Projection {
  /** Conservative expected gain per week, in the goal's unit. */
  weeklyRate: number
  /** Rounding step for milestone values. */
  roundTo: number
}

export function metricFor(exercise: Exercise): GoalMetric {
  switch (exercise.progressionModel) {
    case 'repsEndurance':
      return 'maxReps'
    case 'cycling':
    case 'running':
      return 'distanceM'
    default:
      return 'oneRepMaxKg'
  }
}

export function projectionFor(metric: GoalMetric, exercise: Exercise, config: ProgressionConfig): Projection {
  switch (metric) {
    case 'oneRepMaxKg': {
      const region = exercise.region ?? 'upper'
      return {
        weeklyRate: config.strength.conservativeGainKgPerWeek[region],
        roundTo: exercise.overrides?.loadIncrementKg ?? config.strength.loadIncrementKg[region],
      }
    }
    case 'maxReps':
      return { weeklyRate: config.repsEndurance.conservativeGainRepsPerWeek, roundTo: 1 }
    case 'distanceM':
      return { weeklyRate: config.cycling.conservativeGainMetresPerWeek, roundTo: 1000 }
  }
}

/** A modest default target to start from. Rough heuristic, meant to be edited. */
export const SUGGESTED_TARGET_FACTOR: Record<GoalMetric, number> = {
  oneRepMaxKg: 1.15,
  maxReps: 1.5,
  distanceM: 1.5,
}

export function suggestTarget(metric: GoalMetric, baseline: number, roundTo: number): number {
  const raw = Math.max(baseline * SUGGESTED_TARGET_FACTOR[metric], baseline + roundTo)
  return Math.ceil(raw / roundTo) * roundTo
}

/**
 * Returns the goal with a new milestone plan appended when progress diverged from the
 * projection (or when `force` is given, e.g. after missed sessions), otherwise undefined.
 * Old plans are kept as history.
 */
export function maybeReplan(
  goal: Goal,
  exercise: Exercise,
  windowSessions: Session[],
  today: IsoDate,
  config: ProgressionConfig,
  force?: 'missedSessions' | 'manual',
): Goal | undefined {
  const plan = activePlan(goal)
  if (plan === undefined) return undefined
  const current = currentGoalValue(goal, windowSessions)
  const { weeklyRate } = projectionFor(goal.metric, exercise, config)
  const next =
    force !== undefined
      ? plan.milestones.some((m) => m.targetValue > current)
        ? replan(plan, current, today, weeklyRate, force)
        : undefined
      : evaluateReplan(plan, current, today, weeklyRate, config.milestones.replanThresholdWeeks)
  return next === undefined ? undefined : { ...goal, plans: [...goal.plans, next] }
}

export interface NewGoalInput {
  id: string
  windowId: string
  exercise: Exercise
  title: string
  baseline: number
  baselineSource: Goal['baselineSource']
  target: number
  startDate: IsoDate
  sessionsPerWeek: number
  demo?: boolean
}

export function createGoal(input: NewGoalInput, config: ProgressionConfig): Goal {
  const metric = metricFor(input.exercise)
  const { weeklyRate, roundTo } = projectionFor(metric, input.exercise, config)
  return {
    id: input.id,
    windowId: input.windowId,
    exerciseId: input.exercise.id,
    title: input.title,
    metric,
    baseline: input.baseline,
    baselineSource: input.baselineSource,
    target: input.target,
    startDate: input.startDate,
    sessionsPerWeek: input.sessionsPerWeek,
    demo: input.demo,
    plans: [
      initialPlan({
        baseline: input.baseline,
        target: input.target,
        startDate: input.startDate,
        weeklyRate,
        roundTo,
        fractions: config.milestones.fractions,
      }),
    ],
  }
}
