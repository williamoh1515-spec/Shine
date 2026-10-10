import { exercisesById } from '../config/windows.config'
import type { ProgressionModifier } from '../domain/checkIn'
import type { GoalMetric, IssueType, MilestonePlan } from '../domain/models'
import type { StrengthAction, StrengthNote } from '../domain/progression/strength'

// Display formatting lives in the UI layer. Storage stays kg / metres / seconds.

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString()

export function formatMetric(metric: GoalMetric, value: number): string {
  switch (metric) {
    case 'oneRepMaxKg':
      return `${oneDecimal(value)} kg`
    case 'maxReps':
      return `${Math.round(value)} reps`
    case 'distanceM':
      return `${oneDecimal(value / 1000)} km`
  }
}

export function metricLabel(metric: GoalMetric): string {
  switch (metric) {
    case 'oneRepMaxKg':
      return 'Estimated 1RM'
    case 'maxReps':
      return 'Best set (reps)'
    case 'distanceM':
      return 'Ride distance'
  }
}

export function formatKg(kg: number): string {
  return `${oneDecimal(kg)} kg`
}

export function formatKm(m: number): string {
  return `${oneDecimal(m / 1000)} km`
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return date
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function exerciseName(id: string): string {
  return exercisesById[id]?.name ?? id
}

export const strengthActionText: Record<StrengthAction, string> = {
  start: 'Starting load: find your groove',
  increaseLoad: 'All sets hit the top of the range → add weight',
  addReps: 'Same weight, aim for one more rep per set',
  deload: 'Deload: same weight, fewer sets, let your body catch up',
  stallReset: 'Stalled 3 sessions → drop ~10% and build back',
  lighter: 'Felt too hard → lighter this time',
  regress: 'Pain reported → progression paused, easier variation',
}

export const strengthNoteText: Record<StrengthNote, string> = {
  rirMissing: 'Tip: log RIR (reps in reserve) so the advice can be more precise.',
  lowFeeling: 'Your recent sessions felt rough. Recovery first.',
  plannedDeload: 'Planned deload: it has been a while since the last one.',
  zeroBaseline: 'No baseline yet: do a test session to calibrate loads.',
}

export const issueLabels: Record<IssueType, { title: string; icon: string; effect: string }> = {
  pain: {
    icon: '🩹',
    title: 'Pain or discomfort',
    effect: 'Progression is paused for this window and an easier variation is suggested. No XP or streak lost.',
  },
  tooHard: {
    icon: '🥵',
    title: 'Too hard',
    effect: 'Next session uses a lighter load (about −10%) or steps back in the cycle.',
  },
  tooEasy: {
    icon: '😎',
    title: 'Too easy',
    effect: 'The next progression step is unlocked.',
  },
  missedSessions: {
    icon: '📆',
    title: 'Missed sessions',
    effect: 'Milestone dates are re-planned from today. No guilt.',
  },
  plateau: {
    icon: '🧱',
    title: 'Stuck / plateau',
    effect: 'A deload is suggested, then build back up (or swap the variation).',
  },
}

export function activeAdjustments(m: ProgressionModifier): string[] {
  const out: string[] = []
  if (m.paused) out.push(issueLabels.pain.effect)
  if (m.lighterLoad) out.push(issueLabels.tooHard.effect)
  if (m.forceProgress) out.push(issueLabels.tooEasy.effect)
  if (m.suggestDeload) out.push(issueLabels.plateau.effect)
  return out
}

export const replanReasonText: Record<MilestonePlan['reason'], string> = {
  initial: 'Initial plan',
  ahead: 'Re-planned: you were ahead of schedule 🚀',
  behind: 'Re-planned: dates moved to stay realistic',
  missedSessions: 'Re-planned after missed sessions',
  manual: 'Re-planned manually',
}
