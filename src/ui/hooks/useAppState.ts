import { useMemo } from 'react'
import { getActivePlan, getCatalog, getProfile } from '../../data/repositories/catalog'
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
  // null = no active plan (undefined means still loading).
  const activePlan = useLiveQuery(() => getActivePlan())
  return useMemo(() => {
    if (
      goals === undefined ||
      sessions === undefined ||
      checkIns === undefined ||
      catalog === undefined ||
      profile === undefined ||
      activePlan === undefined
    ) {
      return undefined
    }
    return deriveAppState(goals, sessions, checkIns, today, catalog, profile, activePlan)
  }, [goals, sessions, checkIns, catalog, profile, activePlan, today])
}
