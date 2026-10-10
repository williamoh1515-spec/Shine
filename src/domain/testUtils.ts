import type { CheckIn, IssueType, Session, SessionKind, SetLog } from './models'

let counter = 0

export function session(
  date: string,
  setLogs: SetLog[],
  extra: Partial<Session> & { kind?: SessionKind } = {},
): Session {
  counter++
  return { id: `s${counter}`, date, windowId: 'strength', kind: 'training', setLogs, ...extra }
}

export function sets(exerciseId: string, loadKg: number, reps: number[], rir?: number): SetLog[] {
  return reps.map((r) => ({ exerciseId, loadKg, reps: r, rir }))
}

export function checkIn(date: string, issue: IssueType, windowId = 'strength'): CheckIn {
  counter++
  return { id: `c${counter}`, date, windowId, issue, note: '' }
}
