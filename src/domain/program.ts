import type { ProgressionConfig } from '../config/progression.config'
import { activeModifier, type ProgressionModifier } from './checkIn'
import { weekStart } from './dates'
import { availableLoads } from './loads'
import { currentGoalValue } from './metrics'
import { activePlan } from './milestones'
import type { CheckIn, Exercise, Goal, IsoDate, Milestone, Profile, Session } from './models'
import { bestEstimatedOneRepMax } from './oneRepMax'
import { suggestCycling, type CyclingPrescription } from './progression/cycling'
import { suggestReps, type RepsPrescription } from './progression/endurance-reps'
import { suggestRunning, type RunningPrescription } from './progression/running'
import {
  resolveStrengthParams,
  suggestStrength,
  type StrengthPrescription,
} from './progression/strength'
import { suggestTimed, type TimedPrescription } from './progression/timed'

export type ProgramItem =
  | { kind: 'strength'; prescription: StrengthPrescription }
  | { kind: 'reps'; prescription: RepsPrescription; weighted?: StrengthPrescription }
  | { kind: 'timed'; prescription: TimedPrescription }
  | { kind: 'running'; prescription: RunningPrescription }
  | { kind: 'cycling'; prescription: CyclingPrescription }
  | { kind: 'unsupported' }

export interface WeekProgram {
  goalId: string
  weekOf: IsoDate
  sessionsPerWeek: number
  currentValue: number
  nextMilestone?: Milestone
  modifier: ProgressionModifier
  item: ProgramItem
}

export interface ProgramInput {
  goal: Goal
  exercises: Record<string, Exercise>
  windowSessions: Session[]
  checkIns: CheckIn[]
  today: IsoDate
  config: ProgressionConfig
  profile?: Profile
}

function strengthFor(
  exercise: Exercise,
  input: ProgramInput,
  modifier: ProgressionModifier,
  overrides: Partial<ReturnType<typeof resolveStrengthParams>> = {},
  startLoadKg?: number,
): StrengthPrescription {
  const { windowSessions, config, profile, goal, today } = input
  const params = { ...resolveStrengthParams(exercise, config), ...overrides }
  const loadType = exercise.loadType ?? 'plates'
  const sets = windowSessions.flatMap((s) => s.setLogs.filter((l) => l.exerciseId === exercise.id))
  return suggestStrength({
    exercise,
    params,
    windowSessions,
    currentE1rm: bestEstimatedOneRepMax(sets) ?? (goal.metric === 'oneRepMaxKg' ? goal.baseline : 0),
    startLoadKg,
    loads: availableLoads(loadType, profile?.equipment),
    baseKg: loadType === 'addedLoad' ? profile?.bodyMassKg : undefined,
    modifier,
    programStart: goal.startDate,
    today,
  })
}

/** This week's program for one goal, toward its next milestone. */
export function buildWeekProgram(input: ProgramInput): WeekProgram {
  const { goal, exercises, windowSessions, checkIns, today, config, profile } = input
  const exercise = exercises[goal.exerciseId]
  const currentValue = currentGoalValue(goal, windowSessions)
  const modifier = activeModifier(goal.windowId, goal.id, windowSessions, checkIns)
  const nextMilestone = activePlan(goal)?.milestones.find((m) => m.targetValue > currentValue)
  const common = {
    goalId: goal.id,
    weekOf: weekStart(today),
    sessionsPerWeek: goal.sessionsPerWeek,
    currentValue,
    nextMilestone,
    modifier,
  }
  if (exercise === undefined) return { ...common, item: { kind: 'unsupported' } }

  const shared = { windowSessions, modifier, programStart: goal.startDate, today }

  switch (exercise.progressionModel) {
    case 'strength':
      return {
        ...common,
        item: {
          kind: 'strength',
          prescription: strengthFor(exercise, input, modifier, {}, goal.startLoadKg),
        },
      }
    case 'repsEndurance': {
      const weightedExercise =
        exercise.weightedVariantId !== undefined ? exercises[exercise.weightedVariantId] : undefined
      const weighted =
        weightedExercise === undefined
          ? undefined
          : strengthFor(
              weightedExercise,
              input,
              modifier,
              {
                repRange: [...config.repsEndurance.weightedRepRange] as [number, number],
                workingSets: config.repsEndurance.weightedSets,
              },
              resolveStrengthParams(weightedExercise, config).loadIncrementKg,
            )
      return {
        ...common,
        item: {
          kind: 'reps',
          prescription: suggestReps({
            ...shared,
            exercise,
            config: config.repsEndurance,
            currentMax: currentValue,
          }),
          weighted,
        },
      }
    }
    case 'timed':
      return {
        ...common,
        item: {
          kind: 'timed',
          prescription: suggestTimed({
            exercise,
            config: config.timed,
            windowSessions,
            loads: availableLoads(exercise.loadType ?? 'bodyweight', profile?.equipment),
            loadIncrementKg: resolveStrengthParams(exercise, config).loadIncrementKg,
            startLoadKg: goal.startLoadKg,
            modifier,
          }),
        },
      }
    case 'running':
      return {
        ...common,
        item: {
          kind: 'running',
          prescription: suggestRunning({
            config: config.running,
            exerciseId: exercise.id,
            windowSessions,
            baselineSec: goal.metric === 'maxDurationSec' ? goal.baseline : 0,
            targetSec: goal.metric === 'maxDurationSec' ? goal.target : Number.POSITIVE_INFINITY,
            sessionsPerWeek: goal.sessionsPerWeek,
            modifier,
            today,
          }),
        },
      }
    case 'cycling':
      return {
        ...common,
        item: {
          kind: 'cycling',
          prescription: suggestCycling({
            ...shared,
            config: config.cycling,
            exerciseId: exercise.id,
            currentLongestM: currentValue,
            targetLongestM: goal.target,
            sessionsPerWeek: goal.sessionsPerWeek,
          }),
        },
      }
    default:
      return { ...common, item: { kind: 'unsupported' } }
  }
}
