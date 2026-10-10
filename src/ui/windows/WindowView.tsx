import { useState } from 'react'
import { saveExercise, saveWindow } from '../../data/repositories/catalog'
import { customId } from '../../domain/catalog'
import type { Exercise } from '../../domain/models'
import { BalanceCard } from '../components/BalanceCard'
import { ExerciseEditor } from '../components/ExerciseEditor'
import { ProgressRing } from '../components/ProgressRing'
import type { AppState } from '../state/derive'
import { ExercisePanel } from './ExercisePanel'

interface Props {
  state: AppState
  windowId: string
  exerciseId?: string
  today: string
  navigate: (hash: string) => void
}

type EditorState = { exercise?: Exercise; bodyPartId: string } | undefined

/** Generic window screen, driven by the catalog (built-in config + the user's own edits). */
export function WindowView({ state, windowId, exerciseId, today, navigate }: Props) {
  const { windows, exercisesById, hiddenExercises, windowsForEditing } = state.catalog
  const config = windows.find((w) => w.id === windowId)
  // Unfiltered copy: saves must keep hidden exercises listed in their groups.
  const editable = windowsForEditing.find((w) => w.id === windowId)
  const view = state.windows.find((w) => w.window.id === windowId)
  const initialPart =
    config?.bodyParts.find((b) => exerciseId !== undefined && b.exerciseIds.includes(exerciseId))?.id ??
    config?.bodyParts.find((b) => view?.goals.some((g) => b.exerciseIds.includes(g.goal.exerciseId)))?.id ??
    config?.bodyParts[0]?.id
  const [partId, setPartId] = useState(initialPart)
  const [editing, setEditing] = useState(false)
  const [editor, setEditor] = useState<EditorState>()
  const [newPart, setNewPart] = useState('')

  if (!config || !editable) {
    return (
      <div className="stack">
        <p>This window doesn't exist (or is hidden).</p>
        <button onClick={() => navigate('#/')}>Back home</button>
      </div>
    )
  }
  const part = config.bodyParts.find((b) => b.id === partId) ?? config.bodyParts[0]
  const singleExercise = !editing && config.bodyParts.length === 1 && part?.exerciseIds.length === 1
  const selected = exerciseId ?? (singleExercise ? part?.exerciseIds[0] : undefined)
  const takenIds = new Set(Object.keys(exercisesById))
  const hiddenHere = hiddenExercises.filter((e) => editable.bodyParts.some((b) => b.exerciseIds.includes(e.id)))
  // Balance is shown where the exercises know which muscles they train (e.g. Strength).
  const hasMuscleData = config.bodyParts.some((b) => b.exerciseIds.some((id) => (exercisesById[id]?.muscles?.length ?? 0) > 0))

  const addPart = async () => {
    const title = newPart.trim()
    if (!title) return
    const id = customId(title, new Set(editable.bodyParts.map((b) => b.id))).replace(/^custom-/, '')
    await saveWindow({ ...editable, bodyParts: [...editable.bodyParts, { id, title, exerciseIds: [] }] })
    setNewPart('')
    setPartId(id)
  }

  return (
    <div className="stack">
      <header className="topbar">
        <button
          className="ghost"
          aria-label="Back"
          onClick={() => navigate(exerciseId && !singleExercise ? `#/w/${windowId}` : '#/')}
        >
          ←
        </button>
        <h1 className="grow">
          {config.icon} {config.title}
        </h1>
        {view && <span className="badge">Lv {view.level.level}</span>}
        {!exerciseId && (
          <button className="ghost" aria-pressed={editing} onClick={() => setEditing((e) => !e)} aria-label="Edit exercises">
            ✏️
          </button>
        )}
      </header>

      {selected ? (
        <ExercisePanel key={selected} state={state} windowId={windowId} exerciseId={selected} today={today} />
      ) : (
        <>
          {config.bodyParts.length > 1 && (
            <div className="chips" role="tablist" aria-label="Body part">
              {config.bodyParts.map((b) => (
                <button key={b.id} role="tab" aria-selected={b.id === part?.id} aria-pressed={b.id === part?.id} onClick={() => setPartId(b.id)}>
                  {b.title}
                </button>
              ))}
            </div>
          )}
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {part?.exerciseIds.map((id) => {
              const goal = view?.goals.find((g) => g.goal.exerciseId === id)
              const exercise = exercisesById[id]
              return (
                <li key={id} className="row">
                  <button className="card window-card grow" onClick={() => navigate(`#/w/${windowId}/${id}`)}>
                    <span className="grow" style={{ textAlign: 'left' }}>
                      <strong>{exercise?.name ?? id}</strong>
                      <br />
                      <span className="small muted">{goal ? goal.goal.title : 'No goal yet'}</span>
                    </span>
                    {goal ? <ProgressRing value={goal.progress} size={48} label={`${goal.goal.title} progress`} /> : <span aria-hidden="true">›</span>}
                  </button>
                  {editing && exercise && part && (
                    <div className="stack" style={{ gap: 4 }}>
                      <button className="small" onClick={() => setEditor({ exercise, bodyPartId: part.id })}>
                        Edit
                      </button>
                      <button className="small ghost" onClick={() => void saveExercise({ ...exercise, hidden: true })}>
                        Hide
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {part && part.exerciseIds.length === 0 && <p className="muted small">No exercises here yet.</p>}

          {!editing && hasMuscleData && (
            <BalanceCard results={state.balance} exercises={exercisesById} windowId={windowId} />
          )}

          {editing && part && (
            <section className="card" aria-label="Edit this window">
              <button className="primary" onClick={() => setEditor({ bodyPartId: part.id })}>
                + Add exercise to {part.title}
              </button>
              <div className="row">
                <label className="grow">
                  New group
                  <input value={newPart} onChange={(e) => setNewPart(e.target.value)} placeholder="e.g. Shoulder health" />
                </label>
                <button onClick={() => void addPart()} disabled={!newPart.trim()} style={{ alignSelf: 'end' }}>
                  Add
                </button>
              </div>
              {hiddenHere.length > 0 && (
                <div className="stack" style={{ gap: 8 }}>
                  <strong className="small">Hidden exercises</strong>
                  {hiddenHere.map((e) => (
                    <div key={e.id} className="row spread">
                      <span className="small">{e.name}</span>
                      <button className="small" onClick={() => void saveExercise({ ...e, hidden: false })}>
                        Show again
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="ghost danger small"
                onClick={() => {
                  if (confirm(`Hide the ${config.title} window? Your data is kept; restore it in Settings.`)) {
                    void saveWindow({ ...editable, hidden: true }).then(() => navigate('#/'))
                  }
                }}
              >
                Hide this window
              </button>
            </section>
          )}
        </>
      )}

      {editor && (
        <ExerciseEditor
          exercise={editor.exercise}
          window={editable}
          bodyPartId={editor.bodyPartId}
          takenIds={takenIds}
          onClose={() => setEditor(undefined)}
        />
      )}
    </div>
  )
}
