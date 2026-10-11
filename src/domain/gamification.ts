import type { GamificationConfig } from '../config/progression.config'
import { addDays, monthKey, weekStart } from './dates'
import type {
  Achievement,
  AchievementRule,
  CheckIn,
  IsoDate,
  Session,
  UnlockedAchievement,
  WindowId,
} from './models'
import { estimateOneRepMax } from './oneRepMax'

const byDate = <T extends { date: IsoDate }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

/** True when every set that has reps also has RIR logged. */
export function rirFullyLogged(session: Session): boolean {
  const withReps = session.setLogs.filter((l) => l.reps !== undefined)
  return withReps.length > 0 && withReps.every((l) => l.rir !== undefined)
}

/** XP from habits counts toward the global level but belongs to no training window. */
export const HABIT_XP_KEY = '_habits'

export interface XpSummary {
  total: number
  byWindow: Record<WindowId, number>
}

/**
 * XP rewards process: planned sessions, logged RIR, tests, deloads and honest check-ins.
 * Sessions beyond the weekly plan for a window earn nothing, and each day is capped.
 */
export function computeXp(
  sessions: Session[],
  checkIns: CheckIn[],
  plannedPerWeek: Record<WindowId, number>,
  config: GamificationConfig,
  /** Dates of daily-habit ticks; each earns a small amount, within the daily cap. */
  habitDates: IsoDate[] = [],
): XpSummary {
  const { xp } = config
  const events: { date: IsoDate; windowId: WindowId; amount: number }[] = []
  const countInWeek = new Map<string, number>()

  for (const s of [...sessions].sort(byDate)) {
    const key = `${s.windowId}|${weekStart(s.date)}`
    const n = (countInWeek.get(key) ?? 0) + 1
    countInWeek.set(key, n)
    if (n > (plannedPerWeek[s.windowId] ?? 0)) continue
    let amount = xp.completedSession
    if (rirFullyLogged(s)) amount += xp.rirLogged
    if (s.kind === 'test') amount += xp.testSession
    if (s.kind === 'deload') amount += xp.deloadSession
    events.push({ date: s.date, windowId: s.windowId, amount })
  }
  for (const c of checkIns) events.push({ date: c.date, windowId: c.windowId, amount: xp.checkIn })
  for (const date of habitDates) events.push({ date, windowId: HABIT_XP_KEY, amount: xp.habitTick })

  const usedPerDay = new Map<IsoDate, number>()
  const byWindow: Record<WindowId, number> = {}
  let total = 0
  for (const e of events.sort(byDate)) {
    const used = usedPerDay.get(e.date) ?? 0
    const granted = Math.max(0, Math.min(e.amount, xp.dailyCap - used))
    usedPerDay.set(e.date, used + granted)
    byWindow[e.windowId] = (byWindow[e.windowId] ?? 0) + granted
    total += granted
  }
  return { total, byWindow }
}

export interface LevelInfo {
  level: number
  xpIntoLevel: number
  xpForNext: number
}

export function xpNeededForLevel(level: number, config: GamificationConfig): number {
  return Math.round(config.levels.baseXp * Math.pow(level, config.levels.growth))
}

export function levelFromXp(totalXp: number, config: GamificationConfig): LevelInfo {
  let level = 1
  let remaining = Math.max(0, totalXp)
  while (remaining >= xpNeededForLevel(level, config)) {
    remaining -= xpNeededForLevel(level, config)
    level++
  }
  return { level, xpIntoLevel: remaining, xpForNext: xpNeededForLevel(level, config) }
}

export interface StreakWeek {
  weekOf: IsoDate
  sessions: number
  outcome: 'hit' | 'protected' | 'frozen' | 'missed' | 'inProgress'
  streak: number
}

export interface StreakSummary {
  current: number
  best: number
  thisWeekSessions: number
  target: number
  weeks: StreakWeek[]
}

/**
 * Weekly streak: a week counts when it has ≥ `target` sessions. Deload or pain weeks are
 * protected (never break the streak); one missed week per month is covered by a freeze.
 */
export function weeklyStreak(
  sessions: Session[],
  checkIns: CheckIn[],
  target: number,
  today: IsoDate,
  config: GamificationConfig,
): StreakSummary {
  const thisWeek = weekStart(today)
  const counts = new Map<IsoDate, number>()
  const protectedWeeks = new Set<IsoDate>()
  for (const s of sessions) {
    const w = weekStart(s.date)
    counts.set(w, (counts.get(w) ?? 0) + 1)
    if (s.kind === 'deload' || s.painFlag) protectedWeeks.add(w)
  }
  for (const c of checkIns) if (c.issue === 'pain') protectedWeeks.add(weekStart(c.date))

  const first = [...counts.keys()].sort()[0]
  const weeks: StreakWeek[] = []
  const freezesUsed = new Map<string, number>()
  let streak = 0
  let best = 0
  for (let w = first ?? thisWeek; w <= thisWeek; w = addDays(w, 7)) {
    const n = counts.get(w) ?? 0
    let outcome: StreakWeek['outcome']
    if (n >= target && target > 0) {
      outcome = 'hit'
      streak++
    } else if (w === thisWeek) {
      outcome = 'inProgress'
    } else if (protectedWeeks.has(w)) {
      outcome = 'protected'
    } else if ((freezesUsed.get(monthKey(w)) ?? 0) < config.streak.freezesPerMonth) {
      outcome = 'frozen'
      freezesUsed.set(monthKey(w), (freezesUsed.get(monthKey(w)) ?? 0) + 1)
    } else {
      outcome = 'missed'
      streak = 0
    }
    best = Math.max(best, streak)
    weeks.push({ weekOf: w, sessions: n, outcome, streak })
  }
  return { current: streak, best, thisWeekSessions: counts.get(thisWeek) ?? 0, target, weeks }
}

export interface PersonalRecord {
  date: IsoDate
  exerciseId: string
  value: number
}

function setScore(l: Session['setLogs'][number]): number | undefined {
  if (l.loadKg !== undefined && l.loadKg > 0 && l.reps !== undefined) return estimateOneRepMax(l.loadKg, l.reps)
  if (l.distanceM !== undefined) return l.distanceM
  return l.reps
}

/** A PR is a session that beats every earlier session on the same exercise (first ever doesn't count). */
export function personalRecords(sessions: Session[]): PersonalRecord[] {
  const best = new Map<string, number>()
  const prs: PersonalRecord[] = []
  for (const s of [...sessions].sort(byDate)) {
    const sessionBest = new Map<string, number>()
    for (const l of s.setLogs) {
      const v = setScore(l)
      if (v === undefined) continue
      sessionBest.set(l.exerciseId, Math.max(v, sessionBest.get(l.exerciseId) ?? -Infinity))
    }
    for (const [exerciseId, value] of sessionBest) {
      const prev = best.get(exerciseId)
      if (prev !== undefined && value > prev) prs.push({ date: s.date, exerciseId, value })
      if (prev === undefined || value > prev) best.set(exerciseId, value)
    }
  }
  return prs
}

export interface AchievementFacts {
  sessionDates: IsoDate[]
  prDates: IsoDate[]
  milestoneHitDates: IsoDate[]
  rirLoggedDates: IsoDate[]
  testDates: IsoDate[]
  deloadDates: IsoDate[]
  checkInDates: IsoDate[]
  streakWeeks: StreakWeek[]
  /** Daily-habit streak length after each ticked day (oldest first). */
  habitStreak?: { date: IsoDate; streak: number }[]
}

function nthDate(dates: IsoDate[], n: number): IsoDate | undefined {
  return [...dates].sort()[n - 1]
}

function unlockDate(rule: AchievementRule, f: AchievementFacts): IsoDate | undefined {
  switch (rule.type) {
    case 'sessionCount':
      return nthDate(f.sessionDates, rule.count)
    case 'personalRecord':
      return nthDate(f.prDates, rule.count)
    case 'milestonesHit':
      return nthDate(f.milestoneHitDates, rule.count)
    case 'rirLoggedSessions':
      return nthDate(f.rirLoggedDates, rule.count)
    case 'testSessions':
      return nthDate(f.testDates, rule.count)
    case 'deloadSessions':
      return nthDate(f.deloadDates, rule.count)
    case 'checkIns':
      return nthDate(f.checkInDates, rule.count)
    case 'weeklyStreak': {
      const week = f.streakWeeks.find((w) => w.streak >= rule.weeks)
      return week === undefined ? undefined : addDays(week.weekOf, 6)
    }
    case 'habitStreak':
      return (f.habitStreak ?? []).find((p) => p.streak >= rule.days)?.date
  }
}

export function evaluateAchievements(
  definitions: Achievement[],
  facts: AchievementFacts,
): UnlockedAchievement[] {
  return definitions.flatMap((achievement) => {
    const unlockedOn = unlockDate(achievement.rule, facts)
    return unlockedOn === undefined ? [] : [{ achievement, unlockedOn }]
  })
}
