import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ShineDb } from './db'
import { buildDemoData, clearDemo, loadDemo } from './demo'
import { exportAll, importAll, parseBackup } from './repositories/backup'
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
const ensureSeeded = (today: string, database: ShineDb) => seed(today, database, testSeeds)

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
  it('opens the v1 schema with all tables', () => {
    expect(database.verno).toBe(1)
    expect(database.tables.map((t) => t.name).sort()).toEqual(['checkIns', 'goals', 'meta', 'sessions'])
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
    await seed('2026-10-10', database, [])
    expect(await listGoals(database)).toHaveLength(0)
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
})
