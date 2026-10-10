import { useMemo } from 'react'
import { getCatalog, getProfile } from '../../data/repositories/catalog'
import { listCheckIns, listGoals, listSessions } from '../../data/repositories/training'
import type { IsoDate } from '../../domain/models'
import { deriveAppState, type AppState } from '../state/derive'
import { useLiveQuery } from './useLiveQuery'

export function useAppState(today: IsoDate): AppState | undefined {
  const goals = useLiveQuery(() => listGoals())
  const sessions = useLiveQuery(() => listSessions())
  const checkIns = useLiveQuery(() => listCheckIns())
  const catalog = useLiveQuery(() => getCatalog())
  const profile = useLiveQuery(() => getProfile())
  return useMemo(() => {
    if (
      goals === undefined ||
      sessions === undefined ||
      checkIns === undefined ||
      catalog === undefined ||
      profile === undefined
    ) {
      return undefined
    }
    return deriveAppState(goals, sessions, checkIns, today, catalog, profile)
  }, [goals, sessions, checkIns, catalog, profile, today])
}
