import type { ProgressionConfig } from '../../config/progression.config'
import type { ProgressionModifier } from '../checkIn'
import { diffDays } from '../dates'
import type { Exercise, IsoDate, Session } from '../models'

export type RepsAction = 'test' | 'build' | 'deload' | 'regress'

export interface RepsPrescription {
  exerciseId: string
  action: RepsAction
  /** Submaximal sets: `sets` × `reps`, leaving ~2 reps in reserve. */
  sets: number
  reps: number
  /** Density day: same total reps as the submax day, aim to finish faster than last time. */
  densityTotalReps: number
  /** Share of current max used for the submax sets. */
  fraction: number
  weekInCycle: number
  regression?: string
  accessories: string[]
}

export interface RepsInput {
  exercise: Exercise
  config: ProgressionConfig['repsEndurance']
  windowSessions: Session[]
  currentMax: number
  modifier: ProgressionModifier
  programStart: IsoDate
  today: IsoDate
}

/**
 * Plan for a max-reps goal: a max test every few weeks, otherwise submax volume that ramps
 * from ~50% to ~80% of the current max through each test cycle.
 */
export function suggestReps(input: RepsInput): RepsPrescription {
  const { exercise, config, windowSessions, currentMax, modifier, programStart, today } = input
  const lastTest =
    windowSessions
      .filter((s) => s.kind === 'test' && s.setLogs.some((l) => l.exerciseId === exercise.id))
      .map((s) => s.date)
      .sort()
      .at(-1) ?? programStart
  const weekInCycle = Math.max(0, Math.floor(diffDays(today, lastTest) / 7))

  let step = weekInCycle
  if (modifier.lighterLoad) step -= 1
  if (modifier.forceProgress) step += 1
  const fraction = Math.min(
    config.submaxFractionMax,
    Math.max(config.submaxFractionStart, config.submaxFractionStart + config.submaxFractionStep * step),
  )

  const base = {
    exerciseId: exercise.id,
    weekInCycle,
    accessories: exercise.accessories ?? [],
  }

  if (modifier.paused || currentMax < 1) {
    // Pain or no full rep yet: regress (e.g. band-assisted or negatives) at the easy end.
    const reps = Math.max(1, Math.round(currentMax * config.submaxFractionStart))
    return {
      ...base,
      action: 'regress',
      sets: config.submaxSets,
      reps,
      densityTotalReps: reps * config.submaxSets,
      fraction: config.submaxFractionStart,
      regression: exercise.regression,
    }
  }

  const reps = Math.max(1, Math.round(currentMax * fraction))
  const sets = modifier.suggestDeload
    ? Math.max(1, Math.ceil(config.submaxSets / 2))
    : config.submaxSets
  const testDue = weekInCycle >= config.maxTestEveryWeeks

  return {
    ...base,
    action: testDue ? 'test' : modifier.suggestDeload ? 'deload' : 'build',
    sets,
    reps,
    densityTotalReps: reps * sets,
    fraction,
  }
}
