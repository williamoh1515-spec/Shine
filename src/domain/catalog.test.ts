import { describe, expect, it } from 'vitest'
import { customId, mergeCatalog } from './catalog'
import type { Exercise, TrainingWindow } from './models'

const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({ id, name: id, progressionModel: 'strength', ...extra })
const win = (id: string, exerciseIds: string[], extra: Partial<TrainingWindow> = {}): TrainingWindow => ({
  id, title: id, icon: '•', enabled: true, bodyParts: [{ id: 'all', title: 'All', exerciseIds }], ...extra,
})

describe('mergeCatalog', () => {
  const builtIns = { windows: [win('strength', ['squat', 'bench'])], exercises: [ex('squat'), ex('bench')] }

  it('returns built-ins when nothing is stored', () => {
    const c = mergeCatalog(builtIns.windows, builtIns.exercises, [], [])
    expect(c.windows.map((w) => w.id)).toEqual(['strength'])
    expect(Object.keys(c.exercisesById)).toEqual(['squat', 'bench'])
  })

  it('lets stored entries override built-ins by id and appends custom ones', () => {
    const c = mergeCatalog(
      builtIns.windows,
      builtIns.exercises,
      [win('custom-climb', ['custom-hang'])],
      [ex('squat', { name: 'Box squat' }), ex('custom-hang', { progressionModel: 'timed' })],
    )
    expect(c.exercisesById.squat?.name).toBe('Box squat')
    expect(c.exercisesById['custom-hang']?.progressionModel).toBe('timed')
    expect(c.windows.map((w) => w.id)).toEqual(['strength', 'custom-climb'])
  })

  it('hides windows and exercises but keeps them restorable and resolvable', () => {
    const c = mergeCatalog(builtIns.windows, builtIns.exercises, [], [ex('bench', { hidden: true })])
    expect(c.windows[0]?.bodyParts[0]?.exerciseIds).toEqual(['squat'])
    expect(c.hiddenExercises.map((e) => e.id)).toEqual(['bench'])
    // Old sessions can still show its name.
    expect(c.exercisesById.bench?.name).toBe('bench')
    // Editing starts from the unfiltered window, so hiding never loses the exercise's place.
    expect(c.windowsForEditing[0]?.bodyParts[0]?.exerciseIds).toEqual(['squat', 'bench'])

    const hiddenWindow = mergeCatalog(builtIns.windows, builtIns.exercises, [win('strength', [], { hidden: true })], [])
    expect(hiddenWindow.windows).toEqual([])
    expect(hiddenWindow.hiddenWindows.map((w) => w.id)).toEqual(['strength'])
  })
})

describe('customId', () => {
  it('slugifies names, strips accents and avoids collisions', () => {
    expect(customId('Kettlebell Swing', new Set())).toBe('custom-kettlebell-swing')
    expect(customId('Développé couché', new Set())).toBe('custom-developpe-couche')
    expect(customId('Swing', new Set(['custom-swing']))).toBe('custom-swing-2')
    expect(customId('!!!', new Set())).toBe('custom-item')
  })
})
