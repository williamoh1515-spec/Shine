import Dexie, { type Table } from 'dexie'
import type { CheckIn, Goal, Session } from '../domain/models'

export interface MetaEntry {
  key: string
  value: unknown
}

// Schema changes always go through a new version() with a migration, plus a test.
export class ShineDb extends Dexie {
  declare goals: Table<Goal, string>
  declare sessions: Table<Session, string>
  declare checkIns: Table<CheckIn, string>
  declare meta: Table<MetaEntry, string>

  constructor(name = 'shine') {
    super(name)
    this.version(1).stores({
      goals: 'id, windowId, exerciseId',
      sessions: 'id, date, windowId',
      checkIns: 'id, date, windowId',
      meta: 'key',
    })
  }
}

export const db = new ShineDb()

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
