import Dexie, { type Table } from 'dexie'
import type { CheckIn, Exercise, Goal, HabitCheck, Session, TrainingWindow } from '../domain/models'

export interface MetaEntry {
  key: string
  value: unknown
}

export const V1_SCHEMA = {
  goals: 'id, windowId, exerciseId',
  sessions: 'id, date, windowId',
  checkIns: 'id, date, windowId',
  meta: 'key',
} as const

export const V2_SCHEMA = {
  ...V1_SCHEMA,
  catalogExercises: 'id',
  catalogWindows: 'id',
} as const

// Schema changes always go through a new version() with a migration, plus a test.
export class ShineDb extends Dexie {
  declare goals: Table<Goal, string>
  declare sessions: Table<Session, string>
  declare checkIns: Table<CheckIn, string>
  declare meta: Table<MetaEntry, string>
  declare catalogExercises: Table<Exercise, string>
  declare catalogWindows: Table<TrainingWindow, string>
  declare habitChecks: Table<HabitCheck, string>

  constructor(name = 'shine') {
    super(name)
    this.version(1).stores(V1_SCHEMA)
    // v2: user-editable catalog (custom exercises/windows and overrides of built-ins).
    // Purely additive: existing tables are untouched, so no data transform is needed.
    this.version(2).stores(V2_SCHEMA)
    // v3: daily habit ticks (e.g. morning routine). Purely additive again.
    this.version(3).stores({
      ...V2_SCHEMA,
      habitChecks: 'id, habitId, date',
    })
  }
}

export const db = new ShineDb()

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
