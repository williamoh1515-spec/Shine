import { achievements } from '../../config/achievements.config'
import { gamificationConfig, progressionConfig } from '../../config/progression.config'
import type { Catalog } from '../../domain/catalog'
import {
  computeXp,
  evaluateAchievements,
  levelFromXp,
  personalRecords,
  rirFullyLogged,
  weeklyStreak,
  type LevelInfo,
  type PersonalRecord,
  type StreakSummary,
} from '../../domain/gamification'
import { currentGoalValue, goalHistory, goalProgress, type ValuePoint } from '../../domain/metrics'
import { projectionFor } from '../../domain/goals'
import { earnedMilestoneDates, milestoneStatuses, type MilestoneStatus } from '../../domain/milestones'
import { fastProgressSuggestion, observedRate, personalPace, type RaiseSuggestion } from '../../domain/personalPace'
import { priorRate, type PriorRate } from '../../domain/priors'
import type { CheckIn, Goal, IsoDate, Profile, Session, TrainingWindow, UnlockedAchievement, WindowId } from '../../domain/models'
import { suggestNextGoal, type GoalSuggestion } from '../../domain/naturalPace'
import { buildWeekProgram, type WeekProgram } from '../../domain/program'

/** Planned sessions/week for a window with no goals yet. Assumption for the prototype. */
const DEFAULT_PLANNED_PER_WEEK = 2

export interface GoalView {
  goal: Goal
  currentValue: number
  progress: number
  history: ValuePoint[]
  milestones: MilestoneStatus[]
  program: WeekProgram
  /** Present once the goal is reached: the next, higher goal to take on. */
  suggestion?: GoalSuggestion
  /**
   * Expected pace (research prior for this exercise and lifter), the pace actually logged, and the
   * pace to plan dates with when the goal is changed (your own, once there is enough data).
   */
  pace?: { prior: PriorRate; observedPerWeek?: number; planningPerWeek?: number }
  /** Present when progress is clearly faster than expected: a more ambitious target. */
  raise?: RaiseSuggestion
}

export interface WindowView {
  window: TrainingWindow
  /** Open goals. */
  goals: GoalView[]
  /** Reached goals that were replaced by a new one; kept as history. */
  completedGoals: GoalView[]
  sessions: Session[]
  level: LevelInfo
  xp: number
  plannedPerWeek: number
}

export interface AppState {
  windows: WindowView[]
  /** Windows that are hidden until a goal is set (can be started from the landing page). */
  dormantWindows: TrainingWindow[]
  xp: number
  level: LevelInfo
  streak: StreakSummary
  prs: PersonalRecord[]
  unlocked: UnlockedAchievement[]
  milestonesHit: number
  hasDemo: boolean
  catalog: Catalog
  profile: Profile
}

export function deriveAppState(
  goals: Goal[],
  sessions: Session[],
  checkIns: CheckIn[],
  today: IsoDate,
  catalog: Catalog,
  profile: Profile,
): AppState {
  const { windows, exercisesById } = catalog
  const goalViewsFor = (windowId: WindowId): GoalView[] => {
    const windowSessions = sessions.filter((s) => s.windowId === windowId)
    return goals
      .filter((g) => g.windowId === windowId)
      .map((goal) => {
        const history = goalHistory(goal, windowSessions)
        const currentValue = currentGoalValue(goal, windowSessions)
        const exercise = exercisesById[goal.exerciseId]
        const recent = { points: history, today }
        const prior = exercise && priorRate(goal.metric, exercise, currentValue, profile.bodyMassKg, progressionConfig)
        const observed = observedRate(history, today, progressionConfig.personalPace)
        return {
          goal,
          currentValue,
          progress: goalProgress(goal, currentValue),
          history,
          milestones: milestoneStatuses(goal, history),
          program: buildWeekProgram({
            goal, exercises: exercisesById, windowSessions, checkIns, today, config: progressionConfig, profile,
          }),
          suggestion:
            exercise === undefined
              ? undefined
              : suggestNextGoal(goal, currentValue, exercise, profile.bodyMassKg, progressionConfig, recent),
          pace:
            prior === undefined
              ? undefined
              : {
                  prior,
                  observedPerWeek: observed?.perWeek,
                  planningPerWeek:
                    observed === undefined ? undefined : personalPace(prior.perWeek, observed, progressionConfig.personalPace),
                },
          raise:
            exercise === undefined || prior === undefined
              ? undefined
              : fastProgressSuggestion(
                  goal,
                  history,
                  currentValue,
                  prior.perWeek,
                  projectionFor(goal.metric, exercise, progressionConfig).roundTo,
                  today,
                  progressionConfig,
                ),
        }
      })
  }

  const visible = windows.filter((w) => w.enabled || goals.some((g) => g.windowId === w.id))
  const dormantWindows = windows.filter((w) => !visible.includes(w))

  const plannedPerWeek: Record<WindowId, number> = {}
  for (const w of visible) {
    const own = goals
      .filter((g) => g.windowId === w.id && g.completedOn === undefined)
      .map((g) => g.sessionsPerWeek)
    plannedPerWeek[w.id] = own.length > 0 ? Math.max(...own) : DEFAULT_PLANNED_PER_WEEK
  }

  const xp = computeXp(sessions, checkIns, plannedPerWeek, gamificationConfig)
  const windowViews: WindowView[] = visible.map((w) => {
    const windowXp = xp.byWindow[w.id] ?? 0
    const all = goalViewsFor(w.id)
    return {
      window: w,
      goals: all.filter((g) => g.goal.completedOn === undefined),
      completedGoals: all.filter((g) => g.goal.completedOn !== undefined),
      sessions: sessions.filter((s) => s.windowId === w.id),
      xp: windowXp,
      level: levelFromXp(windowXp, gamificationConfig),
      plannedPerWeek: plannedPerWeek[w.id] ?? DEFAULT_PLANNED_PER_WEEK,
    }
  })

  const streakTarget = Math.max(1, Object.values(plannedPerWeek).reduce((a, b) => a + b, 0))
  const streak = weeklyStreak(sessions, checkIns, streakTarget, today, gamificationConfig)
  const prs = personalRecords(sessions)
  // Completed goals and milestones planned before a target change still count: they were earned.
  const milestoneHitDates = windowViews.flatMap((w) =>
    [...w.goals, ...w.completedGoals].flatMap((g) => earnedMilestoneDates(g.goal, g.history)),
  )

  const unlocked = evaluateAchievements(achievements, {
    sessionDates: sessions.map((s) => s.date),
    prDates: prs.map((p) => p.date),
    milestoneHitDates,
    rirLoggedDates: sessions.filter(rirFullyLogged).map((s) => s.date),
    testDates: sessions.filter((s) => s.kind === 'test').map((s) => s.date),
    deloadDates: sessions.filter((s) => s.kind === 'deload').map((s) => s.date),
    checkInDates: checkIns.map((c) => c.date),
    streakWeeks: streak.weeks,
  })

  return {
    windows: windowViews,
    dormantWindows,
    xp: xp.total,
    level: levelFromXp(xp.total, gamificationConfig),
    streak,
    prs,
    unlocked,
    milestonesHit: milestoneHitDates.length,
    hasDemo: goals.some((g) => g.demo) || sessions.some((s) => s.demo),
    catalog,
    profile,
  }
}
