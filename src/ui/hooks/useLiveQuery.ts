import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'

/** Subscribes to a Dexie query and re-renders whenever the underlying tables change. */
export function useLiveQuery<T>(query: () => Promise<T>): T | undefined {
  const [value, setValue] = useState<T>()
  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  })
  useEffect(() => {
    // Subscribes once: liveQuery re-runs the latest query on every relevant DB change.
    const subscription = liveQuery(() => queryRef.current()).subscribe({
      next: setValue,
      error: (e: unknown) => console.error('liveQuery failed', e),
    })
    return () => subscription.unsubscribe()
  }, [])
  return value
}
