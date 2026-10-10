import type { ProgressionConfig } from '../../config/progression.config'
import type { ProgressionModifier } from '../checkIn'
import { diffDays } from '../dates'
import { loadAtOrBelow, nextLoad, relativeJump, type LoadSet } from '../loads'
import type { Exercise, IsoDate, Session, SetLog, Technique } from '../models'
import { nextLadderStep, type LadderStep } from './ladder'

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
  maxRelativeLoadJump: number
  maxSets: number
  techniques: readonly Technique[]
}

export function resolveStrengthParams(exercise: Exercise, config: ProgressionConfig): StrengthParams {
  const s = config.strength
  const workingSets = exercise.overrides?.workingSets ?? s.workingSets
  return {
    repRange: exercise.overrides?.repRange ?? [s.repRange[0], s.repRange[1]],
    workingSets,
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
    maxRelativeLoadJump: s.maxRelativeLoadJump,
    maxSets: Math.max(workingSets, config.ladder.maxSets),
    techniques: config.ladder.techniques,
  }
}

export type StrengthAction =
  | 'start'
  | 'increaseLoad'
  | 'addReps'
  | 'ladder'
  | 'deload'
  | 'stallReset'
  | 'lighter'
  | 'regress'

export type StrengthNote =
  | 'rirMissing'
  | 'lowFeeling'
  | 'plannedDeload'
  | 'zeroBaseline'
  | 'bigJump'
  | 'heavierEquipment'

export interface StrengthPrescription {
  exerciseId: string
  action: StrengthAction
  loadKg: number
  sets: number
  repRange: [number, number]
  targetRir: number
  technique?: Technique
  ladderStep?: LadderStep
  regression?: string
  notes: StrengthNote[]
}

export interface StrengthInput {
  exercise: Exercise
  params: StrengthParams
  /** All sessions of the window (any order). */
  windowSessions: Session[]
  currentE1rm: number
  /** Overrides the e1RM-based starting load when there is no history (e.g. current kettlebell). */
  startLoadKg?: number
  /** Loads the athlete can actually use. Default: plates (continuous). */
  loads?: LoadSet
  /** Mass moved besides the load (bodyweight for added-load exercises), for jump sizes. */
  baseKg?: number
  modifier: ProgressionModifier
  programStart: IsoDate
  today: IsoDate
}

interface Performance {
  date: IsoDate
  loadKg: number
  sets: SetLog[]
  totalReps: number
  technique?: Technique
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
    technique: top.find((s) => s.technique !== undefined)?.technique,
    feeling: session.feeling,
  }
}

const TECHNIQUE_RANK: Record<Technique, number> = { tempo: 1, pause: 2, range: 3 }
const rank = (t: Technique | undefined) => (t === undefined ? 0 : TECHNIQUE_RANK[t])

function improved(next: Performance, prev: Performance): boolean {
  if (next.loadKg !== prev.loadKg) return next.loadKg > prev.loadKg
  // Moving up the ladder (harder technique) counts as progress even if reps dip.
  if (rank(next.technique) !== rank(prev.technique)) return rank(next.technique) > rank(prev.technique)
  return next.totalReps > prev.totalReps
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

export function suggestStrength(input: StrengthInput): StrengthPrescription {
  const { exercise, params, windowSessions, currentE1rm, modifier, programStart, today } = input
  const loads = input.loads ?? 'continuous'
  const round = (kg: number) => loadAtOrBelow(kg, loads, params.loadIncrementKg)
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
    const loadKg = round(currentE1rm * params.startingLoadFractionOfE1rm)
    return { ...base, action: 'start', loadKg, notes: currentE1rm <= 0 ? ['zeroBaseline'] : [] }
  }

  if (modifier.paused) {
    return {
      ...base,
      action: 'regress',
      loadKg: round(last.loadKg * params.regressionLoadFraction),
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
      // Volume deload: fewer sets, same load, no extra technique. Never more sets than normal.
      sets: Math.max(1, Math.ceil(params.workingSets * params.deloadSetFraction)),
      notes: [...(deloadDue ? (['plannedDeload'] as const) : []), ...(lowFeeling ? (['lowFeeling'] as const) : [])],
    }
  }

  if (stalled) {
    return {
      ...base,
      action: 'stallReset',
      loadKg: round(last.loadKg * (1 - params.stallLoadReduction)),
      regression: exercise.regression,
      notes: [],
    }
  }

  if (modifier.lighterLoad) {
    return {
      ...base,
      action: 'lighter',
      loadKg: round(last.loadKg * params.tooHardLoadFraction),
      notes: [],
    }
  }

  // Keep the ladder position reached (sets, technique) while building reps.
  const current = {
    ...base,
    sets: Math.min(params.maxSets, Math.max(params.workingSets, last.sets.length)),
    technique: last.technique,
  }
  const [, top] = params.repRange
  const enoughSets = last.sets.length >= current.sets
  const allAtTop = last.sets.every((s) => (s.reps ?? 0) >= top)
  const rirMissing = last.sets.some((s) => s.rir === undefined)
  const tooClose = last.sets.some((s) => s.rir !== undefined && s.rir < params.minRirToProgress)
  const notes: StrengthNote[] = rirMissing ? ['rirMissing'] : []

  if (!((enoughSets && allAtTop && !tooClose) || modifier.forceProgress)) {
    return { ...current, action: 'addReps', loadKg: last.loadKg, notes }
  }

  // Ready to progress: one lever only, so load and volume never rise together.
  const heavier = nextLoad(last.loadKg, loads, params.loadIncrementKg)
  // With plates the configured increment already is the chosen jump; fixed weights are checked.
  const jumpOk =
    heavier !== undefined &&
    (loads === 'continuous' ||
      relativeJump(last.loadKg, heavier, input.baseKg) <= params.maxRelativeLoadJump)
  if (jumpOk) {
    return { ...base, action: 'increaseLoad', loadKg: heavier, notes }
  }

  const move = nextLadderStep(
    { sets: current.sets, technique: last.technique },
    { baseSets: params.workingSets, maxSets: params.maxSets, techniques: params.techniques },
  )
  if (move.step !== 'nextLoad') {
    return { ...base, action: 'ladder', ladderStep: move.step, sets: move.sets, technique: move.technique, loadKg: last.loadKg, notes }
  }
  if (heavier !== undefined) {
    // Ladder exhausted: take the big jump, back to plain sets at the bottom of the range.
    return { ...base, action: 'increaseLoad', ladderStep: 'nextLoad', loadKg: heavier, notes: [...notes, 'bigJump'] }
  }
  // Nothing heavier exists: hold at the hardest rung and suggest new equipment or a harder variation.
  return {
    ...current,
    action: 'ladder',
    ladderStep: 'range',
    loadKg: last.loadKg,
    notes: [...notes, 'heavierEquipment'],
  }
}
