import type { Exercise, TrainingWindow } from './models'

// Built-in windows/exercises come from config; the user's own (or overrides of built-ins, by the
// same id) come from the database. Stored entries win. Hidden entries are kept, so they can be
// shown again, but filtered out of the active lists.

export const CUSTOM_PREFIX = 'custom-'

export interface Catalog {
  /** Visible windows, in order: built-ins first, then custom. */
  windows: TrainingWindow[]
  /** Every exercise, including hidden ones (old sessions may reference them). */
  exercisesById: Record<string, Exercise>
  /** Hidden items, so the UI can offer to restore them. */
  hiddenWindows: TrainingWindow[]
  hiddenExercises: Exercise[]
  /**
   * Every window as stored, unfiltered (hidden exercises still listed in their groups).
   * Edits must start from these, or saving would drop hidden exercises for good.
   */
  windowsForEditing: TrainingWindow[]
}

function mergeById<T extends { id: string }>(builtIn: T[], stored: T[]): T[] {
  const byId = new Map(stored.map((s) => [s.id, s]))
  const merged = builtIn.map((b) => byId.get(b.id) ?? b)
  const builtInIds = new Set(builtIn.map((b) => b.id))
  return [...merged, ...stored.filter((s) => !builtInIds.has(s.id))]
}

export function mergeCatalog(
  builtInWindows: TrainingWindow[],
  builtInExercises: Exercise[],
  storedWindows: TrainingWindow[],
  storedExercises: Exercise[],
): Catalog {
  const allWindows = mergeById(builtInWindows, storedWindows)
  const allExercises = mergeById(builtInExercises, storedExercises)
  const hiddenExerciseIds = new Set(allExercises.filter((e) => e.hidden).map((e) => e.id))
  return {
    windows: allWindows
      .filter((w) => !w.hidden)
      .map((w) => ({
        ...w,
        bodyParts: w.bodyParts.map((b) => ({
          ...b,
          exerciseIds: b.exerciseIds.filter((id) => !hiddenExerciseIds.has(id)),
        })),
      })),
    exercisesById: Object.fromEntries(allExercises.map((e) => [e.id, e])),
    hiddenWindows: allWindows.filter((w) => w.hidden),
    hiddenExercises: allExercises.filter((e) => e.hidden),
    windowsForEditing: allWindows,
  }
}

/** A readable, unique id for a user-created item. */
export function customId(name: string, taken: Set<string>): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  let id = `${CUSTOM_PREFIX}${slug}`
  for (let n = 2; taken.has(id); n++) id = `${CUSTOM_PREFIX}${slug}-${n}`
  return id
}
