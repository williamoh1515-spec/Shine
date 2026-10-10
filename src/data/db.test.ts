import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProfileLinkV1 } from '../domain/profileLink'
import { ShineDb, V1_SCHEMA } from './db'
import { buildDemoData, clearDemo, loadDemo } from './demo'
import { exportAll, importAll, parseBackup } from './repositories/backup'
import { addExerciseToWindow, getCatalog, getProfile, saveExercise } from './repositories/catalog'
import { applyProfileLink, buildLinkFromDevice } from './repositories/profile'
import { addCheckIn, addSession, listGoals, listSessions } from './repositories/training'
import { ensureSeeded as seed } from './seed'
import type { GoalSeed } from '../config/profile.seed'

// Tests use their own fixture so they pass whether or not profile.local.ts exists.
const testSeeds: GoalSeed[] = [
  {
    windowId: 'strength',
    exerciseId: 'pull-up',
    title: '25 unbroken pull-ups',
    baseline: 10,
    baselineSource: 'test',
    target: 25,
    sessionsPerWeek: 2,
  },
]
const ensureSeeded = (today: string, database: ShineDb) => seed(today, database, testSeeds, {})

let database: ShineDb
let n = 0

beforeEach(async () => {
  database = new ShineDb(`test-${++n}`)
  await database.open()
})

afterEach(async () => {
  await database.delete()
})

describe('database', () => {
  it('opens the v2 schema with all tables', () => {
    expect(database.verno).toBe(2)
    expect(database.tables.map((t) => t.name).sort()).toEqual([
      'catalogExercises',
      'catalogWindows',
      'checkIns',
      'goals',
      'meta',
      'sessions',
    ])
  })

  it('upgrades a v1 database to v2 without losing data', async () => {
    const name = `test-upgrade-${++n}`
    const v1 = new Dexie(name)
    v1.version(1).stores(V1_SCHEMA)
    await v1.open()
    await v1.table('sessions').add({
      id: 's1', date: '2026-10-01', windowId: 'strength', kind: 'training',
      setLogs: [{ exerciseId: 'pull-up', reps: 10 }],
    })
    await v1.table('meta').put({ key: 'seeded', value: '2026-10-01' })
    v1.close()

    const upgraded = new ShineDb(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(2)
    expect(await upgraded.sessions.get('s1')).toMatchObject({ setLogs: [{ reps: 10 }] })
    expect(await upgraded.meta.get('seeded')).toBeDefined()
    expect(await upgraded.catalogExercises.count()).toBe(0)
    await upgraded.delete()
  })

  it('seeds the real goals once', async () => {
    await ensureSeeded('2026-10-10', database)
    await ensureSeeded('2026-10-11', database)
    const goals = await listGoals(database)
    expect(goals).toHaveLength(1)
    expect(goals[0]?.title).toBe('25 unbroken pull-ups')
    expect(goals[0]?.demo).toBeUndefined()
  })

  it('seeds nothing when there are no seeds (fresh public install)', async () => {
    await seed('2026-10-10', database, [], {})
    expect(await listGoals(database)).toHaveLength(0)
    expect(await getProfile(database)).toEqual({})
  })

  it('loads and clears demo data without touching real data', async () => {
    await ensureSeeded('2026-10-10', database)
    await loadDemo('2026-10-10', database)
    expect((await listGoals(database)).length).toBe(3)
    await clearDemo(database)
    expect((await listGoals(database)).map((g) => g.title)).toEqual(['25 unbroken pull-ups'])
    expect(await listSessions(database)).toHaveLength(0)
  })

  it('re-plans milestones when a session puts progress far ahead', async () => {
    await ensureSeeded('2026-10-10', database)
    await addSession(
      { date: '2026-10-12', windowId: 'strength', kind: 'test', setLogs: [{ exerciseId: 'pull-up', reps: 16 }] },
      '2026-10-12',
      database,
    )
    const [goal] = await listGoals(database)
    expect(goal?.plans.map((p) => p.reason)).toEqual(['initial', 'ahead'])
  })

  it('re-plans on a missed-sessions check-in', async () => {
    await ensureSeeded('2026-10-10', database)
    await addCheckIn(
      { date: '2026-10-20', windowId: 'strength', issue: 'missedSessions', note: '' },
      '2026-10-20',
      database,
    )
    const [goal] = await listGoals(database)
    expect(goal?.plans.at(-1)?.reason).toBe('missedSessions')
  })

  it('round-trips an export through import', async () => {
    await ensureSeeded('2026-10-10', database)
    await loadDemo('2026-10-10', database)
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll('2026-10-10T12:00:00Z', database))))
    const other = new ShineDb(`test-${++n}`)
    await importAll(backup, other)
    expect(await other.sessions.count()).toBe(buildDemoData('2026-10-10').sessions.length)
    expect(await other.goals.count()).toBe(3)
    await other.delete()
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow()
    expect(() => parseBackup({ format: 'shine-backup', version: 99 })).toThrow()
  })

  it('still imports a v1 backup (no catalog)', async () => {
    const backup = parseBackup({ format: 'shine-backup', version: 1, goals: [], sessions: [], checkIns: [], meta: [] })
    expect(backup.catalogExercises).toEqual([])
    await importAll(backup, database)
    expect(await database.catalogExercises.count()).toBe(0)
  })

  it('backs up and restores custom exercises', async () => {
    await saveExercise({ id: 'custom-swing', name: 'KB swing', progressionModel: 'strength', loadType: 'kettlebell' }, database)
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll('now', database))))
    const other = new ShineDb(`test-${++n}`)
    await importAll(backup, other)
    expect((await getCatalog(other)).exercisesById['custom-swing']?.name).toBe('KB swing')
    await other.delete()
  })
})

describe('catalog', () => {
  it('adds a custom exercise to a built-in window body part', async () => {
    const catalog = await getCatalog(database)
    const strength = catalog.windows.find((w) => w.id === 'strength')!
    await addExerciseToWindow(
      { id: 'custom-kb-swing', name: 'KB swing', progressionModel: 'strength', loadType: 'kettlebell' },
      strength,
      'hinge',
      database,
    )
    const after = await getCatalog(database)
    const hinge = after.windows.find((w) => w.id === 'strength')?.bodyParts.find((b) => b.id === 'hinge')
    expect(hinge?.exerciseIds).toContain('custom-kb-swing')
  })
})

describe('profile links', () => {
  const link: ProfileLinkV1 = {
    v: 1,
    id: 'link-test',
    profile: { name: 'Brother', equipment: { kettlebellsKg: [4, 8, 12, 16], pullUpBar: true, bands: false } },
    windows: [
      { id: 'custom-home', title: 'Home', icon: '🏠', enabled: true, bodyParts: [{ id: 'legs', title: 'Legs', exerciseIds: ['custom-bss'] }] },
    ],
    exercises: [{ id: 'custom-bss', name: 'Bulgarian split squat', progressionModel: 'strength', loadType: 'kettlebell' }],
    goals: [
      {
        windowId: 'custom-home', exerciseId: 'custom-bss', title: 'BSS 12 reps', metric: 'maxReps',
        baseline: 6, baselineSource: 'manual', target: 12, sessionsPerWeek: 2, startLoadKg: 16,
      },
    ],
  }

  it('applies profile, catalog and goals once', async () => {
    expect(await applyProfileLink(link, '2026-10-10', database)).toEqual({ applied: true, goalsAdded: 1 })
    expect(await applyProfileLink(link, '2026-10-11', database)).toEqual({ applied: false, goalsAdded: 0 })
    const goals = await listGoals(database)
    expect(goals).toHaveLength(1)
    expect(goals[0]).toMatchObject({ metric: 'maxReps', startLoadKg: 16, startDate: '2026-10-10' })
    expect((await getProfile(database)).equipment?.kettlebellsKg).toEqual([4, 8, 12, 16])
    expect((await getCatalog(database)).windows.map((w) => w.id)).toContain('custom-home')
  })

  it('never deletes existing data', async () => {
    await ensureSeeded('2026-10-10', database)
    await addSession({ date: '2026-10-10', windowId: 'strength', kind: 'training', setLogs: [{ exerciseId: 'pull-up', reps: 9 }] }, '2026-10-10', database)
    await applyProfileLink(link, '2026-10-10', database)
    expect((await listGoals(database)).map((g) => g.title).sort()).toEqual(['25 unbroken pull-ups', 'BSS 12 reps'])
    expect(await listSessions(database)).toHaveLength(1)
  })

  it('skips goals whose exercise does not exist', async () => {
    const broken = { ...link, id: 'link-broken', exercises: [], windows: [] }
    expect(await applyProfileLink(broken, '2026-10-10', database)).toEqual({ applied: true, goalsAdded: 0 })
  })

  it('builds a link from this device that re-creates the setup elsewhere', async () => {
    await applyProfileLink(link, '2026-10-10', database)
    const rebuilt = await buildLinkFromDevice(undefined, database)
    expect(rebuilt.goals).toHaveLength(1)
    expect(rebuilt.exercises.map((e) => e.id)).toEqual(['custom-bss'])
    const other = new ShineDb(`test-${++n}`)
    await applyProfileLink(rebuilt, '2026-10-12', other)
    expect(await listGoals(other)).toHaveLength(1)
    await other.delete()
  })
})
