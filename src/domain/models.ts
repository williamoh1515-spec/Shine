// Domain vocabulary. Units: kg, metres, seconds. Dates: ISO 'YYYY-MM-DD'.

export type IsoDate = string

export type WindowId = string

export type ProgressionModel = 'strength' | 'repsEndurance' | 'running' | 'cycling' | 'custom'

/** What a goal measures. Strength goals are a 1RM in kg (tracked via estimated 1RM). */
export type GoalMetric = 'oneRepMaxKg' | 'maxReps' | 'distanceM'

export interface BodyPart {
  id: string
  title: string
  exerciseIds: string[]
}

export interface TrainingWindow {
  id: WindowId
  title: string
  icon: string
  enabled: boolean
  /** Optional grouping inside a window, e.g. Pull / Push / Legs inside Strength. */
  bodyParts: BodyPart[]
}

export interface Exercise {
  id: string
  name: string
  progressionModel: ProgressionModel
  /** 'upper' | 'lower' picks the default load jump for strength exercises. */
  region?: 'upper' | 'lower'
  /** Per-exercise overrides of progression config. */
  overrides?: {
    repRange?: [number, number]
    loadIncrementKg?: number
    workingSets?: number
  }
  /** Easier variation suggested on pain or plateau. */
  regression?: string
  /** Supporting exercises added to this exercise's program (e.g. rear-delt work for pull-ups). */
  accessories?: string[]
  /** Separate exercise used for low-rep weighted strength work (e.g. weighted pull-up). */
  weightedVariantId?: string
  notes?: string
}

export interface SetLog {
  exerciseId: string
  reps?: number
  loadKg?: number
  durationSec?: number
  distanceM?: number
  /** Reps in reserve. Missing = not logged. */
  rir?: number
  notes?: string
}

export type SessionKind = 'training' | 'test' | 'deload'

export interface Session {
  id: string
  date: IsoDate
  windowId: WindowId
  kind: SessionKind
  setLogs: SetLog[]
  painFlag?: boolean
  /** 1 (awful) – 5 (great) */
  feeling?: number
  demo?: boolean
}

export interface Milestone {
  index: number
  /** Share of the baseline→goal gap this milestone represents (0–1). */
  fraction: number
  targetValue: number
  targetDate: IsoDate
}

export interface MilestonePlan {
  createdOn: IsoDate
  reason: 'initial' | 'ahead' | 'behind' | 'missedSessions' | 'manual'
  fromValue: number
  milestones: Milestone[]
}

export interface Goal {
  id: string
  windowId: WindowId
  exerciseId: string
  title: string
  metric: GoalMetric
  baseline: number
  baselineSource: 'test' | 'manual'
  target: number
  startDate: IsoDate
  sessionsPerWeek: number
  /** Newest last. The last plan is the active one; older ones are history. */
  plans: MilestonePlan[]
  demo?: boolean
}

export type IssueType = 'pain' | 'tooHard' | 'tooEasy' | 'missedSessions' | 'plateau'

export interface CheckIn {
  id: string
  date: IsoDate
  windowId: WindowId
  goalId?: string
  issue: IssueType
  note: string
  demo?: boolean
}

export type AchievementRule =
  | { type: 'sessionCount'; count: number }
  | { type: 'personalRecord'; count: number }
  | { type: 'milestonesHit'; count: number }
  | { type: 'weeklyStreak'; weeks: number }
  | { type: 'rirLoggedSessions'; count: number }
  | { type: 'testSessions'; count: number }
  | { type: 'deloadSessions'; count: number }
  | { type: 'checkIns'; count: number }

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  rule: AchievementRule
}

export interface UnlockedAchievement {
  achievement: Achievement
  unlockedOn: IsoDate
}
