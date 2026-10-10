import { progressionConfig } from '../../config/progression.config'
import { exercises as builtInExercises, windows as builtInWindows } from '../../config/windows.config'
import { mergeCatalog } from '../../domain/catalog'
import { createGoal } from '../../domain/goals'
import type { IsoDate, Profile } from '../../domain/models'
import { PROFILE_LINK_VERSION, type ProfileLinkV1 } from '../../domain/profileLink'
import { db, newId, type ShineDb } from '../db'
import { getCatalog, getProfile, saveProfile } from './catalog'

const joinedKey = (linkId: string) => `joined:${linkId}`

export async function wasLinkApplied(linkId: string, database: ShineDb = db): Promise<boolean> {
  return (await database.meta.get(joinedKey(linkId))) !== undefined
}

/**
 * Applies a validated profile link: profile fields, catalog entries and goals are ADDED (or
 * overwrite the same ids). Nothing is deleted. Applying the same link twice does nothing.
 */
export async function applyProfileLink(
  link: ProfileLinkV1,
  today: IsoDate,
  database: ShineDb = db,
): Promise<{ applied: boolean; goalsAdded: number }> {
  return database.transaction(
    'rw',
    [database.meta, database.goals, database.catalogExercises, database.catalogWindows],
    async () => {
      if (await wasLinkApplied(link.id, database)) return { applied: false, goalsAdded: 0 }

      const current = await getProfile(database)
      const profile = { ...current, ...link.profile }
      await saveProfile(profile, database)
      if (link.exercises.length > 0) await database.catalogExercises.bulkPut(link.exercises)
      if (link.windows.length > 0) await database.catalogWindows.bulkPut(link.windows)

      const stored = [await database.catalogWindows.toArray(), await database.catalogExercises.toArray()] as const
      const catalog = mergeCatalog(builtInWindows, builtInExercises, stored[0], stored[1])
      const existing = await database.goals.toArray()
      let goalsAdded = 0
      for (const seed of link.goals) {
        const exercise = catalog.exercisesById[seed.exerciseId]
        if (exercise === undefined) continue
        // Same exercise + title already there (e.g. set up by hand): don't duplicate.
        if (existing.some((g) => g.exerciseId === seed.exerciseId && g.title === seed.title)) continue
        await database.goals.put(
          createGoal(
            { ...seed, id: newId('goal'), exercise, startDate: today, bodyMassKg: profile.bodyMassKg },
            progressionConfig,
          ),
        )
        goalsAdded++
      }
      await database.meta.put({ key: joinedKey(link.id), value: today })
      return { applied: true, goalsAdded }
    },
  )
}

/** Builds a link from this device's setup: profile, custom/edited catalog, and current goals. */
export async function buildLinkFromDevice(
  profileOverride: Profile | undefined,
  database: ShineDb = db,
): Promise<ProfileLinkV1> {
  const [profile, windows, exercises, goals, catalog] = await Promise.all([
    getProfile(database),
    database.catalogWindows.toArray(),
    database.catalogExercises.toArray(),
    database.goals.toArray(),
    getCatalog(database),
  ])
  return {
    v: PROFILE_LINK_VERSION,
    id: newId('link').slice(0, 60).toLowerCase(),
    profile: { ...profile, ...profileOverride },
    windows,
    exercises,
    goals: goals
      .filter((g) => !g.demo && catalog.exercisesById[g.exerciseId] !== undefined)
      .map((g) => ({
        windowId: g.windowId,
        exerciseId: g.exerciseId,
        title: g.title,
        metric: g.metric,
        baseline: g.baseline,
        baselineSource: g.baselineSource,
        target: g.target,
        sessionsPerWeek: g.sessionsPerWeek,
        ...(g.minReps !== undefined ? { minReps: g.minReps } : {}),
        ...(g.startLoadKg !== undefined ? { startLoadKg: g.startLoadKg } : {}),
      })),
  }
}
