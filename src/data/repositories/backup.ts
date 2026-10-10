import type { CheckIn, Exercise, Goal, Session, TrainingWindow } from '../../domain/models'
import { db, type MetaEntry, type ShineDb } from '../db'

export const BACKUP_FORMAT = 'shine-backup'
/** v2 adds the user-editable catalog. v1 backups still import (with an empty catalog). */
export const BACKUP_VERSION = 2

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  goals: Goal[]
  sessions: Session[]
  checkIns: CheckIn[]
  meta: MetaEntry[]
  catalogExercises: Exercise[]
  catalogWindows: TrainingWindow[]
}

export async function exportAll(exportedAt: string, database: ShineDb = db): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    goals: await database.goals.toArray(),
    sessions: await database.sessions.toArray(),
    checkIns: await database.checkIns.toArray(),
    meta: await database.meta.toArray(),
    catalogExercises: await database.catalogExercises.toArray(),
    catalogWindows: await database.catalogWindows.toArray(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function arrayOfRecordsWithId(value: unknown): value is { id: string }[] {
  return Array.isArray(value) && value.every((v) => isRecord(v) && typeof v.id === 'string')
}

/** Narrows unknown JSON to a Backup, with shallow structural checks. */
export function parseBackup(json: unknown): Backup {
  if (!isRecord(json) || json.format !== BACKUP_FORMAT) throw new Error('Not a Shine backup file')
  if (typeof json.version !== 'number' || json.version > BACKUP_VERSION) {
    throw new Error('Backup was made by a newer version of the app')
  }
  const { goals, sessions, checkIns, meta, catalogExercises, catalogWindows } = json
  if (!arrayOfRecordsWithId(goals) || !arrayOfRecordsWithId(sessions) || !arrayOfRecordsWithId(checkIns)) {
    throw new Error('Backup is missing goals, sessions or check-ins')
  }
  const metaEntries = Array.isArray(meta)
    ? meta.filter((m): m is MetaEntry => isRecord(m) && typeof m.key === 'string')
    : []
  return {
    format: BACKUP_FORMAT,
    version: json.version,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : '',
    goals: goals as Goal[],
    sessions: sessions as Session[],
    checkIns: checkIns as CheckIn[],
    meta: metaEntries,
    catalogExercises: arrayOfRecordsWithId(catalogExercises) ? (catalogExercises as Exercise[]) : [],
    catalogWindows: arrayOfRecordsWithId(catalogWindows) ? (catalogWindows as TrainingWindow[]) : [],
  }
}

/** Replaces all data with the backup's contents. */
export async function importAll(backup: Backup, database: ShineDb = db): Promise<void> {
  const tables = [
    database.goals,
    database.sessions,
    database.checkIns,
    database.meta,
    database.catalogExercises,
    database.catalogWindows,
  ]
  await database.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await database.goals.bulkPut(backup.goals)
    await database.sessions.bulkPut(backup.sessions)
    await database.checkIns.bulkPut(backup.checkIns)
    await database.meta.bulkPut(backup.meta)
    await database.catalogExercises.bulkPut(backup.catalogExercises)
    await database.catalogWindows.bulkPut(backup.catalogWindows)
  })
}
