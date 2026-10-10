import { addDays, diffDays } from './dates'
import type { Goal, IsoDate, Milestone, MilestonePlan } from './models'
import type { ValuePoint } from './metrics'

export interface MilestoneInput {
  baseline: number
  target: number
  startDate: IsoDate
  /** Conservative expected gain per week, in the goal's unit. */
  weeklyRate: number
  /** Milestone values are rounded to this step (e.g. a 2.5 kg plate jump, 1 rep). */
  roundTo: number
  fractions: readonly number[]
}

function daysToGain(gain: number, weeklyRate: number): number {
  if (weeklyRate <= 0) throw new Error('weeklyRate must be positive')
  return Math.ceil((Math.max(0, gain) / weeklyRate) * 7)
}

function roundToStep(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}

/** Splits the baseline→target gap into milestones with conservative projected dates. */
export function buildMilestones(input: MilestoneInput): Milestone[] {
  const { baseline, target, startDate, weeklyRate, roundTo, fractions } = input
  if (target <= baseline) {
    return [{ index: 0, fraction: 1, targetValue: target, targetDate: startDate }]
  }
  const gap = target - baseline
  const milestones: Milestone[] = []
  let previous = baseline
  for (const fraction of fractions) {
    const raw = fraction >= 1 ? target : roundToStep(baseline + gap * fraction, roundTo)
    const value = Math.min(target, raw)
    if (value <= previous) continue
    milestones.push({
      index: milestones.length,
      fraction,
      targetValue: value,
      targetDate: addDays(startDate, daysToGain(value - baseline, weeklyRate)),
    })
    previous = value
  }
  return milestones
}

export function initialPlan(input: MilestoneInput): MilestonePlan {
  return {
    createdOn: input.startDate,
    reason: 'initial',
    fromValue: input.baseline,
    milestones: buildMilestones(input),
  }
}

export function activePlan(goal: Goal): MilestonePlan | undefined {
  return goal.plans[goal.plans.length - 1]
}

/** Value the plan expects on `date`, interpolated linearly between milestones. */
export function projectedValueOn(plan: MilestonePlan, date: IsoDate): number {
  const points: ValuePoint[] = [
    { date: plan.createdOn, value: plan.fromValue },
    ...plan.milestones.map((m) => ({ date: m.targetDate, value: m.targetValue })),
  ]
  const first = points[0]
  if (first === undefined || date <= first.date) return plan.fromValue
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a === undefined || b === undefined) continue
    if (date <= b.date) {
      const span = diffDays(b.date, a.date)
      if (span <= 0) return b.value
      return a.value + ((b.value - a.value) * diffDays(date, a.date)) / span
    }
  }
  return points[points.length - 1]?.value ?? plan.fromValue
}

/** Remaining milestones re-dated from `today`, starting at the current value. */
export function replan(
  plan: MilestonePlan,
  currentValue: number,
  today: IsoDate,
  weeklyRate: number,
  reason: MilestonePlan['reason'],
): MilestonePlan {
  return {
    createdOn: today,
    reason,
    fromValue: currentValue,
    milestones: plan.milestones
      .filter((m) => m.targetValue > currentValue)
      .map((m) => ({
        ...m,
        targetDate: addDays(today, daysToGain(m.targetValue - currentValue, weeklyRate)),
      })),
  }
}

/**
 * Returns a new plan when actual progress is ≥ thresholdWeeks ahead of or behind the projection,
 * otherwise undefined. Never re-plans a finished goal.
 */
export function evaluateReplan(
  plan: MilestonePlan,
  currentValue: number,
  today: IsoDate,
  weeklyRate: number,
  thresholdWeeks: number,
): MilestonePlan | undefined {
  const remaining = plan.milestones.filter((m) => m.targetValue > currentValue)
  if (remaining.length === 0 || weeklyRate <= 0) return undefined
  const weeksDiff = (currentValue - projectedValueOn(plan, today)) / weeklyRate
  if (weeksDiff >= thresholdWeeks) return replan(plan, currentValue, today, weeklyRate, 'ahead')
  if (weeksDiff <= -thresholdWeeks) return replan(plan, currentValue, today, weeklyRate, 'behind')
  return undefined
}

export interface MilestoneStatus {
  milestone: Milestone
  /** Date of the first session that reached the milestone value. */
  hitOn?: IsoDate
}

/** Milestones of the original plan (stable targets) with the date each was first reached. */
export function milestoneStatuses(goal: Goal, history: ValuePoint[]): MilestoneStatus[] {
  const plan = activePlan(goal)
  const original = goal.plans[0]
  if (plan === undefined || original === undefined) return []
  return original.milestones.map((m) => {
    const hit = history.find((p) => p.value >= m.targetValue)
    const current = plan.milestones.find((pm) => pm.index === m.index)
    return {
      milestone: current ?? m,
      hitOn: hit?.date,
    }
  })
}
