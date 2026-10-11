import { addDays, weekStart } from './dates'
import type { IsoDate } from './models'

// Daily habit streak: consecutive days with a tick. A configured number of missed days per week
// (Mon–Sun) is forgiven ("free pass"); another miss in the same week resets the streak.
// Today never breaks the streak: the day is still open until it ends.

export type DayStatus = 'done' | 'pass' | 'missed'

export interface DailyStreak {
  /** Days in a row right now (ticked days only; forgiven days keep the streak alive without adding). */
  current: number
  best: number
  doneToday: boolean
  /** Status per day from the first tick to yesterday, plus today when ticked. */
  days: Map<IsoDate, DayStatus>
  /** The streak length after each ticked day, oldest first (for achievements). */
  streakOnDate: { date: IsoDate; streak: number }[]
  /** Whether this week's free pass is still unused. */
  passAvailable: boolean
}

export function dailyStreak(checked: IsoDate[], today: IsoDate, freePassesPerWeek: number): DailyStreak {
  const ticks = new Set(checked.filter((d) => d <= today))
  const days = new Map<IsoDate, DayStatus>()
  const streakOnDate: DailyStreak['streakOnDate'] = []
  const first = [...ticks].sort()[0]
  if (first === undefined) {
    return { current: 0, best: 0, doneToday: false, days, streakOnDate, passAvailable: freePassesPerWeek > 0 }
  }

  let streak = 0
  let best = 0
  let week = weekStart(first)
  let passesUsed = 0
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const w = weekStart(d)
    if (w !== week) {
      week = w
      passesUsed = 0
    }
    if (ticks.has(d)) {
      streak++
      best = Math.max(best, streak)
      days.set(d, 'done')
      streakOnDate.push({ date: d, streak })
    } else if (d === today) {
      // Still open: neither a miss nor a pass.
    } else if (streak > 0 && passesUsed < freePassesPerWeek) {
      passesUsed++
      days.set(d, 'pass')
    } else {
      streak = 0
      days.set(d, 'missed')
    }
  }
  return {
    current: streak,
    best,
    doneToday: ticks.has(today),
    days,
    streakOnDate,
    passAvailable: passesUsed < freePassesPerWeek,
  }
}

export interface WeekDot {
  date: IsoDate
  status: DayStatus | 'open' | 'empty'
}

/** The last 7 days ending today, for the little strip under the streak. */
export function lastSevenDays(streak: DailyStreak, today: IsoDate): WeekDot[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6)
    const status = streak.days.get(date)
    if (status !== undefined) return { date, status }
    return { date, status: date === today ? 'open' : 'empty' }
  })
}
