import type { ProgressionConfig } from '../../config/progression.config'
import type { ProgressionModifier } from '../checkIn'
import { addDays, diffDays, weekStart } from '../dates'
import type { IsoDate, Session } from '../models'

export type CyclingAction = 'build' | 'recovery' | 'regress' | 'hold'

export interface CyclingPrescription {
  action: CyclingAction
  weeklyMinutes: number
  easyMinutes: number
  hardMinutes: number
  longRideM: number
  rides: number
}

export interface CyclingInput {
  config: ProgressionConfig['cycling']
  exerciseId: string
  windowSessions: Session[]
  /** Current longest ride (m). */
  currentLongestM: number
  targetLongestM: number
  sessionsPerWeek: number
  modifier: ProgressionModifier
  programStart: IsoDate
  today: IsoDate
}

function minutesInWeek(sessions: Session[], exerciseId: string, monday: IsoDate): number {
  const sunday = addDays(monday, 6)
  const seconds = sessions
    .filter((s) => s.date >= monday && s.date <= sunday)
    .flatMap((s) => s.setLogs)
    .filter((l) => l.exerciseId === exerciseId)
    .reduce((sum, l) => sum + (l.durationSec ?? 0), 0)
  return seconds / 60
}

/** Average weekly minutes over the last completed weeks that had any riding. */
export function recentWeeklyMinutes(
  sessions: Session[],
  exerciseId: string,
  today: IsoDate,
  lookbackWeeks: number,
): number | undefined {
  const thisMonday = weekStart(today)
  const weeks: number[] = []
  for (let i = 1; i <= lookbackWeeks; i++) {
    const minutes = minutesInWeek(sessions, exerciseId, addDays(thisMonday, -7 * i))
    if (minutes > 0) weeks.push(minutes)
  }
  if (weeks.length === 0) return undefined
  return weeks.reduce((a, b) => a + b, 0) / weeks.length
}

/** Weekly cycling plan: polarized 80/20 split, volume growth capped at 10%/week. */
export function suggestCycling(input: CyclingInput): CyclingPrescription {
  const { config, exerciseId, windowSessions, currentLongestM, targetLongestM, modifier } = input
  const reference =
    recentWeeklyMinutes(windowSessions, exerciseId, input.today, config.volumeLookbackWeeks) ??
    config.defaultWeeklyMinutes
  const weekIndex = Math.floor(diffDays(input.today, input.programStart) / 7) + 1
  const recoveryWeek = weekIndex > 0 && weekIndex % config.recoveryEveryWeeks === 0

  let action: CyclingAction = 'build'
  let weeklyMinutes = reference * (1 + config.maxWeeklyVolumeIncrease)
  if (modifier.paused) {
    action = 'regress'
    weeklyMinutes = reference * config.recoveryVolumeFraction
  } else if (recoveryWeek || modifier.suggestDeload) {
    action = 'recovery'
    weeklyMinutes = reference * config.recoveryVolumeFraction
  } else if (modifier.lighterLoad) {
    action = 'hold'
    weeklyMinutes = reference
  }
  weeklyMinutes = Math.round(weeklyMinutes / 5) * 5

  // Pain → all easy riding.
  const easyShare = action === 'regress' ? 1 : config.easyShare
  const easyMinutes = Math.round(weeklyMinutes * easyShare)
  const longestBase = currentLongestM > 0 ? currentLongestM : config.defaultLongRideM
  const longGrowth = action === 'build' ? 1 + config.maxWeeklyVolumeIncrease : 1
  const longRideM = Math.min(
    Math.max(targetLongestM, longestBase),
    Math.round((longestBase * longGrowth) / 1000) * 1000,
  )

  return {
    action,
    weeklyMinutes,
    easyMinutes,
    hardMinutes: weeklyMinutes - easyMinutes,
    longRideM,
    rides: Math.max(1, input.sessionsPerWeek),
  }
}
