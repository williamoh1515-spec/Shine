import type { CheckIn, IsoDate, IssueType, Session, WindowId } from './models'

/** How the program reacts to reported problems. Built from check-ins and session pain flags. */
export interface ProgressionModifier {
  /** Pain reported and no pain-free session since: no progression, suggest a regression. */
  paused: boolean
  /** "Too hard": repeat at a lighter load (fraction of the planned load). */
  lighterLoad: boolean
  /** "Too easy": allow the next progression step even without full RIR data. */
  forceProgress: boolean
  /** "Plateau": take a deload or swap the variation. */
  suggestDeload: boolean
  /** "Missed sessions": milestone dates get re-planned (done by the caller when saving). */
  replanDates: boolean
}

export const NO_MODIFIER: ProgressionModifier = {
  paused: false,
  lighterLoad: false,
  forceProgress: false,
  suggestDeload: false,
  replanDates: false,
}

/** Date of the most recent pain report for a window (check-in or session flag). */
export function lastPainDate(
  windowId: WindowId,
  sessions: Session[],
  checkIns: CheckIn[],
): IsoDate | undefined {
  const dates = [
    ...sessions.filter((s) => s.windowId === windowId && s.painFlag).map((s) => s.date),
    ...checkIns.filter((c) => c.windowId === windowId && c.issue === 'pain').map((c) => c.date),
  ]
  return dates.sort().at(-1)
}

/** A check-in stays active until a session is logged on a later day in the same window. */
function isActive(checkIn: CheckIn, windowSessions: Session[]): boolean {
  return !windowSessions.some((s) => s.date > checkIn.date)
}

export function activeModifier(
  windowId: WindowId,
  goalId: string | undefined,
  sessions: Session[],
  checkIns: CheckIn[],
): ProgressionModifier {
  const windowSessions = sessions.filter((s) => s.windowId === windowId)
  const painDate = lastPainDate(windowId, sessions, checkIns)
  const paused =
    painDate !== undefined && !windowSessions.some((s) => s.date > painDate && !s.painFlag)

  const active = new Set<IssueType>(
    checkIns
      .filter((c) => c.windowId === windowId)
      .filter((c) => c.goalId === undefined || goalId === undefined || c.goalId === goalId)
      .filter((c) => isActive(c, windowSessions))
      .map((c) => c.issue),
  )

  return {
    paused,
    lighterLoad: active.has('tooHard'),
    // Pain always wins over "too easy".
    forceProgress: active.has('tooEasy') && !paused,
    suggestDeload: active.has('plateau'),
    replanDates: active.has('missedSessions'),
  }
}
