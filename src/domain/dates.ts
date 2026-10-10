import type { IsoDate } from './models'

// Pure date helpers on ISO 'YYYY-MM-DD' strings, using UTC to avoid timezone drift.

const DAY_MS = 86_400_000

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined || [y, m, d].some(Number.isNaN)) {
    throw new Error(`Invalid ISO date: ${date}`)
  }
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + Math.round(days) * DAY_MS)
}

export function diffDays(later: IsoDate, earlier: IsoDate): number {
  return Math.round((toUtc(later) - toUtc(earlier)) / DAY_MS)
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  const dayOfWeek = new Date(toUtc(date)).getUTCDay() // 0 = Sunday
  const offset = (dayOfWeek + 6) % 7
  return addDays(date, -offset)
}

export function monthKey(date: IsoDate): string {
  return date.slice(0, 7)
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}
