import { progressionConfig } from '../../config/progression.config'
import { maybeReplan } from '../../domain/goals'
import type { CheckIn, Goal, IsoDate, Session, WindowId } from '../../domain/models'
import { db, newId, type ShineDb } from '../db'
import { getCatalog } from './catalog'

// The only place that reads/writes goals, sessions and check-ins.

export async function listGoals(database: ShineDb = db): Promise<Goal[]> {
  return database.goals.toArray()
}

export async function listSessions(database: ShineDb = db): Promise<Session[]> {
  return database.sessions.orderBy('date').toArray()
}

export async function listCheckIns(database: ShineDb = db): Promise<CheckIn[]> {
  return database.checkIns.orderBy('date').toArray()
}

export async function saveGoal(goal: Goal, database: ShineDb = db): Promise<void> {
  await database.goals.put(goal)
}

export async function deleteGoal(goalId: string, database: ShineDb = db): Promise<void> {
  await database.goals.delete(goalId)
}

/** Re-plans the window's goals when progress diverged (or always, when forced). */
async function replanWindow(
  windowId: WindowId,
  today: IsoDate,
  force: 'missedSessions' | undefined,
  database: ShineDb,
): Promise<void> {
  const goals = await database.goals.where('windowId').equals(windowId).toArray()
  const sessions = await database.sessions.where('windowId').equals(windowId).toArray()
  const { exercisesById } = await getCatalog(database)
  for (const goal of goals) {
    const exercise = exercisesById[goal.exerciseId]
    if (exercise === undefined) continue
    const updated = maybeReplan(goal, exercise, sessions, today, progressionConfig, force)
    if (updated !== undefined) await database.goals.put(updated)
  }
}

export async function addSession(
  input: Omit<Session, 'id'>,
  today: IsoDate,
  database: ShineDb = db,
): Promise<Session> {
  const session: Session = { ...input, id: newId('session') }
  const tables = [database.sessions, database.goals, database.catalogExercises, database.catalogWindows]
  await database.transaction('rw', tables, async () => {
    await database.sessions.add(session)
    await replanWindow(session.windowId, today, undefined, database)
  })
  return session
}

export async function deleteSession(sessionId: string, database: ShineDb = db): Promise<void> {
  await database.sessions.delete(sessionId)
}

export async function addCheckIn(
  input: Omit<CheckIn, 'id'>,
  today: IsoDate,
  database: ShineDb = db,
): Promise<CheckIn> {
  const checkIn: CheckIn = { ...input, id: newId('checkin') }
  const tables = [
    database.checkIns,
    database.goals,
    database.sessions,
    database.catalogExercises,
    database.catalogWindows,
  ]
  await database.transaction('rw', tables, async () => {
    await database.checkIns.add(checkIn)
    if (checkIn.issue === 'missedSessions') {
      await replanWindow(checkIn.windowId, today, 'missedSessions', database)
    }
  })
  return checkIn
}
