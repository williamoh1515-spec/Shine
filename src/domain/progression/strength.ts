import type { ProgressionConfig } from '../../config/progression.config'
import type { ProgressionModifier } from '../checkIn'
import { diffDays } from '../dates'
import type { Exercise, IsoDate, Session, SetLog } from '../models'

export interface StrengthParams {
  repRange: [number, number]
  workingSets: number
  loadIncrementKg: number
  targetRir: number
  minRirToProgress: number
  stallSessions: number
  stallLoadReduction: number
  deloadEveryWeeks: number
  deloadSetFraction: number
  lowFeelingThreshold: number
  feelingWindowSessions: number
  startingLoadFractionOfE1rm: number
  regressionLoadFraction: number
  tooHardLoadFraction: number
}

export function resolveStrengthParams(exercise: Exercise, config: ProgressionConfig): StrengthParams {
  const s = config.strength
  return {
    repRange: exercise.overrides?.repRange ?? [s.repRange[0], s.repRange[1]],
    workingSets: exercise.overrides?.workingSets ?? s.workingSets,
    loadIncrementKg:
      exercise.overrides?.loadIncrementKg ?? s.loadIncrementKg[exercise.region ?? 'upper'],
    targetRir: s.targetRir,
    minRirToProgress: s.minRirToProgress,
    stallSessions: s.stallSessions,
    stallLoadReduction: s.stallLoadReduction,
    deloadEveryWeeks: s.deloadEveryWeeks,
    deloadSetFraction: s.deloadSetFraction,
    lowFeelingThreshold: s.lowFeelingThreshold,
    feelingWindowSessions: s.feelingWindowSessions,
    startingLoadFractionOfE1rm: s.startingLoadFractionOfE1rm,
    regressionLoadFraction: config.painFlag.regressionLoadFraction,
    tooHardLoadFraction: config.checkIn.tooHardLoadFraction,
  }
}

export type StrengthAction =
  | 'start'
  | 'increaseLoad'
  | 'addReps'
  | 'deload'
  | 'stallReset'
  | 'lighter'
  | 'regress'

export type StrengthNote = 'rirMissing' | 'lowFeeling' | 'plannedDeload' | 'zeroBaseline'

export interface StrengthPrescription {
  exerciseId: string
  action: StrengthAction
  loadKg: number
  sets: number
  repRange: [number, number]
  targetRir: number
  regression?: string
  notes: StrengthNote[]
}

export interface StrengthInput {
  exercise: Exercise
  params: StrengthParams
  /** All sessions of the window (any order). */
  windowSessions: Session[]
  currentE1rm: number
  /** Overrides the e1RM-based starting load when there is no history (e.g. added load on a weighted variant). */
  startLoadKg?: number
  modifier: ProgressionModifier
  programStart: IsoDate
  today: IsoDate
}

interface Performance {
  date: IsoDate
  loadKg: number
  sets: SetLog[]
  totalReps: number
  feeling?: number
}

function performanceOf(session: Session, exerciseId: string): Performance | undefined {
  const sets = session.setLogs.filter(
    (s) => s.exerciseId === exerciseId && s.loadKg !== undefined && s.reps !== undefined,
  )
  if (sets.length === 0) return undefined
  const loadKg = Math.max(...sets.map((s) => s.loadKg ?? 0))
  const top = sets.filter((s) => s.loadKg === loadKg)
  return {
    date: session.date,
    loadKg,
    sets: top,
    totalReps: top.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    feeling: session.feeling,
  }
}

function improved(next: Performance, prev: Performance): boolean {
  return next.loadKg > prev.loadKg || (next.loadKg === prev.loadKg && next.totalReps > prev.totalReps)
}

/**
 * True when the last `n` sessions brought no new best. A load drop (reset, lighter week)
 * starts a fresh baseline, so building back up counts as progress.
 */
export function isStalled(history: Performance[], n: number): boolean {
  const [first, ...rest] = history
  if (first === undefined) return false
  let best = first
  let sinceImprovement = 0
  for (const p of rest) {
    if (p.loadKg < best.loadKg || improved(p, best)) {
      best = p
      sinceImprovement = 0
    } else {
      sinceImprovement++
    }
  }
  return sinceImprovement >= n
}

function roundDown(value: number, step: number): number {
  return Math.max(0, Math.floor(value / step + 1e-9) * step)
}

export function suggestStrength(input: StrengthInput): StrengthPrescription {
  const { exercise, params, windowSessions, currentE1rm, modifier, programStart, today } = input
  const sorted = [...windowSessions].sort((a, b) => (a.date < b.date ? -1 : 1))
  const training = sorted
    .filter((s) => s.kind === 'training')
    .map((s) => performanceOf(s, exercise.id))
    .filter((p): p is Performance => p !== undefined)

  const base = {
    exerciseId: exercise.id,
    sets: params.workingSets,
    repRange: params.repRange,
    targetRir: params.targetRir,
  }
  const last = training.at(-1)

  if (last === undefined) {
    if (input.startLoadKg !== undefined) {
      return { ...base, action: 'start', loadKg: input.startLoadKg, notes: [] }
    }
    const loadKg = roundDown(currentE1rm * params.startingLoadFractionOfE1rm, params.loadIncrementKg)
    return { ...base, action: 'start', loadKg, notes: currentE1rm <= 0 ? ['zeroBaseline'] : [] }
  }

  if (modifier.paused) {
    return {
      ...base,
      action: 'regress',
      loadKg: roundDown(last.loadKg * params.regressionLoadFraction, params.loadIncrementKg),
      regression: exercise.regression,
      notes: [],
    }
  }

  const stalled = isStalled(training, params.stallSessions)
  const feelings = training
    .slice(-params.feelingWindowSessions)
    .map((p) => p.feeling)
    .filter((f): f is number => f !== undefined)
  const lowFeeling =
    feelings.length > 0 &&
    feelings.reduce((a, b) => a + b, 0) / feelings.length <= params.lowFeelingThreshold

  const lastDeload = sorted.filter((s) => s.kind === 'deload').at(-1)?.date ?? programStart
  const deloadDue = diffDays(today, lastDeload) >= params.deloadEveryWeeks * 7

  if (deloadDue || modifier.suggestDeload || (stalled && lowFeeling)) {
    return {
      ...base,
      action: 'deload',
      loadKg: last.loadKg,
      // Volume deload: fewer sets, same load. Never more sets than normal.
      sets: Math.max(1, Math.ceil(params.workingSets * params.deloadSetFraction)),
      notes: [...(deloadDue ? (['plannedDeload'] as const) : []), ...(lowFeeling ? (['lowFeeling'] as const) : [])],
    }
  }

  if (stalled) {
    return {
      ...base,
      action: 'stallReset',
      loadKg: roundDown(last.loadKg * (1 - params.stallLoadReduction), params.loadIncrementKg),
      regression: exercise.regression,
      notes: [],
    }
  }

  if (modifier.lighterLoad) {
    return {
      ...base,
      action: 'lighter',
      loadKg: roundDown(last.loadKg * params.tooHardLoadFraction, params.loadIncrementKg),
      notes: [],
    }
  }

  const [, top] = params.repRange
  const enoughSets = last.sets.length >= params.workingSets
  const allAtTop = last.sets.every((s) => (s.reps ?? 0) >= top)
  const rirMissing = last.sets.some((s) => s.rir === undefined)
  const tooClose = last.sets.some((s) => s.rir !== undefined && s.rir < params.minRirToProgress)
  const notes: StrengthNote[] = rirMissing ? ['rirMissing'] : []

  if ((enoughSets && allAtTop && !tooClose) || modifier.forceProgress) {
    // Load goes up; sets stay the same → never load and volume up together.
    return { ...base, action: 'increaseLoad', loadKg: last.loadKg + params.loadIncrementKg, notes }
  }
  return { ...base, action: 'addReps', loadKg: last.loadKg, notes }
}
