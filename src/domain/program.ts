import type { ProgressionConfig } from '../config/progression.config'
import { activeModifier, type ProgressionModifier } from './checkIn'
import { weekStart } from './dates'
import { currentGoalValue } from './metrics'
import { activePlan } from './milestones'
import type { CheckIn, Exercise, Goal, IsoDate, Milestone, Session } from './models'
import { bestEstimatedOneRepMax } from './oneRepMax'
import { suggestCycling, type CyclingPrescription } from './progression/cycling'
import { suggestReps, type RepsPrescription } from './progression/endurance-reps'
import {
  resolveStrengthParams,
  suggestStrength,
  type StrengthPrescription,
} from './progression/strength'

export type ProgramItem =
  | { kind: 'strength'; prescription: StrengthPrescription }
  | { kind: 'reps'; prescription: RepsPrescription; weighted?: StrengthPrescription }
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
}

/** This week's program for one goal, toward its next milestone. */
export function buildWeekProgram(input: ProgramInput): WeekProgram {
  const { goal, exercises, windowSessions, checkIns, today, config } = input
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
          prescription: suggestStrength({
            ...shared,
            exercise,
            params: resolveStrengthParams(exercise, config),
            currentE1rm: currentValue,
          }),
        },
      }
    case 'repsEndurance': {
      const weightedExercise =
        exercise.weightedVariantId !== undefined ? exercises[exercise.weightedVariantId] : undefined
      let weighted: StrengthPrescription | undefined
      if (weightedExercise !== undefined) {
        const params = {
          ...resolveStrengthParams(weightedExercise, config),
          repRange: [...config.repsEndurance.weightedRepRange] as [number, number],
          workingSets: config.repsEndurance.weightedSets,
        }
        const weightedSets = windowSessions.flatMap((s) =>
          s.setLogs.filter((l) => l.exerciseId === weightedExercise.id),
        )
        weighted = suggestStrength({
          ...shared,
          exercise: weightedExercise,
          params,
          currentE1rm: bestEstimatedOneRepMax(weightedSets) ?? 0,
          startLoadKg: params.loadIncrementKg,
        })
      }
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
