import type { HabitCheck, IsoDate } from '../../domain/models'
import { db, type ShineDb } from '../db'

// The only place that reads/writes daily habit ticks.

export const habitCheckId = (habitId: string, date: IsoDate) => `${habitId}:${date}`

export async function listHabitChecks(database: ShineDb = db): Promise<HabitCheck[]> {
  return database.habitChecks.toArray()
}

/** Ticks the habit for a day if it isn't ticked, otherwise removes the tick. Returns the new state. */
export async function toggleHabitCheck(habitId: string, date: IsoDate, database: ShineDb = db): Promise<boolean> {
  const id = habitCheckId(habitId, date)
  return database.transaction('rw', database.habitChecks, async () => {
    if (await database.habitChecks.get(id)) {
      await database.habitChecks.delete(id)
      return false
    }
    await database.habitChecks.put({ id, habitId, date })
    return true
  })
}
