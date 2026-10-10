import type { ProgressionModifier } from '../domain/checkIn'
import type { Exercise, FatigueTag, GoalMetric, IssueType, LoadType, MilestonePlan, ProgressionModel, Technique } from '../domain/models'
import type { GoalSuggestion } from '../domain/naturalPace'
import type { PriorBasis } from '../domain/priors'
import type { StrengthAction, StrengthNote } from '../domain/progression/strength'

// Display formatting lives in the UI layer. Storage stays kg / metres / seconds.

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString()

/** 95 → "1:35", 1800 → "30 min", 1830 → "30:30". */
export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  if (s < 600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  if (s % 60 === 0) return `${s / 60} min`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatMetric(metric: GoalMetric, value: number): string {
  switch (metric) {
    case 'oneRepMaxKg':
    case 'workingLoadKg':
      return `${oneDecimal(value)} kg`
    case 'maxReps':
      return `${Math.round(value)} reps`
    case 'maxDurationSec':
      return value < 600 ? `${Math.round(value)} s` : formatDuration(value)
    case 'distanceM':
      return `${oneDecimal(value / 1000)} km`
  }
}

export function metricLabel(metric: GoalMetric): string {
  switch (metric) {
    case 'oneRepMaxKg':
      return 'Estimated 1RM'
    case 'workingLoadKg':
      return 'Working load'
    case 'maxReps':
      return 'Best set (reps)'
    case 'maxDurationSec':
      return 'Longest (time)'
    case 'distanceM':
      return 'Distance'
  }
}

/** Unit the user types for a metric; duration is seconds for holds, minutes for runs. */
export function metricInputUnit(metric: GoalMetric, model: ProgressionModel | undefined): { label: string; factor: number } {
  switch (metric) {
    case 'distanceM':
      return { label: 'km', factor: 1000 }
    case 'maxDurationSec':
      return model === 'running' ? { label: 'min', factor: 60 } : { label: 'seconds', factor: 1 }
    case 'maxReps':
      return { label: 'reps', factor: 1 }
    case 'oneRepMaxKg':
      return { label: 'kg (est. 1RM)', factor: 1 }
    case 'workingLoadKg':
      return { label: 'kg', factor: 1 }
  }
}

/** "+0.8 kg/week", "+0.5 reps/week", "+1 min/week", "+5 s/week", "+2 km/week". */
export function formatPerWeek(metric: GoalMetric, perWeek: number, model: ProgressionModel | undefined): string {
  const sign = perWeek < 0 ? '−' : '+'
  const v = Math.abs(perWeek)
  switch (metric) {
    case 'oneRepMaxKg':
    case 'workingLoadKg':
      return `${sign}${oneDecimal(v)} kg/week`
    case 'maxReps':
      return `${sign}${oneDecimal(v)} reps/week`
    case 'maxDurationSec':
      return model === 'running' ? `${sign}${oneDecimal(v / 60)} min/week` : `${sign}${oneDecimal(v)} s/week`
    case 'distanceM':
      return `${sign}${oneDecimal(v / 1000)} km/week`
  }
}

const levelText = { novice: 'newer', intermediate: 'intermediate', advanced: 'advanced' } as const

export const priorBasisText: Record<PriorBasis, string> = {
  research: 'research-based',
  extrapolated: 'estimated from related lifts',
  heuristic: 'rule of thumb',
}

/** One line explaining where a suggested target comes from. */
export function paceNote(metric: GoalMetric, s: GoalSuggestion): string {
  const gain = `+${formatMetric(metric, s.expectedGain)} in ${s.horizonWeeks} weeks`
  const who = s.level ? ` for a ${levelText[s.level]} lifter` : ''
  const mine = s.personal ? ', adjusted to your own logged pace' : ''
  return `Expected pace${who}: about ${gain} (${priorBasisText[s.basis]}${mine}). The goal is set at that pace: a push, but reachable.`
}

export const metricOptionText: Record<GoalMetric, string> = {
  oneRepMaxKg: 'Estimated 1RM (kg)',
  workingLoadKg: 'Load for N reps (kg)',
  maxReps: 'Max reps in a set',
  maxDurationSec: 'Longest time',
  distanceM: 'Longest distance',
}

export const modelText: Record<ProgressionModel, string> = {
  strength: 'Strength (sets × reps with load)',
  repsEndurance: 'Max reps (bodyweight)',
  timed: 'Timed hold / carry',
  running: 'Running (easy, by time)',
  cycling: 'Cycling',
  custom: 'Other',
}

export const loadTypeText: Record<LoadType, string> = {
  plates: 'Barbell / plates',
  kettlebell: 'One kettlebell',
  kettlebellPair: 'Two kettlebells',
  addedLoad: 'Bodyweight + added kg',
  bodyweight: 'Bodyweight only',
}

export const fatigueTagText: Record<FatigueTag, string> = {
  pull: 'Pulling',
  push: 'Pushing',
  grip: 'Grip / fingers',
  shoulder: 'Shoulders',
  legs: 'Legs',
  posteriorChain: 'Posterior chain',
  core: 'Core',
}

export const techniqueText: Record<Technique, string> = {
  tempo: '3 s lowering (slow eccentric)',
  pause: '2 s pause at the bottom',
  range: 'bigger range (e.g. deficit)',
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

export function exerciseName(id: string, exercisesById: Record<string, Exercise>): string {
  return exercisesById[id]?.name ?? id
}

export const strengthActionText: Record<StrengthAction, string> = {
  start: 'Starting load: find your groove',
  increaseLoad: 'All sets hit the top of the range → add weight',
  addReps: 'Same weight, aim for one more rep per set',
  ladder: 'Top of the range reached, but the next weight is too big a jump → make it harder another way',
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
  bigJump: 'Big jump to the next weight: start at the bottom of the rep range.',
  heavierEquipment: 'You have outgrown your heaviest weight here: a heavier kettlebell (or a harder variation) is next.',
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
