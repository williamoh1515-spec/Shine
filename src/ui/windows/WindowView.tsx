import { useState } from 'react'
import { exercisesById, windows } from '../../config/windows.config'
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

/** Generic window screen, driven entirely by windows.config.ts. */
export function WindowView({ state, windowId, exerciseId, today, navigate }: Props) {
  const config = windows.find((w) => w.id === windowId)
  const view = state.windows.find((w) => w.window.id === windowId)
  const initialPart =
    config?.bodyParts.find((b) => exerciseId !== undefined && b.exerciseIds.includes(exerciseId))?.id ??
    config?.bodyParts.find((b) => view?.goals.some((g) => b.exerciseIds.includes(g.goal.exerciseId)))?.id ??
    config?.bodyParts[0]?.id
  const [partId, setPartId] = useState(initialPart)

  if (!config) {
    return <p>Unknown window.</p>
  }
  const part = config.bodyParts.find((b) => b.id === partId) ?? config.bodyParts[0]
  const singleExercise = config.bodyParts.length === 1 && part?.exerciseIds.length === 1
  const selected = exerciseId ?? (singleExercise ? part?.exerciseIds[0] : undefined)

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
              return (
                <li key={id}>
                  <button className="card window-card" onClick={() => navigate(`#/w/${windowId}/${id}`)}>
                    <span className="grow" style={{ textAlign: 'left' }}>
                      <strong>{exercisesById[id]?.name ?? id}</strong>
                      <br />
                      <span className="small muted">{goal ? goal.goal.title : 'No goal yet'}</span>
                    </span>
                    {goal ? <ProgressRing value={goal.progress} size={48} label={`${goal.goal.title} progress`} /> : <span aria-hidden="true">›</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
