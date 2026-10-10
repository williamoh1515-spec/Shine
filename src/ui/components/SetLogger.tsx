import { useState } from 'react'
import type { Exercise, IsoDate, Session, SessionKind, SetLog, Technique } from '../../domain/models'
import { exerciseName, techniqueText } from '../format'
import { emptyRow, toSetLog, type Row } from './setRows'

interface Props {
  windowId: string
  /** Exercises offered in the picker; the first is the default. */
  exerciseIds: string[]
  exercises: Record<string, Exercise>
  today: IsoDate
  /** Pre-fill from this week's program. */
  suggestion?: { loadKg?: number; reps?: number; sets?: number; seconds?: number; technique?: Technique }
  onSave: (session: Omit<Session, 'id'>) => Promise<void>
}

export function SetLogger({ windowId, exerciseIds, exercises, today, suggestion, onSave }: Props) {
  const first = exerciseIds[0] ?? ''
  const initialRows = Array.from({ length: Math.max(1, suggestion?.sets ?? 1) }, () => emptyRow(first, suggestion))
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [date, setDate] = useState(today)
  const [kind, setKind] = useState<SessionKind>('training')
  const [feeling, setFeeling] = useState<number | undefined>()
  const [pain, setPain] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const save = async () => {
    const setLogs = rows.map(toSetLog).filter((l): l is SetLog => l !== undefined)
    if (setLogs.length === 0) {
      setError('Enter at least one set (reps, or time/distance for rides).')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ date, windowId, kind, setLogs, painFlag: pain || undefined, feeling })
      setRows([emptyRow(first, suggestion)])
      setKind('training')
      setFeeling(undefined)
      setPain(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <div className="row wrap">
        <label className="grow">
          Date
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="grow">
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>
            <option value="training">Training</option>
            <option value="test">Test (max effort)</option>
            <option value="deload">Deload</option>
          </select>
        </label>
      </div>

      {rows.map((row, i) => {
        const exercise = exercises[row.exerciseId]
        const model = exercise?.progressionModel
        const loadType = exercise?.loadType ?? (model === 'strength' ? 'plates' : 'bodyweight')
        const isRide = model === 'cycling' || model === 'running'
        const showLoad = loadType !== 'bodyweight' && (model === 'strength' || model === 'timed' || model === 'custom')
        return (
          <fieldset key={i} className="set-row">
            <legend className="small muted">Set {i + 1}</legend>
            {exerciseIds.length > 1 && (
              <select
                aria-label={`Exercise for set ${i + 1}`}
                value={row.exerciseId}
                onChange={(e) => update(i, { exerciseId: e.target.value })}
              >
                {exerciseIds.map((id) => (
                  <option key={id} value={id}>
                    {exerciseName(id, exercises)}
                  </option>
                ))}
              </select>
            )}
            {model === 'timed' ? (
              <div className="row">
                {showLoad && (
                  <label className="grow">
                    kg
                    <input inputMode="decimal" value={row.load} onChange={(e) => update(i, { load: e.target.value })} />
                  </label>
                )}
                <label className="grow">
                  Seconds
                  <input inputMode="numeric" value={row.seconds} onChange={(e) => update(i, { seconds: e.target.value })} />
                </label>
              </div>
            ) : isRide ? (
              <div className="row">
                <label className="grow">
                  Minutes
                  <input inputMode="decimal" value={row.minutes} onChange={(e) => update(i, { minutes: e.target.value })} />
                </label>
                <label className="grow">
                  km
                  <input inputMode="decimal" value={row.km} onChange={(e) => update(i, { km: e.target.value })} />
                </label>
              </div>
            ) : (
              <div className="row">
                {showLoad && (
                  <label className="grow">
                    {loadType === 'addedLoad' ? '+kg' : 'kg'}
                    <input inputMode="decimal" value={row.load} onChange={(e) => update(i, { load: e.target.value })} />
                  </label>
                )}
                <label className="grow">
                  Reps
                  <input inputMode="numeric" value={row.reps} onChange={(e) => update(i, { reps: e.target.value })} />
                </label>
                <label className="grow">
                  RIR
                  <input
                    inputMode="numeric"
                    placeholder="0–5"
                    value={row.rir}
                    onChange={(e) => update(i, { rir: e.target.value })}
                  />
                </label>
              </div>
            )}
            {model === 'strength' && (
              <label>
                Made harder with
                <select
                  value={row.technique}
                  onChange={(e) => update(i, { technique: e.target.value as Row['technique'] })}
                >
                  <option value="">Nothing extra</option>
                  {(Object.keys(techniqueText) as Technique[]).map((t) => (
                    <option key={t} value={t}>
                      {techniqueText[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {rows.length > 1 && (
              <button className="ghost small" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                Remove set
              </button>
            )}
          </fieldset>
        )
      })}

      <button onClick={() => setRows((rs) => [...rs, { ...(rs.at(-1) ?? emptyRow(first)) }])}>+ Add set</button>

      <fieldset className="set-row">
        <legend className="small muted">How did it feel?</legend>
        <div className="row feeling" role="group" aria-label="Feeling from 1 to 5">
          {[1, 2, 3, 4, 5].map((f) => (
            <button key={f} aria-pressed={feeling === f} onClick={() => setFeeling(feeling === f ? undefined : f)}>
              {['😫', '😕', '😐', '🙂', '🤩'][f - 1]}
            </button>
          ))}
        </div>
        <label className="row" style={{ color: 'var(--text)' }}>
          <input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} />
          Something hurt (pauses progression, no XP lost)
        </label>
      </fieldset>

      {error && (
        <p className="notice pain small" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save session'}
      </button>
    </div>
  )
}
