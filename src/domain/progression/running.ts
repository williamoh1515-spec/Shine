import type { ProgressionConfig } from '../../config/progression.config'
import type { ProgressionModifier } from '../checkIn'
import { addDays } from '../dates'
import type { IsoDate, Session } from '../models'

// Easy-run progression by duration. The cap is per run, relative to the longest run of the last
// 30 days (Nielsen et al. 2025), rather than the weekly "10% rule".

export type RunningAction = 'start' | 'build' | 'repeat' | 'regress' | 'goalReached'

export interface RunningPrescription {
  action: RunningAction
  longRunSec: number
  shortRunSec: number
  runs: number
  /** Longest run of the lookback window (seconds), the base for the cap. */
  longest30dSec: number
  /** Hard ceiling for any single run this week. */
  capSec: number
}

export interface RunningInput {
  config: ProgressionConfig['running']
  exerciseId: string
  windowSessions: Session[]
  /** Fallback longest run when nothing is logged yet (goal baseline). */
  baselineSec: number
  targetSec: number
  sessionsPerWeek: number
  modifier: ProgressionModifier
  today: IsoDate
}

export function longestRunSince(
  sessions: Session[],
  exerciseId: string,
  from: IsoDate,
  to: IsoDate,
): number | undefined {
  let best: number | undefined
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue
    for (const l of s.setLogs) {
      if (l.exerciseId !== exerciseId || l.durationSec === undefined) continue
      if (best === undefined || l.durationSec > best) best = l.durationSec
    }
  }
  return best
}

const roundToMinute = (sec: number) => Math.max(60, Math.round(sec / 60) * 60)

export function suggestRunning(input: RunningInput): RunningPrescription {
  const { config, modifier } = input
  const from = addDays(input.today, -config.lookbackDays)
  const logged = longestRunSince(input.windowSessions, input.exerciseId, from, input.today)
  const longest = logged ?? (input.baselineSec > 0 ? input.baselineSec : config.defaultLongRunSec)
  const capSec = Math.floor(longest * (1 + config.maxSingleRunIncrease))
  const runs = Math.max(1, input.sessionsPerWeek)
  const make = (action: RunningAction, longRunSec: number): RunningPrescription => {
    const long = Math.min(capSec, roundToMinute(longRunSec))
    return {
      action,
      longRunSec: long,
      shortRunSec: roundToMinute(long * config.shortRunFraction),
      runs,
      longest30dSec: longest,
      capSec,
    }
  }

  if (modifier.paused) return make('regress', longest * config.shortRunFraction)
  if (logged === undefined) return make('start', longest)
  if (longest >= input.targetSec) return make('goalReached', input.targetSec)
  // Repeating a week beats adding load when the last week felt hard.
  if (modifier.lighterLoad || modifier.suggestDeload) return make('repeat', longest)
  const step = modifier.forceProgress ? config.maxSingleRunIncrease : config.runIncrease
  return make('build', Math.min(input.targetSec, longest * (1 + step)))
}
