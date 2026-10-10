import { useEffect, useState } from 'react'
import type { IsoDate } from '../../domain/models'

/** Local calendar date as ISO. The UI layer is the only place that reads the clock. */
export function localToday(): IsoDate {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's date, refreshed when the app comes back to the foreground. */
export function useToday(): IsoDate {
  const [today, setToday] = useState(localToday)
  useEffect(() => {
    const refresh = () => setToday(localToday())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])
  return today
}
