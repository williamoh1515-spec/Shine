import { exercises as builtInExercises, windows as builtInWindows } from '../../config/windows.config'
import { mergeCatalog, type Catalog } from '../../domain/catalog'
import type { Exercise, Profile, TrainingWindow } from '../../domain/models'
import { toProfile } from '../../domain/profileLink'
import { db, type ShineDb } from '../db'

const PROFILE_KEY = 'profile'

export async function listStoredExercises(database: ShineDb = db): Promise<Exercise[]> {
  return database.catalogExercises.toArray()
}

export async function listStoredWindows(database: ShineDb = db): Promise<TrainingWindow[]> {
  return database.catalogWindows.toArray()
}

export async function getCatalog(database: ShineDb = db): Promise<Catalog> {
  const [windows, exercises] = await Promise.all([listStoredWindows(database), listStoredExercises(database)])
  return mergeCatalog(builtInWindows, builtInExercises, windows, exercises)
}

export async function saveExercise(exercise: Exercise, database: ShineDb = db): Promise<void> {
  await database.catalogExercises.put(exercise)
}

export async function saveWindow(window: TrainingWindow, database: ShineDb = db): Promise<void> {
  await database.catalogWindows.put(window)
}

/** Adds an exercise and lists it under a body part of a window, in one transaction. */
export async function addExerciseToWindow(
  exercise: Exercise,
  window: TrainingWindow,
  bodyPartId: string,
  database: ShineDb = db,
): Promise<void> {
  await database.transaction('rw', database.catalogExercises, database.catalogWindows, async () => {
    await database.catalogExercises.put(exercise)
    await database.catalogWindows.put({
      ...window,
      bodyParts: window.bodyParts.map((b) =>
        b.id === bodyPartId && !b.exerciseIds.includes(exercise.id)
          ? { ...b, exerciseIds: [...b.exerciseIds, exercise.id] }
          : b,
      ),
    })
  })
}

export async function getProfile(database: ShineDb = db): Promise<Profile> {
  const entry = await database.meta.get(PROFILE_KEY)
  return toProfile(entry?.value)
}

export async function saveProfile(profile: Profile, database: ShineDb = db): Promise<void> {
  await database.meta.put({ key: PROFILE_KEY, value: profile })
}
