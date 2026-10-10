import { useMemo } from 'react'
import { listCheckIns, listGoals, listSessions } from '../../data/repositories/training'
import type { IsoDate } from '../../domain/models'
import { deriveAppState, type AppState } from '../state/derive'
import { useLiveQuery } from './useLiveQuery'

export function useAppState(today: IsoDate): AppState | undefined {
  const goals = useLiveQuery(() => listGoals())
  const sessions = useLiveQuery(() => listSessions())
  const checkIns = useLiveQuery(() => listCheckIns())
  return useMemo(() => {
    if (goals === undefined || sessions === undefined || checkIns === undefined) return undefined
    return deriveAppState(goals, sessions, checkIns, today)
  }, [goals, sessions, checkIns, today])
}
