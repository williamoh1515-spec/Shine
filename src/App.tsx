import { useEffect, useState } from 'react'
import { ensureSeeded } from './data/seed'
import { Celebrations } from './ui/components/Celebrations'
import { useAppState } from './ui/hooks/useAppState'
import { useToday } from './ui/hooks/useToday'
import { PlanDayLogger } from './ui/plans/PlanDayLogger'
import { PlansScreen } from './ui/plans/PlansScreen'
import { Achievements } from './ui/screens/Achievements'
import { Join } from './ui/screens/Join'
import { Landing } from './ui/screens/Landing'
import { Settings } from './ui/screens/Settings'
import { ShareProfile } from './ui/screens/ShareProfile'
import { parseRoute, type Route } from './ui/router'
import { WindowView } from './ui/windows/WindowView'

function useHashRoute(): [Route, (hash: string) => void] {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return [parseRoute(hash), (next) => (window.location.hash = next)]
}

export default function App() {
  const today = useToday()
  const [route, navigate] = useHashRoute()
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    void ensureSeeded(today).then(() => setSeeded(true))
  }, [today])
  const state = useAppState(today)

  if (!seeded || state === undefined) {
    return <p className="muted" style={{ padding: 24 }}>Loading…</p>
  }

  return (
    <>
      {route.name === 'landing' && <Landing state={state} today={today} navigate={navigate} />}
      {route.name === 'settings' && <Settings today={today} state={state} navigate={navigate} />}
      {route.name === 'share' && <ShareProfile navigate={navigate} />}
      {route.name === 'achievements' && <Achievements state={state} navigate={navigate} />}
      {route.name === 'plans' && route.dayId === undefined && (
        <PlansScreen state={state} planId={route.planId} today={today} navigate={navigate} />
      )}
      {route.name === 'plans' && route.planId !== undefined && route.dayId !== undefined && (
        <PlanDayLogger
          key={`${route.planId}/${route.dayId}`}
          state={state}
          planId={route.planId}
          dayId={route.dayId}
          today={today}
          navigate={navigate}
        />
      )}
      {route.name === 'join' && <Join encoded={route.payload} state={state} today={today} navigate={navigate} />}
      {route.name === 'window' && (
        <WindowView
          key={route.windowId}
          state={state}
          windowId={route.windowId}
          exerciseId={route.exerciseId}
          today={today}
          navigate={navigate}
        />
      )}
      <Celebrations state={state} />
    </>
  )
}
