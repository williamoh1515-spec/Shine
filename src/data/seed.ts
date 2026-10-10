import { progressionConfig } from '../config/progression.config'
import { goalSeeds as defaultSeeds, profile as defaultProfile, type GoalSeed } from '../config/profile.seed'
import { exercisesById } from '../config/windows.config'
import { createGoal } from '../domain/goals'
import type { IsoDate, Profile } from '../domain/models'
import { db, newId, type ShineDb } from './db'

const SEEDED_KEY = 'seeded'
const PROFILE_KEY = 'profile'

/**
 * On first launch, creates goals (and the profile) from profile.local.ts. Without that file
 * (the public build) nothing is created. Runs once per device.
 */
export async function ensureSeeded(
  today: IsoDate,
  database: ShineDb = db,
  seeds: GoalSeed[] = defaultSeeds,
  profile: Profile = defaultProfile,
): Promise<void> {
  await database.transaction('rw', database.meta, database.goals, async () => {
    if (await database.meta.get(SEEDED_KEY)) return
    for (const seed of seeds) {
      const exercise = exercisesById[seed.exerciseId]
      if (exercise === undefined) continue
      await database.goals.put(
        createGoal(
          { ...seed, id: newId('goal'), exercise, startDate: today, bodyMassKg: profile.bodyMassKg },
          progressionConfig,
        ),
      )
    }
    if (Object.keys(profile).length > 0 && !(await database.meta.get(PROFILE_KEY))) {
      await database.meta.put({ key: PROFILE_KEY, value: profile })
    }
    await database.meta.put({ key: SEEDED_KEY, value: today })
  })
}
