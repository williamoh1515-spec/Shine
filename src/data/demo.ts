import { progressionConfig } from '../config/progression.config'
import { exercisesById } from '../config/windows.config'
import { addDays } from '../domain/dates'
import { createGoal } from '../domain/goals'
import type { CheckIn, Goal, IsoDate, Session, SetLog } from '../domain/models'
import { db, type ShineDb } from './db'

// FAKE data so the prototype has something to show. Everything here is flagged `demo: true`
// and can be removed in one click. None of it is a real baseline or goal.

const DEMO_WEEKS = 6

// Box squat double progression: (load kg, reps per set), two sessions per week.
const squatLog: [number, number[]][] = [
  [50, [6, 6, 6]], [50, [7, 7, 6]], [50, [8, 8, 7]], [50, [8, 8, 8]],
  [55, [6, 6, 6]], [55, [7, 7, 7]], [55, [8, 8, 8]], [60, [6, 6, 5]],
  [60, [7, 6, 6]], [60, [8, 7, 7]], [60, [8, 8, 8]], [65, [6, 6, 6]],
]

// Rides: (minutes, km). First of each week is easy, second is the long ride.
const rideLog: [number, number][] = [
  [45, 16], [80, 30], [40, 15], [85, 32], [50, 18], [90, 34],
  [30, 11], [70, 27], [50, 19], [100, 37], [55, 20], [105, 39],
]

function squatSession(date: IsoDate, i: number): Session {
  const [loadKg, reps] = squatLog[i] ?? [50, [5]]
  const setLogs: SetLog[] = reps.map((r) => ({ exerciseId: 'box-squat', loadKg, reps: r, rir: 2 }))
  // Leave RIR off some sessions so the "log RIR" hint shows up.
  if (i % 4 === 1) setLogs.forEach((s) => delete s.rir)
  return {
    id: `demo-squat-${i}`,
    date,
    windowId: 'strength',
    kind: 'training',
    setLogs,
    feeling: 3 + (i % 3 === 0 ? 1 : 0),
    demo: true,
  }
}

function rideSession(date: IsoDate, i: number): Session {
  const [minutes, km] = rideLog[i] ?? [45, 15]
  return {
    id: `demo-ride-${i}`,
    date,
    windowId: 'cycling',
    kind: 'training',
    setLogs: [{ exerciseId: 'ride', durationSec: minutes * 60, distanceM: km * 1000 }],
    feeling: 4,
    demo: true,
  }
}

export interface DemoData {
  goals: Goal[]
  sessions: Session[]
  checkIns: CheckIn[]
}

export function buildDemoData(today: IsoDate): DemoData {
  const start = addDays(today, -DEMO_WEEKS * 7)
  const squatGoal = createGoal(
    {
      id: 'demo-goal-squat', windowId: 'strength', exercise: exercisesById['box-squat']!,
      title: 'Box squat 90 kg', baseline: 70, baselineSource: 'manual', target: 90,
      startDate: start, sessionsPerWeek: 2, demo: true,
    },
    progressionConfig,
  )
  const rideGoal = createGoal(
    {
      id: 'demo-goal-ride', windowId: 'cycling', exercise: exercisesById.ride!,
      title: 'Ride 60 km', baseline: 30000, baselineSource: 'manual', target: 60000,
      startDate: start, sessionsPerWeek: 2, demo: true,
    },
    progressionConfig,
  )
  const sessions: Session[] = []
  for (let week = 0; week < DEMO_WEEKS; week++) {
    const monday = addDays(start, week * 7)
    sessions.push(squatSession(monday, week * 2), squatSession(addDays(monday, 3), week * 2 + 1))
    sessions.push(rideSession(addDays(monday, 1), week * 2), rideSession(addDays(monday, 5), week * 2 + 1))
  }
  const checkIns: CheckIn[] = [
    {
      id: 'demo-checkin-1', date: addDays(start, 15), windowId: 'cycling', goalId: rideGoal.id,
      issue: 'tooHard', note: 'Legs heavy after a long work week.', demo: true,
    },
  ]
  return { goals: [squatGoal, rideGoal], sessions, checkIns }
}

export async function loadDemo(today: IsoDate, database: ShineDb = db): Promise<void> {
  const demo = buildDemoData(today)
  await database.transaction('rw', database.goals, database.sessions, database.checkIns, async () => {
    await database.goals.bulkPut(demo.goals)
    await database.sessions.bulkPut(demo.sessions)
    await database.checkIns.bulkPut(demo.checkIns)
  })
}

export async function clearDemo(database: ShineDb = db): Promise<void> {
  await database.transaction('rw', database.goals, database.sessions, database.checkIns, async () => {
    await database.goals.filter((g) => g.demo === true).delete()
    await database.sessions.filter((s) => s.demo === true).delete()
    await database.checkIns.filter((c) => c.demo === true).delete()
  })
}
