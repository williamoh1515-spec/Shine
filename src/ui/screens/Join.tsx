import { useEffect, useMemo, useState } from 'react'
import { applyProfileLink, wasLinkApplied } from '../../data/repositories/profile'
import { decodeProfileLink, missingReferences } from '../../domain/profileLink'
import { formatMetric } from '../format'
import type { AppState } from '../state/derive'

interface Props {
  encoded: string
  state: AppState
  today: string
  navigate: (hash: string) => void
}

/** Opening a profile link: show what it contains, write nothing until confirmed. */
export function Join({ encoded, state, today, navigate }: Props) {
  const decoded = useMemo(() => decodeProfileLink(encoded), [encoded])
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (decoded.ok) void wasLinkApplied(decoded.link.id).then(setAlreadyApplied)
  }, [decoded])

  const home = () => {
    // Drop the payload from the address bar and history.
    window.history.replaceState(null, '', window.location.pathname)
    navigate('#/')
  }

  if (!decoded.ok) {
    return (
      <div className="stack" style={{ paddingTop: 24 }}>
        <h1>This link doesn't work</h1>
        <p className="notice pain">{decoded.error}. Ask for a new link, and make sure it was copied completely.</p>
        <button onClick={home}>Open the app</button>
      </div>
    )
  }

  const { link } = decoded
  const builtInExercises = new Set(Object.keys(state.catalog.exercisesById))
  const builtInWindows = new Set(state.catalog.windowsForEditing.map((w) => w.id))
  const missing = missingReferences(link, builtInExercises, builtInWindows)
  const exerciseById = new Map([...Object.values(state.catalog.exercisesById), ...link.exercises].map((e) => [e.id, e]))
  const hasData = state.windows.some((w) => w.goals.length > 0 || w.sessions.length > 0)
  const bells = link.profile.equipment?.kettlebellsKg ?? []

  const start = async () => {
    setBusy(true)
    try {
      await applyProfileLink(link, today)
      home()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ paddingTop: 24 }}>
      <h1>👋 {link.profile.name ? `Hi ${link.profile.name}!` : 'Welcome!'}</h1>
      <p>This link sets up your training app. Your data stays on this device only.</p>

      {alreadyApplied ? (
        <div className="notice">
          This link was already used on this device. Nothing more to do.
          <div style={{ marginTop: 8 }}>
            <button className="primary" onClick={home}>
              Open my app
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="card">
            <h3>What will be set up</h3>
            {bells.length > 0 && <p className="small">🏋️ Kettlebells: {bells.join(', ')} kg{link.profile.equipment?.pullUpBar ? ' · pull-up bar' : ''}</p>}
            {link.exercises.length > 0 && <p className="small">📋 {link.exercises.length} exercises</p>}
            {link.goals.length > 0 && (
              <>
                <strong className="small">🎯 Goals</strong>
                <ul className="small">
                  {link.goals.map((g) => {
                    const metric = g.metric ?? 'maxReps'
                    return (
                      <li key={`${g.exerciseId}-${g.title}`}>
                        {g.title}: {formatMetric(metric, g.baseline)} → {formatMetric(metric, g.target)}
                        {exerciseById.has(g.exerciseId) ? '' : ' (exercise missing, skipped)'}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>
          {missing.length > 0 && (
            <p className="notice small">Some parts refer to things that don't exist ({missing.join(', ')}) and will be skipped.</p>
          )}
          {hasData && <p className="notice small">You already have data here. This only adds to it; nothing is deleted.</p>}
          <button className="primary" disabled={busy} onClick={() => void start()}>
            {busy ? 'Setting up…' : 'Set up my app'}
          </button>
          <button className="ghost" onClick={home}>
            Not now
          </button>
          <p className="small muted">Tip: after setup, tap Share → Add to Home Screen so it opens like an app and works offline.</p>
        </>
      )}
    </div>
  )
}
