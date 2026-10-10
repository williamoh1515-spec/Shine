import { useState } from 'react'
import { clearDemo, loadDemo } from '../../data/demo'
import { exportAll, importAll, parseBackup } from '../../data/repositories/backup'
import { saveWindow } from '../../data/repositories/catalog'
import { ProfileCard } from '../components/ProfileCard'
import type { AppState } from '../state/derive'

interface Props {
  today: string
  state: AppState
  navigate: (hash: string) => void
}

export function Settings({ today, state, navigate }: Props) {
  const { hasDemo } = state
  const [message, setMessage] = useState('')

  const download = async () => {
    const backup = await exportAll(new Date().toISOString())
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shine-backup-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
  }

  const upload = async (file: File) => {
    try {
      const backup = parseBackup(JSON.parse(await file.text()) as unknown)
      if (!confirm(`Replace all data with this backup (${backup.sessions.length} sessions)?`)) return
      await importAll(backup)
      setMessage('Backup restored.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <div className="stack">
      <header className="topbar">
        <button className="ghost" aria-label="Back" onClick={() => navigate('#/')}>
          ←
        </button>
        <h1 className="grow">Settings</h1>
      </header>

      <ProfileCard key={JSON.stringify(state.profile)} profile={state.profile} />

      <section className="card">
        <h3>Share a profile</h3>
        <p className="small muted">Create a link that sets up the app for someone else (or for you on another device).</p>
        <button onClick={() => navigate('#/share')}>🔗 Create a profile link</button>
      </section>

      {state.catalog.hiddenWindows.length > 0 && (
        <section className="card">
          <h3>Hidden windows</h3>
          {state.catalog.hiddenWindows.map((w) => (
            <div key={w.id} className="row spread">
              <span>
                {w.icon} {w.title}
              </span>
              <button className="small" onClick={() => void saveWindow({ ...w, hidden: false })}>
                Show again
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h3>Backup</h3>
        <p className="small muted">
          Data lives only on this device. Export a JSON backup now and then, and to move data between phone and laptop.
        </p>
        <div className="row wrap">
          <button onClick={() => void download()}>⬇️ Export JSON</button>
          <label className="button-like">
            ⬆️ Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Demo data</h3>
        <p className="small muted">Six weeks of fake box-squat and cycling data, flagged as demo. Your real data is untouched.</p>
        <div className="row wrap">
          <button disabled={hasDemo} onClick={() => void loadDemo(today).then(() => setMessage('Demo loaded.'))}>
            Load demo
          </button>
          <button disabled={!hasDemo} onClick={() => void clearDemo().then(() => setMessage('Demo cleared.'))}>
            Clear demo
          </button>
        </div>
      </section>

      {message && (
        <p className="notice small" role="status">
          {message}
        </p>
      )}

      <p className="small muted">
        Progression rules are evidence-informed defaults (double progression, RIR, deloads, 80/20 endurance), not
        medical advice. If something hurts, get it checked.
      </p>
    </div>
  )
}
