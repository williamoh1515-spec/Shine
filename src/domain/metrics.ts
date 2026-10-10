import type { Goal, GoalMetric, IsoDate, Session, SetLog } from './models'
import { bestEstimatedOneRepMax } from './oneRepMax'

/** The value a single session achieved for a goal metric on one exercise, if any. */
export function sessionValue(
  metric: GoalMetric,
  exerciseId: string,
  session: Session,
  minReps = 1,
): number | undefined {
  const sets = session.setLogs.filter((s) => s.exerciseId === exerciseId)
  if (sets.length === 0) return undefined
  switch (metric) {
    case 'oneRepMaxKg':
      return bestEstimatedOneRepMax(sets)
    case 'workingLoadKg':
      return maxOf(
        sets.filter((s) => (s.reps ?? 0) >= minReps),
        (s) => s.loadKg ?? 0,
      )
    case 'maxReps':
      return maxOf(sets, (s) => s.reps)
    case 'maxDurationSec':
      return maxOf(sets, (s) => s.durationSec)
    case 'distanceM':
      return maxOf(sets, (s) => s.distanceM)
  }
}

function maxOf(sets: SetLog[], pick: (s: SetLog) => number | undefined): number | undefined {
  let best: number | undefined
  for (const s of sets) {
    const v = pick(s)
    if (v !== undefined && (best === undefined || v > best)) best = v
  }
  return best
}

export interface ValuePoint {
  date: IsoDate
  value: number
}

/** Per-session values for a goal, oldest first, from the goal's start date on. */
export function goalHistory(goal: Goal, sessions: Session[]): ValuePoint[] {
  return sessions
    .filter((s) => s.date >= goal.startDate)
    .map((s) => ({ date: s.date, value: sessionValue(goal.metric, goal.exerciseId, s, goal.minReps) }))
    .filter((p): p is ValuePoint => p.value !== undefined)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Best value reached so far (never below baseline). */
export function currentGoalValue(goal: Goal, sessions: Session[]): number {
  return goalHistory(goal, sessions).reduce((best, p) => Math.max(best, p.value), goal.baseline)
}

/** Share of the baseline→target gap that is done, clamped to [0, 1]. */
export function goalProgress(goal: Goal, currentValue: number): number {
  const gap = goal.target - goal.baseline
  if (gap <= 0) return 1
  return Math.min(1, Math.max(0, (currentValue - goal.baseline) / gap))
}
