import type { ProgressionConfig } from '../config/progression.config'
import { addDays, diffDays } from './dates'
import type { ValuePoint } from './metrics'
import { activePlan } from './milestones'
import type { Goal, IsoDate } from './models'

// Each person's own pace, learned from their logs and blended with the research prior.

type PaceConfig = ProgressionConfig['personalPace']

export interface ObservedRate {
  /** Trend per week, in the goal metric's unit. */
  perWeek: number
  /** Sessions the trend is based on. */
  points: number
}

/**
 * Least-squares trend of the goal metric over the recent window. Undefined until there are
 * enough sessions over enough weeks to say anything.
 */
export function observedRate(history: ValuePoint[], today: IsoDate, cfg: PaceConfig): ObservedRate | undefined {
  const from = addDays(today, -cfg.lookbackWeeks * 7)
  const recent = history.filter((p) => p.date >= from && p.date <= today)
  if (recent.length < cfg.minPoints) return undefined
  const first = recent[0]
  const last = recent.at(-1)
  if (first === undefined || last === undefined || diffDays(last.date, first.date) < cfg.minWeeks * 7) return undefined

  const xs = recent.map((p) => diffDays(p.date, first.date))
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = recent.reduce((a, p) => a + p.value, 0) / recent.length
  let num = 0
  let den = 0
  recent.forEach((p, i) => {
    const dx = (xs[i] ?? 0) - meanX
    num += dx * (p.value - meanY)
    den += dx * dx
  })
  if (den === 0) return undefined
  return { perWeek: (num / den) * 7, points: recent.length }
}

/** Prior and personal pace mixed: the more sessions logged, the more your own data counts. */
export function blendedRate(prior: number, observed: ObservedRate | undefined, cfg: PaceConfig): number {
  if (observed === undefined) return prior
  return (cfg.priorWeight * prior + observed.points * observed.perWeek) / (cfg.priorWeight + observed.points)
}

/** Your pace for planning: blended with the prior, capped, and never below the prior. */
export function personalPace(prior: number, observed: ObservedRate | undefined, cfg: PaceConfig): number {
  return Math.max(prior, Math.min(blendedRate(prior, observed, cfg), cfg.maxRaiseFactor * prior))
}

export interface RaiseSuggestion {
  target: number
  observedPerWeek: number
  priorPerWeek: number
  /** observed ÷ prior */
  ratio: number
  /** Pace the new target assumes (per week), to plan its milestone dates. */
  perWeek: number
  /** Weeks the new target looks ahead. */
  weeks: number
}

/**
 * When someone clearly progresses faster than expected, a more ambitious target: what their pace
 * reaches within one training block (or by the goal's date, if sooner), capped so noisy logs can't
 * produce fantasy numbers. Never lower than the current target; undefined when nothing to propose.
 */
export function fastProgressSuggestion(
  goal: Goal,
  history: ValuePoint[],
  currentValue: number,
  priorPerWeek: number,
  roundTo: number,
  today: IsoDate,
  config: ProgressionConfig,
): RaiseSuggestion | undefined {
  const cfg = config.personalPace
  if (goal.completedOn !== undefined || currentValue >= goal.target || priorPerWeek <= 0) return undefined
  // "Not now" holds until a newer session is logged.
  const lastLogged = history.at(-1)?.date
  if (goal.dismissedRaiseAt !== undefined && (lastLogged === undefined || lastLogged <= goal.dismissedRaiseAt)) {
    return undefined
  }
  const observed = observedRate(history, today, cfg)
  if (observed === undefined || observed.perWeek < cfg.fastFactor * priorPerWeek) return undefined

  const targetDate = activePlan(goal)?.milestones.at(-1)?.targetDate
  const weeksLeft =
    targetDate !== undefined && targetDate > today ? diffDays(targetDate, today) / 7 : config.naturalProgress.horizonWeeks
  const weeksToTarget = (goal.target - currentValue) / observed.perWeek
  if (weeksLeft - weeksToTarget < cfg.aheadWeeks) return undefined

  const pace = personalPace(priorPerWeek, observed, cfg)
  const weeks = Math.min(weeksLeft, config.naturalProgress.horizonWeeks)
  const raw = currentValue + pace * weeks
  const target = roundTo > 0 ? Math.ceil(raw / roundTo) * roundTo : raw
  if (target <= goal.target) return undefined
  return { target, observedPerWeek: observed.perWeek, priorPerWeek, ratio: observed.perWeek / priorPerWeek, perWeek: pace, weeks }
}
