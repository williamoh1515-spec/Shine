import type { BalancePair, balanceConfig as BalanceConfigValue } from '../config/balance.config'
import { addDays } from './dates'
import type { Exercise, IsoDate, MuscleGroup, Session, SetLog } from './models'

// Opposite-muscle balance: measured strength ratios (from test exercises) and weekly set balance.

type BalanceConfig = typeof BalanceConfigValue

export type Verdict = 'ok' | 'lowA' | 'lowB'

export interface BalanceResult {
  pair: BalancePair
  /** Strength ratio a ÷ b from the latest test sets, when both sides were tested recently. */
  measured?: { a: number; b: number; ratio: number; verdict: Verdict }
  /** Weekly hard sets; undefined verdict means not enough data. */
  volume?: { aPerWeek: number; bPerWeek: number; ratio?: number; verdict?: Verdict }
  /** Exercises that train the low side (existing, visible ones). */
  fixes: string[]
}

const trains = (exercise: Exercise | undefined, muscles: MuscleGroup[]) =>
  exercise?.muscles?.some((m) => muscles.includes(m)) ?? false

/** Hard sets per week for a group of muscles over the window (deload sessions don't count). */
export function weeklySets(
  sessions: Session[],
  exercisesById: Record<string, Exercise>,
  muscles: MuscleGroup[],
  today: IsoDate,
  weeks: number,
): number {
  const from = addDays(today, -weeks * 7)
  let sets = 0
  for (const s of sessions) {
    if (s.date <= from || s.date > today || s.kind === 'deload') continue
    for (const l of s.setLogs) {
      const done = l.reps !== undefined || l.durationSec !== undefined
      if (done && trains(exercisesById[l.exerciseId], muscles)) sets++
    }
  }
  return sets / weeks
}

/**
 * Strength score of a set for comparing two exercises. Epley without the usual 10-rep cap: the
 * absolute number is not trusted, only the ratio between two similar tests.
 */
function setScore(l: SetLog): number | undefined {
  if (l.loadKg === undefined || l.reps === undefined || l.loadKg <= 0 || l.reps <= 0) return undefined
  return l.loadKg * (1 + l.reps / 30)
}

/** Best set of the most recent session that logged this exercise within the window. */
export function latestStrength(sessions: Session[], exerciseId: string, today: IsoDate, weeks: number): number | undefined {
  const from = addDays(today, -weeks * 7)
  const recent = sessions
    .filter((s) => s.date > from && s.date <= today && s.setLogs.some((l) => l.exerciseId === exerciseId))
    .sort((x, y) => (x.date < y.date ? 1 : -1))
  for (const s of recent) {
    const scores = s.setLogs
      .filter((l) => l.exerciseId === exerciseId)
      .map(setScore)
      .filter((v): v is number => v !== undefined)
    if (scores.length > 0) return Math.max(...scores)
  }
  return undefined
}

function verdictFor(ratio: number, min: number, max: number | undefined): Verdict {
  if (ratio < min) return 'lowA'
  if (max !== undefined && ratio > max) return 'lowB'
  return 'ok'
}

export function evaluateBalance(
  pairs: BalancePair[],
  sessions: Session[],
  exercisesById: Record<string, Exercise>,
  today: IsoDate,
  cfg: BalanceConfig,
): BalanceResult[] {
  const usable = (id: string) => exercisesById[id] !== undefined && exercisesById[id]?.hidden !== true
  return pairs.map((pair) => {
    let measured: BalanceResult['measured']
    if (pair.strength) {
      const a = latestStrength(sessions, pair.strength.testA, today, cfg.strengthWeeks)
      const b = latestStrength(sessions, pair.strength.testB, today, cfg.strengthWeeks)
      if (a !== undefined && b !== undefined && b > 0) {
        const ratio = a / b
        measured = { a, b, ratio, verdict: verdictFor(ratio, pair.strength.min, pair.strength.max) }
      }
    }

    let volume: BalanceResult['volume']
    if (pair.volume) {
      const aPerWeek = weeklySets(sessions, exercisesById, pair.a.muscles, today, cfg.volumeWeeks)
      const bPerWeek = weeklySets(sessions, exercisesById, pair.b.muscles, today, cfg.volumeWeeks)
      if (aPerWeek + bPerWeek < cfg.minSetsPerWeek) {
        volume = { aPerWeek, bPerWeek }
      } else if (bPerWeek === 0) {
        volume = { aPerWeek, bPerWeek, verdict: pair.volume.atLeast ? 'ok' : 'lowB' }
      } else {
        const ratio = aPerWeek / bPerWeek
        const { aim, tolerance, atLeast } = pair.volume
        volume = { aPerWeek, bPerWeek, ratio, verdict: verdictFor(ratio, aim * (1 - tolerance), atLeast ? undefined : aim * (1 + tolerance)) }
      }
    }

    // A measured ratio outranks set counts: it's what the research is about.
    const verdict = measured?.verdict ?? volume?.verdict
    const fixes = verdict === 'lowA' ? pair.a.fixes : verdict === 'lowB' ? pair.b.fixes : []
    return { pair, measured, volume, fixes: fixes.filter(usable) }
  })
}
