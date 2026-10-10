// Domain vocabulary. Units: kg, metres, seconds. Dates: ISO 'YYYY-MM-DD'.

export type IsoDate = string

export type WindowId = string

export type ProgressionModel =
  | 'strength'
  | 'repsEndurance'
  | 'timed'
  | 'running'
  | 'cycling'
  | 'custom'

/**
 * What a goal measures.
 * - oneRepMaxKg: estimated 1RM (plate-loaded lifts)
 * - workingLoadKg: heaviest load lifted for at least `goal.minReps` reps (fixed-weight kit, added load)
 * - maxReps: best single set
 * - maxDurationSec: longest hold / carry / run
 * - distanceM: longest ride
 */
export type GoalMetric = 'oneRepMaxKg' | 'workingLoadKg' | 'maxReps' | 'maxDurationSec' | 'distanceM'

/**
 * How load is added. Drives which loads exist (see domain/loads.ts).
 * - plates: near-continuous small jumps (barbell, machines)
 * - kettlebell: one bell from the owned set
 * - kettlebellPair: two different owned bells together (carries, split squats)
 * - addedLoad: a bell hung from a belt, on top of bodyweight (weighted pull-ups/dips)
 * - bodyweight: no external load
 */
export type LoadType = 'plates' | 'kettlebell' | 'kettlebellPair' | 'addedLoad' | 'bodyweight'

/** Body regions an exercise or sport fatigues. Used for recovery rules. */
export type FatigueTag = 'pull' | 'push' | 'grip' | 'shoulder' | 'legs' | 'posteriorChain' | 'core'

/** Extra difficulty when load can't go up (equipment limit). */
export type Technique = 'tempo' | 'pause' | 'range'

/** Main lift family, used to judge training level from strength relative to bodyweight. */
export type LiftClass = 'squat' | 'hinge' | 'horizontalPush' | 'verticalPush'

export interface Equipment {
  /** Owned kettlebells, kg. */
  kettlebellsKg: number[]
  pullUpBar: boolean
  bands: boolean
  /** Smallest plate jump available, kg. Undefined = no plates. */
  plateIncrementKg?: number
}

export interface Profile {
  name?: string
  bodyMassKg?: number
  heightCm?: number
  equipment?: Equipment
}

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
  /** Hidden by the user (built-ins are hidden rather than deleted). */
  hidden?: boolean
}

export interface Exercise {
  id: string
  name: string
  progressionModel: ProgressionModel
  /** 'upper' | 'lower' picks the default load jump for strength exercises. */
  region?: 'upper' | 'lower'
  /** Defaults to 'plates' for strength, 'bodyweight' otherwise. */
  loadType?: LoadType
  /** Set on the big lifts so strength can be compared with bodyweight standards. */
  liftClass?: LiftClass
  /** 2 for dumbbell lifts logged per dumbbell (total moved = 2 × the logged load). Default 1. */
  implementCount?: 1 | 2
  fatigueTags?: FatigueTag[]
  /** Per-exercise overrides of progression config. */
  overrides?: {
    repRange?: [number, number]
    loadIncrementKg?: number
    workingSets?: number
    /** Timed exercises: target hold per set before moving up the ladder. */
    maxHoldSec?: number
  }
  /** Hidden by the user (built-ins are hidden rather than deleted). */
  hidden?: boolean
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
  /** Extra difficulty used on this set (slow eccentric, pause, bigger range). */
  technique?: Technique
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
  /** workingLoadKg goals: reps a load must be lifted for to count. */
  minReps?: number
  /** Current working load to start the program from (fixed-weight kit). */
  startLoadKg?: number
  /** Set when the goal was reached and replaced by a new one. Completed goals stay as history. */
  completedOn?: IsoDate
  /** "Not now" on a raise-your-goal suggestion; it comes back after the next logged session. */
  dismissedRaiseAt?: IsoDate
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
