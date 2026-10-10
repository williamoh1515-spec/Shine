import { useState } from 'react'
import { addExerciseToWindow, saveExercise } from '../../data/repositories/catalog'
import { customId } from '../../domain/catalog'
import type { Exercise, FatigueTag, LoadType, ProgressionModel, TrainingWindow } from '../../domain/models'
import { fatigueTagText, loadTypeText, modelText } from '../format'
import { Sheet } from './Sheet'

interface Props {
  /** Undefined = create a new exercise in `window` under `bodyPartId`. */
  exercise?: Exercise
  window: TrainingWindow
  bodyPartId: string
  takenIds: Set<string>
  onClose: () => void
}

const MODELS: ProgressionModel[] = ['strength', 'repsEndurance', 'timed', 'running', 'cycling', 'custom']
const LOAD_TYPES = Object.keys(loadTypeText) as LoadType[]
const TAGS = Object.keys(fatigueTagText) as FatigueTag[]

const optionalNumber = (s: string): number | undefined => {
  if (s.trim() === '') return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function ExerciseEditor({ exercise, window, bodyPartId, takenIds, onClose }: Props) {
  const [name, setName] = useState(exercise?.name ?? '')
  const [model, setModel] = useState<ProgressionModel>(exercise?.progressionModel ?? 'strength')
  const [loadType, setLoadType] = useState<LoadType>(exercise?.loadType ?? 'kettlebell')
  const [region, setRegion] = useState<'upper' | 'lower'>(exercise?.region ?? 'upper')
  const [repLow, setRepLow] = useState(String(exercise?.overrides?.repRange?.[0] ?? ''))
  const [repHigh, setRepHigh] = useState(String(exercise?.overrides?.repRange?.[1] ?? ''))
  const [sets, setSets] = useState(String(exercise?.overrides?.workingSets ?? ''))
  const [increment, setIncrement] = useState(String(exercise?.overrides?.loadIncrementKg ?? ''))
  const [maxHold, setMaxHold] = useState(String(exercise?.overrides?.maxHoldSec ?? ''))
  const [regression, setRegression] = useState(exercise?.regression ?? '')
  const [notes, setNotes] = useState(exercise?.notes ?? '')
  const [tags, setTags] = useState<FatigueTag[]>(exercise?.fatigueTags ?? [])
  const [error, setError] = useState('')

  const usesLoad = model === 'strength' || model === 'timed' || model === 'custom'

  const save = async () => {
    if (name.trim() === '') {
      setError('Give the exercise a name.')
      return
    }
    const lo = optionalNumber(repLow)
    const hi = optionalNumber(repHigh)
    if ((lo === undefined) !== (hi === undefined) || (lo !== undefined && hi !== undefined && lo > hi)) {
      setError('Rep range needs both numbers, low ≤ high.')
      return
    }
    const overrides: NonNullable<Exercise['overrides']> = {}
    if (lo !== undefined && hi !== undefined) overrides.repRange = [Math.round(lo), Math.round(hi)]
    const ws = optionalNumber(sets)
    if (ws !== undefined) overrides.workingSets = Math.round(ws)
    const inc = optionalNumber(increment)
    if (inc !== undefined) overrides.loadIncrementKg = inc
    const hold = optionalNumber(maxHold)
    if (hold !== undefined) overrides.maxHoldSec = Math.round(hold)

    const next: Exercise = {
      ...(exercise ?? {}),
      id: exercise?.id ?? customId(name, takenIds),
      name: name.trim(),
      progressionModel: model,
      ...(model === 'strength' ? { region } : {}),
      ...(usesLoad ? { loadType } : { loadType: 'bodyweight' as const }),
      fatigueTags: tags,
      overrides,
      ...(regression.trim() ? { regression: regression.trim() } : { regression: undefined }),
      ...(notes.trim() ? { notes: notes.trim() } : { notes: undefined }),
    }
    if (exercise) await saveExercise(next)
    else await addExerciseToWindow(next, window, bodyPartId)
    onClose()
  }

  return (
    <Sheet title={exercise ? `Edit: ${exercise.name}` : 'New exercise'} onClose={onClose}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kettlebell swing" />
      </label>
      <label>
        How it progresses
        <select value={model} onChange={(e) => setModel(e.target.value as ProgressionModel)}>
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {modelText[m]}
            </option>
          ))}
        </select>
      </label>
      {usesLoad && (
        <div className="row wrap">
          <label className="grow">
            Equipment
            <select value={loadType} onChange={(e) => setLoadType(e.target.value as LoadType)}>
              {LOAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {loadTypeText[t]}
                </option>
              ))}
            </select>
          </label>
          {model === 'strength' && (
            <label className="grow">
              Body
              <select value={region} onChange={(e) => setRegion(e.target.value as 'upper' | 'lower')}>
                <option value="upper">Upper body</option>
                <option value="lower">Lower body</option>
              </select>
            </label>
          )}
        </div>
      )}
      {model === 'strength' && (
        <div className="row">
          <label className="grow">
            Reps from
            <input inputMode="numeric" value={repLow} onChange={(e) => setRepLow(e.target.value)} placeholder="5" />
          </label>
          <label className="grow">
            to
            <input inputMode="numeric" value={repHigh} onChange={(e) => setRepHigh(e.target.value)} placeholder="8" />
          </label>
          <label className="grow">
            Sets
            <input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" />
          </label>
        </div>
      )}
      {model === 'strength' && loadType === 'plates' && (
        <label>
          Load jump (kg)
          <input inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} placeholder="2.5" />
        </label>
      )}
      {model === 'timed' && (
        <div className="row">
          <label className="grow">
            Target hold (s)
            <input inputMode="numeric" value={maxHold} onChange={(e) => setMaxHold(e.target.value)} placeholder="60" />
          </label>
          <label className="grow">
            Sets
            <input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" />
          </label>
        </div>
      )}
      <fieldset className="set-row">
        <legend className="small muted">Mainly works (used for recovery rules)</legend>
        <div className="row wrap">
          {TAGS.map((t) => (
            <button
              key={t}
              aria-pressed={tags.includes(t)}
              onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
            >
              {fatigueTagText[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Easier version (used on pain or plateau)
        <input value={regression} onChange={(e) => setRegression(e.target.value)} />
      </label>
      <label>
        Notes / technique cues
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && (
        <p className="notice pain small" role="alert">
          {error}
        </p>
      )}
      <button className="primary" onClick={() => void save()}>
        {exercise ? 'Save changes' : 'Add exercise'}
      </button>
    </Sheet>
  )
}
