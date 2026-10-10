import type { SetLog, Technique } from '../../domain/models'

// Text-field rows for logging sets, shared by the single-exercise logger and the plan logger.
// Inputs are kept as strings while typing; toSetLog turns a row into a stored SetLog.

export interface Row {
  exerciseId: string
  load: string
  reps: string
  rir: string
  seconds: string
  minutes: string
  km: string
  technique: '' | Technique
}

export interface RowPrefill {
  loadKg?: number
  reps?: number
  seconds?: number
  technique?: Technique
}

export const emptyRow = (exerciseId: string, s?: RowPrefill): Row => ({
  exerciseId,
  load: s?.loadKg !== undefined && s.loadKg > 0 ? String(s.loadKg) : '',
  reps: s?.reps !== undefined ? String(s.reps) : '',
  rir: '',
  seconds: s?.seconds !== undefined ? String(s.seconds) : '',
  minutes: '',
  km: '',
  technique: s?.technique ?? '',
})

export function parse(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** A filled row as a SetLog; undefined when the row has no reps, time or distance. */
export function toSetLog(row: Row): SetLog | undefined {
  const log: SetLog = { exerciseId: row.exerciseId }
  const reps = parse(row.reps)
  const load = parse(row.load)
  const rir = parse(row.rir)
  const seconds = parse(row.seconds)
  const minutes = parse(row.minutes)
  const km = parse(row.km)
  if (reps !== undefined) log.reps = Math.round(reps)
  if (load !== undefined) log.loadKg = load
  if (rir !== undefined) log.rir = Math.round(rir)
  if (seconds !== undefined) log.durationSec = Math.round(seconds)
  if (minutes !== undefined) log.durationSec = Math.round(minutes * 60)
  if (km !== undefined) log.distanceM = Math.round(km * 1000)
  if (row.technique !== '') log.technique = row.technique
  const hasData = log.reps !== undefined || log.durationSec !== undefined || log.distanceM !== undefined
  return hasData ? log : undefined
}
