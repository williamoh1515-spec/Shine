import type { BalancePair } from '../config/balance.config'
import type { ProgressionConfig } from '../config/progression.config'
import { activeModifier } from './checkIn'
import { availableLoads } from './loads'
import type { CheckIn, Exercise, Goal, IsoDate, MuscleGroup, Profile, Session, Technique } from './models'
import { bestEstimatedOneRepMax } from './oneRepMax'
import { buildWeekProgram } from './program'
import { resolveStrengthParams, suggestStrength, type StrengthAction } from './progression/strength'
import { suggestTimed } from './progression/timed'

// Ready-made training plans: days of exercises (with supersets), checked for opposite-muscle
// balance, and today's prescription for each exercise.

export interface PlanItem {
  exerciseId: string
  sets: number
  /** Rep range for rep-based exercises. */
  reps?: [number, number]
  /** Hold range in seconds for timed exercises. */
  holdSec?: [number, number]
  /** Superset label: A1 and A2 are done alternately, rest after the pair. */
  superset?: string
  /** Heavy main lift: longer rests in the time estimate. */
  main?: boolean
  note?: string
}

export interface PlanDay {
  id: string
  title: string
  items: PlanItem[]
}

export interface Plan {
  id: string
  name: string
  summary: string
  why: string
  /** Window the sessions are logged in. */
  windowId: string
  days: PlanDay[]
}

export interface TimeConfig {
  warmUpMin: number
  mainSetMin: number
  setMin: number
  bodyweightSetMin: number
  /** The second exercise of a superset shares the first one's rest. */
  supersetShare: number
}

/** Rough session length: sets × (work + rest), supersets sharing rest, plus a warm-up. */
export function estimateMinutes(day: PlanDay, exercises: Record<string, Exercise>, cfg: TimeConfig): number {
  let total = cfg.warmUpMin
  for (const item of day.items) {
    const exercise = exercises[item.exerciseId]
    const perSet = item.main
      ? cfg.mainSetMin
      : exercise?.progressionModel === 'strength' && exercise.loadType !== 'bodyweight'
        ? cfg.setMin
        : cfg.bodyweightSetMin
    const second = item.superset !== undefined && !item.superset.endsWith('1')
    total += item.sets * perSet * (second ? cfg.supersetShare : 1)
  }
  return Math.round(total)
}

/** Sets per week each muscle gets from one week of the plan (every day done once). */
export function planWeeklySets(plan: Plan, exercises: Record<string, Exercise>, muscles: MuscleGroup[]): number {
  let sets = 0
  for (const day of plan.days) {
    for (const item of day.items) {
      if (exercises[item.exerciseId]?.muscles?.some((m) => muscles.includes(m))) sets += item.sets
    }
  }
  return sets
}

export interface PlanBalance {
  pairId: string
  a: number
  b: number
  ok: boolean
}

/** The plan's weekly volume for each opposite-muscle pair, judged like the balance card. */
export function planBalance(plan: Plan, exercises: Record<string, Exercise>, pairs: BalancePair[]): PlanBalance[] {
  return pairs.flatMap((p) => {
    const v = p.volume
    if (v === undefined) return []
    const a = planWeeklySets(plan, exercises, p.a.muscles)
    const b = planWeeklySets(plan, exercises, p.b.muscles)
    const ratio = b === 0 ? (a > 0 ? Number.POSITIVE_INFINITY : 0) : a / b
    const ok = ratio >= v.aim * (1 - v.tolerance) && (v.atLeast === true || ratio <= v.aim * (1 + v.tolerance))
    return [{ pairId: p.id, a, b, ok }]
  })
}

/** The day after the last one logged for this plan; the first day if none yet. */
export function nextDay(plan: Plan, sessions: Session[]): PlanDay | undefined {
  const last = sessions
    .filter((s) => s.planId === plan.id && s.planDayId !== undefined)
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
    .at(-1)
  const index = last ? plan.days.findIndex((d) => d.id === last.planDayId) : -1
  return plan.days[(index + 1) % plan.days.length]
}

export interface ItemPrescription {
  sets: number
  repRange?: [number, number]
  /** Prefill for the reps field. */
  reps?: number
  loadKg?: number
  seconds?: number
  technique?: Technique
  action?: StrengthAction
  /** Where the numbers come from. */
  source: 'goal' | 'history' | 'start'
}

export interface PrescribeInput {
  item: PlanItem
  exercise: Exercise
  goal?: Goal
  sessions: Session[]
  checkIns: CheckIn[]
  profile: Profile
  exercises: Record<string, Exercise>
  windowId: string
  today: IsoDate
  config: ProgressionConfig
}

const firstDate = (sessions: Session[], exerciseId: string, fallback: IsoDate) =>
  sessions
    .filter((s) => s.setLogs.some((l) => l.exerciseId === exerciseId))
    .map((s) => s.date)
    .sort()[0] ?? fallback

/**
 * Today's numbers for one plan exercise. A goal's program wins (it knows the milestone);
 * otherwise the exercise's progression model works from your past sets; with no history the
 * plan's sets and reps are shown and you find a starting weight.
 */
export function prescribeItem(input: PrescribeInput): ItemPrescription {
  const { item, exercise, goal, sessions, checkIns, profile, today, config, windowId } = input
  const windowSessions = sessions.filter((s) => s.windowId === windowId)
  const modifier = activeModifier(windowId, goal?.id, windowSessions, checkIns)
  const logged = windowSessions.some((s) => s.setLogs.some((l) => l.exerciseId === exercise.id))

  if (goal !== undefined) {
    const program = buildWeekProgram({ goal, exercises: input.exercises, windowSessions, checkIns, today, config, profile })
    const it = program.item
    if (it.kind === 'strength') {
      const p = it.prescription
      return { sets: item.sets, repRange: p.repRange, reps: p.repRange[0], loadKg: p.loadKg, technique: p.technique, action: p.action, source: 'goal' }
    }
    if (it.kind === 'timed') {
      return { sets: item.sets, seconds: it.prescription.seconds, loadKg: it.prescription.loadKg || undefined, source: 'goal' }
    }
    if (it.kind === 'reps' && it.prescription.action !== 'test') {
      return { sets: item.sets, reps: it.prescription.reps, source: 'goal' }
    }
  }

  if (exercise.progressionModel === 'strength') {
    const params = {
      ...resolveStrengthParams(exercise, config),
      ...(item.reps ? { repRange: item.reps } : {}),
      workingSets: item.sets,
    }
    const sets = windowSessions.flatMap((s) => s.setLogs.filter((l) => l.exerciseId === exercise.id))
    if (!logged) return { sets: item.sets, repRange: params.repRange, source: 'start' }
    const p = suggestStrength({
      exercise,
      params,
      windowSessions,
      currentE1rm: bestEstimatedOneRepMax(sets) ?? 0,
      loads: availableLoads(exercise.loadType ?? 'plates', profile.equipment),
      baseKg: exercise.loadType === 'addedLoad' ? profile.bodyMassKg : undefined,
      modifier,
      programStart: firstDate(windowSessions, exercise.id, today),
      today,
    })
    return { sets: p.sets, repRange: p.repRange, reps: p.repRange[0], loadKg: p.loadKg, technique: p.technique, action: p.action, source: 'history' }
  }

  if (exercise.progressionModel === 'timed') {
    const p = suggestTimed({
      exercise: { ...exercise, overrides: { ...exercise.overrides, workingSets: item.sets, ...(item.holdSec ? { maxHoldSec: item.holdSec[1] } : {}) } },
      config: { ...config.timed, ...(item.holdSec ? { startHoldSec: item.holdSec[0] } : {}) },
      windowSessions,
      loads: availableLoads(exercise.loadType ?? 'bodyweight', profile.equipment),
      loadIncrementKg: resolveStrengthParams(exercise, config).loadIncrementKg,
      modifier,
    })
    return { sets: item.sets, seconds: p.seconds, loadKg: p.loadKg || undefined, source: logged ? 'history' : 'start' }
  }

  // Bodyweight rep exercises: last time's best set as the prefill, inside the plan's range.
  const last = windowSessions
    .filter((s) => s.setLogs.some((l) => l.exerciseId === exercise.id && l.reps !== undefined))
    .sort((x, y) => (x.date < y.date ? 1 : -1))[0]
  const lastBest = last ? Math.max(...last.setLogs.filter((l) => l.exerciseId === exercise.id).map((l) => l.reps ?? 0)) : undefined
  return { sets: item.sets, repRange: item.reps, reps: lastBest ?? item.reps?.[0], source: lastBest !== undefined ? 'history' : 'start' }
}
