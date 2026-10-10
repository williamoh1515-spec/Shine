import type { ProgressionConfig } from '../config/progression.config'
import { currentGoalValue } from './metrics'
import { activePlan, buildMilestones, evaluateReplan, initialPlan, replan } from './milestones'
import type { Exercise, Goal, GoalMetric, IsoDate, Session } from './models'
import { priorRate } from './priors'

export interface Projection {
  /** Conservative expected gain per week, in the goal's unit. */
  weeklyRate: number
  /** Rounding step for milestone values. */
  roundTo: number
}

/** Metrics that make sense for an exercise; the first is the default. */
export function metricsFor(exercise: Exercise): GoalMetric[] {
  switch (exercise.progressionModel) {
    case 'strength': {
      const loadType = exercise.loadType ?? 'plates'
      if (loadType === 'plates') return ['oneRepMaxKg', 'workingLoadKg', 'maxReps']
      if (loadType === 'bodyweight') return ['maxReps']
      // Fixed-weight kit: e1RM from a few bells is noisy, track the load used for N reps instead.
      return ['workingLoadKg', 'maxReps']
    }
    case 'repsEndurance':
      return ['maxReps']
    case 'timed':
      return ['maxDurationSec', 'workingLoadKg']
    case 'running':
      return ['maxDurationSec', 'distanceM']
    case 'cycling':
      return ['distanceM']
    case 'custom':
      return ['maxReps', 'maxDurationSec', 'workingLoadKg']
  }
}

export function metricFor(exercise: Exercise): GoalMetric {
  return metricsFor(exercise)[0] ?? 'maxReps'
}

function loadStep(exercise: Exercise, config: ProgressionConfig): number {
  const loadType = exercise.loadType ?? 'plates'
  if (exercise.overrides?.loadIncrementKg !== undefined) return exercise.overrides.loadIncrementKg
  if (loadType !== 'plates') return config.strength.kettlebellStepKg
  return config.strength.loadIncrementKg[exercise.region ?? 'upper']
}

/** What the projection knows about the lifter, to pick the right per-lift pace. */
export interface ProjectionContext {
  currentValue?: number
  bodyMassKg?: number
}

export function projectionFor(
  metric: GoalMetric,
  exercise: Exercise,
  config: ProgressionConfig,
  ctx: ProjectionContext = {},
): Projection {
  const region = exercise.region ?? 'upper'
  switch (metric) {
    case 'oneRepMaxKg':
    case 'workingLoadKg': {
      // Big lifts: per-lift research pace for this lifter's level, slowed so dates stay reachable.
      if (exercise.liftClass !== undefined) {
        const prior = priorRate(metric, exercise, ctx.currentValue ?? 0, ctx.bodyMassKg, config)
        return {
          weeklyRate: prior.perWeek * config.naturalProgress.projectionConservatism,
          roundTo: loadStep(exercise, config),
        }
      }
      return {
        weeklyRate: config.strength.conservativeGainKgPerWeek[region],
        roundTo: loadStep(exercise, config),
      }
    }
    case 'maxReps':
      return { weeklyRate: config.repsEndurance.conservativeGainRepsPerWeek, roundTo: 1 }
    case 'maxDurationSec':
      return exercise.progressionModel === 'running'
        ? { weeklyRate: config.running.conservativeGainSecPerWeek, roundTo: 60 }
        : { weeklyRate: config.timed.conservativeGainSecPerWeek, roundTo: config.timed.holdIncrementSec }
    case 'distanceM':
      return { weeklyRate: config.cycling.conservativeGainMetresPerWeek, roundTo: 1000 }
  }
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
  bodyMassKg?: number,
): Goal | undefined {
  const plan = activePlan(goal)
  if (plan === undefined) return undefined
  const current = currentGoalValue(goal, windowSessions)
  const { weeklyRate } = projectionFor(goal.metric, exercise, config, { currentValue: current, bodyMassKg })
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
  /** Defaults to metricFor(exercise). */
  metric?: GoalMetric
  minReps?: number
  startLoadKg?: number
  /** Lets big-lift milestone dates use the pace for this lifter's level. */
  bodyMassKg?: number
  demo?: boolean
}

export function createGoal(input: NewGoalInput, config: ProgressionConfig): Goal {
  const metric = input.metric ?? metricFor(input.exercise)
  const { weeklyRate, roundTo } = projectionFor(metric, input.exercise, config, {
    currentValue: input.baseline,
    bodyMassKg: input.bodyMassKg,
  })
  return {
    ...(input.minReps !== undefined ? { minReps: input.minReps } : {}),
    ...(input.startLoadKg !== undefined ? { startLoadKg: input.startLoadKg } : {}),
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

export interface GoalChange {
  target: number
  title?: string
  sessionsPerWeek?: number
}

/**
 * A goal with a new target: milestones are re-planned from where you are now (reason "manual").
 * Earlier plans stay as history, so earned milestones are never lost. A target at or below the
 * current value is allowed: the goal then simply counts as reached.
 */
export function changeGoalTarget(
  goal: Goal,
  change: GoalChange,
  currentValue: number,
  exercise: Exercise,
  today: IsoDate,
  config: ProgressionConfig,
  bodyMassKg?: number,
  /** Plan dates at this pace per week (e.g. the lifter's own pace) instead of the prior. */
  paceOverride?: number,
): Goal {
  if (goal.completedOn !== undefined) throw new Error('A completed goal cannot be changed')
  const projection = projectionFor(goal.metric, exercise, config, { currentValue, bodyMassKg })
  const { roundTo } = projection
  const weeklyRate =
    paceOverride !== undefined && paceOverride > 0
      ? paceOverride * config.naturalProgress.projectionConservatism
      : projection.weeklyRate
  return {
    ...goal,
    target: change.target,
    title: change.title ?? goal.title,
    sessionsPerWeek: change.sessionsPerWeek ?? goal.sessionsPerWeek,
    plans: [
      ...goal.plans,
      {
        createdOn: today,
        reason: 'manual',
        fromValue: currentValue,
        milestones: buildMilestones({
          baseline: currentValue,
          target: change.target,
          startDate: today,
          weeklyRate,
          roundTo,
          fractions: config.milestones.fractions,
        }),
      },
    ],
  }
}
