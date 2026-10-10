import type { Exercise, Technique } from '../../domain/models'
import type { ItemPrescription, PlanItem } from '../../domain/plans'
import { ProgressRing } from '../components/ProgressRing'
import type { Row } from '../components/setRows'
import { exerciseName, formatKg, strengthActionText, techniqueText } from '../format'
import type { GoalView } from '../state/derive'

interface Props {
  item: PlanItem
  exercise: Exercise
  names: Record<string, Exercise>
  prescription: ItemPrescription
  goal?: GoalView
  rows: Row[]
  done: boolean
  onRows: (rows: Row[]) => void
  onDone: (done: boolean) => void
  onSetGoal: () => void
}

function prescriptionText(p: ItemPrescription, exercise: Exercise): string {
  if (p.seconds !== undefined) return `${p.sets} × ${p.seconds} s${p.loadKg ? ` @ ${formatKg(p.loadKg)}` : ''}`
  const range = p.repRange ? `${p.repRange[0]}–${p.repRange[1]}` : `${p.reps ?? ''}`
  if (exercise.progressionModel !== 'strength' || exercise.loadType === 'bodyweight') return `${p.sets} × ${range} reps`
  if (p.loadKg === undefined) return `${p.sets} × ${range} reps · find a weight that leaves ~2 reps in reserve`
  return `${p.sets} × ${range} reps @ ${exercise.loadType === 'addedLoad' ? '+' : ''}${formatKg(p.loadKg)}`
}

/** One exercise of a plan day: prescription, editable set rows, goal, and how-to. */
export function PlanItemCard({ item, exercise, names, prescription, goal, rows, done, onRows, onDone, onSetGoal }: Props) {
  const model = exercise.progressionModel
  const timed = model === 'timed'
  const showLoad = exercise.loadType !== 'bodyweight' && (model === 'strength' || model === 'timed')
  const update = (i: number, patch: Partial<Row>) => onRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const pairs = (exercise.pairWith ?? []).filter((id) => names[id] && !names[id]?.hidden)

  return (
    <section className={`card plan-item ${done ? 'done' : ''}`} aria-label={exercise.name}>
      <div className="row">
        {item.superset && <span className="superset-tag">{item.superset}</span>}
        <strong className="grow">{exercise.name}</strong>
        {goal && <ProgressRing value={goal.progress} size={36} label={`${goal.goal.title} progress`} />}
      </div>
      <p className="tabular">
        <strong>{prescriptionText(prescription, exercise)}</strong>
      </p>
      {prescription.technique && <p className="small">➕ With {techniqueText[prescription.technique]}</p>}
      {prescription.action && prescription.action !== 'start' && <p className="small muted">{strengthActionText[prescription.action]}</p>}
      {item.note && <p className="small muted">{item.note}</p>}

      <div className="set-grid">
        {rows.map((row, i) => (
          <div key={i} className="row">
            <span className="small muted" style={{ width: 20 }}>
              {i + 1}
            </span>
            {showLoad && (
              <input
                aria-label={`Set ${i + 1} kg`}
                inputMode="decimal"
                placeholder={exercise.loadType === 'addedLoad' ? '+kg' : 'kg'}
                value={row.load}
                onChange={(e) => update(i, { load: e.target.value })}
              />
            )}
            {timed ? (
              <input aria-label={`Set ${i + 1} seconds`} inputMode="numeric" placeholder="s" value={row.seconds} onChange={(e) => update(i, { seconds: e.target.value })} />
            ) : (
              <>
                <input aria-label={`Set ${i + 1} reps`} inputMode="numeric" placeholder="reps" value={row.reps} onChange={(e) => update(i, { reps: e.target.value })} />
                <input aria-label={`Set ${i + 1} RIR`} inputMode="numeric" placeholder="RIR" value={row.rir} onChange={(e) => update(i, { rir: e.target.value })} />
              </>
            )}
          </div>
        ))}
        {model === 'strength' && (
          <label className="small">
            Made harder with
            <select
              value={rows[0]?.technique ?? ''}
              onChange={(e) => onRows(rows.map((r) => ({ ...r, technique: e.target.value as '' | Technique })))}
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
      </div>

      <div className="row wrap">
        <button className={done ? '' : 'primary'} aria-pressed={done} onClick={() => onDone(!done)}>
          {done ? '✓ Done' : 'Mark done'}
        </button>
        {!goal && (
          <button className="ghost small" onClick={onSetGoal}>
            🎯 Set goal
          </button>
        )}
        {goal && <span className="small muted">Goal: {goal.goal.title}</span>}
      </div>

      {(exercise.notes || pairs.length > 0) && (
        <details>
          <summary className="small">How to · opposite muscles</summary>
          {exercise.notes && <p className="small">{exercise.notes}</p>}
          {pairs.length > 0 && <p className="small muted">⇄ Opposite muscles: {pairs.map((id) => exerciseName(id, names)).join(' · ')}</p>}
        </details>
      )}
    </section>
  )
}
