import { progressionConfig } from '../config/progression.config'
import { goalSeeds as defaultSeeds, type GoalSeed } from '../config/profile.seed'
import { exercisesById } from '../config/windows.config'
import { createGoal } from '../domain/goals'
import type { IsoDate } from '../domain/models'
import { db, newId, type ShineDb } from './db'

const SEEDED_KEY = 'seeded'

/** On first launch, creates goals from profile.local.ts (none if absent). Runs once per device. */
export async function ensureSeeded(
  today: IsoDate,
  database: ShineDb = db,
  seeds: GoalSeed[] = defaultSeeds,
): Promise<void> {
  await database.transaction('rw', database.meta, database.goals, async () => {
    if (await database.meta.get(SEEDED_KEY)) return
    for (const seed of seeds) {
      const exercise = exercisesById[seed.exerciseId]
      if (exercise === undefined) continue
      await database.goals.put(
        createGoal({ ...seed, id: newId('goal'), exercise, startDate: today }, progressionConfig),
      )
    }
    await database.meta.put({ key: SEEDED_KEY, value: today })
  })
}
