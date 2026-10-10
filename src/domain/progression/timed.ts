import type { ProgressionConfig } from '../../config/progression.config'
import type { ProgressionModifier } from '../checkIn'
import { nextLoad, type LoadSet } from '../loads'
import type { Exercise, Session } from '../models'

// Holds and carries (side plank, suitcase carry, dead hang): add seconds at the same load,
// then move to the next load and restart at the start hold.

export type TimedAction = 'start' | 'addTime' | 'increaseLoad' | 'hold' | 'regress' | 'maxed'

export interface TimedPrescription {
  exerciseId: string
  action: TimedAction
  sets: number
  seconds: number
  loadKg: number
  regression?: string
}

export interface TimedInput {
  exercise: Exercise
  config: ProgressionConfig['timed']
  windowSessions: Session[]
  loads: LoadSet
  loadIncrementKg: number
  startLoadKg?: number
  modifier: ProgressionModifier
}

interface TimedPerformance {
  loadKg: number
  /** Shortest set: every set must reach the target before progressing. */
  minSec: number
  sets: number
}

function lastPerformance(sessions: Session[], exerciseId: string): TimedPerformance | undefined {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))
  for (let i = sorted.length - 1; i >= 0; i--) {
    const session = sorted[i]
    if (session === undefined || session.kind !== 'training') continue
    const sets = session.setLogs.filter((l) => l.exerciseId === exerciseId && l.durationSec !== undefined)
    if (sets.length === 0) continue
    const loadKg = Math.max(...sets.map((s) => s.loadKg ?? 0))
    const top = sets.filter((s) => (s.loadKg ?? 0) === loadKg)
    return { loadKg, minSec: Math.min(...top.map((s) => s.durationSec ?? 0)), sets: top.length }
  }
  return undefined
}

export function suggestTimed(input: TimedInput): TimedPrescription {
  const { exercise, config, modifier, loads } = input
  const maxHold = exercise.overrides?.maxHoldSec ?? config.maxHoldSec
  const sets = exercise.overrides?.workingSets ?? config.sets
  const base = { exerciseId: exercise.id, sets }
  const last = lastPerformance(input.windowSessions, exercise.id)

  if (last === undefined) {
    return { ...base, action: 'start', seconds: config.startHoldSec, loadKg: input.startLoadKg ?? 0 }
  }
  if (modifier.paused) {
    return {
      ...base,
      action: 'regress',
      seconds: config.startHoldSec,
      loadKg: 0,
      regression: exercise.regression,
    }
  }
  const reachedTarget = last.sets >= sets && last.minSec >= maxHold
  if (modifier.lighterLoad || !(reachedTarget || modifier.forceProgress)) {
    const step = modifier.lighterLoad ? 0 : config.holdIncrementSec
    return {
      ...base,
      action: modifier.lighterLoad ? 'hold' : 'addTime',
      seconds: Math.min(maxHold, last.minSec + step),
      loadKg: last.loadKg,
    }
  }
  const heavier = nextLoad(last.loadKg, loads, input.loadIncrementKg)
  if (heavier === undefined || exercise.loadType === 'bodyweight' || exercise.loadType === undefined) {
    return { ...base, action: 'maxed', seconds: maxHold, loadKg: last.loadKg, regression: undefined }
  }
  // Heavier load: restart at the start hold, so time and load never both go up.
  return { ...base, action: 'increaseLoad', seconds: config.startHoldSec, loadKg: heavier }
}
