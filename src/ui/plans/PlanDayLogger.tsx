import { useMemo, useState } from 'react'
import { plansById, planTimeConfig } from '../../config/plans.config'
import { progressionConfig } from '../../config/progression.config'
import { addSession, saveGoal } from '../../data/repositories/training'
import type { SetLog } from '../../domain/models'
import { estimateMinutes, prescribeItem } from '../../domain/plans'
import { GoalEditor } from '../components/GoalEditor'
import { emptyRow, toSetLog, type Row } from '../components/setRows'
import type { AppState } from '../state/derive'
import { PlanItemCard } from './PlanItemCard'

interface Props {
  state: AppState
  planId: string
  dayId: string
  today: string
  navigate: (hash: string) => void
}

/** Log a whole plan day: each exercise with today's prescription, then save one session. */
export function PlanDayLogger({ state, planId, dayId, today, navigate }: Props) {
  const plan = plansById[planId]
  const day = plan?.days.find((d) => d.id === dayId)
  const exercises = state.catalog.exercisesById
  const windowView = state.windows.find((w) => w.window.id === plan?.windowId)

  const items = useMemo(() => {
    if (!plan || !day) return []
    return day.items.flatMap((item) => {
      const exercise = exercises[item.exerciseId]
      if (!exercise) return []
      const goalView = windowView?.goals.find((g) => g.goal.exerciseId === item.exerciseId)
      const prescription = prescribeItem({
        item, exercise, goal: goalView?.goal, sessions: state.sessions, checkIns: state.checkIns,
        profile: state.profile, exercises, windowId: plan.windowId, today, config: progressionConfig,
      })
      return [{ item, exercise, goalView, prescription }]
    })
  }, [plan, day, exercises, windowView, state.sessions, state.checkIns, state.profile, today])

  const [rows, setRows] = useState<Record<number, Row[]>>(() =>
    Object.fromEntries(
      items.map(({ item, prescription }, i) => [
        i,
        Array.from({ length: prescription.sets }, () =>
          emptyRow(item.exerciseId, { loadKg: prescription.loadKg, reps: prescription.reps, seconds: prescription.seconds, technique: prescription.technique }),
        ),
      ]),
    ),
  )
  const [done, setDone] = useState<Record<number, boolean>>({})
  const [feeling, setFeeling] = useState<number>()
  const [pain, setPain] = useState(false)
  const [goalFor, setGoalFor] = useState<string>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!plan || !day) return <p>That plan day doesn't exist.</p>

  const finish = async () => {
    const setLogs = items.flatMap((_, i) => (done[i] ? (rows[i] ?? []).map(toSetLog).filter((l): l is SetLog => l !== undefined) : []))
    if (setLogs.length === 0) {
      setError('Mark at least one exercise as done (with its sets filled in).')
      return
    }
    setSaving(true)
    try {
      await addSession(
        { date: today, windowId: plan.windowId, kind: 'training', setLogs, planId: plan.id, planDayId: day.id, feeling, painFlag: pain || undefined },
        today,
      )
      navigate('#/')
    } finally {
      setSaving(false)
    }
  }

  const goalExercise = goalFor ? exercises[goalFor] : undefined
  const doneCount = items.filter((_, i) => done[i]).length

  return (
    <div className="stack">
      <header className="topbar">
        <button className="ghost" aria-label="Back" onClick={() => navigate(`#/plans/${plan.id}`)}>
          ←
        </button>
        <h1 className="grow">{day.title}</h1>
      </header>
      <p className="small muted">
        {plan.name} · ≈ {estimateMinutes(day, exercises, planTimeConfig)} min. Same letter = superset: alternate A1 and A2, rest after
        the pair. Numbers are prefilled from your history or goals; change them to what you actually did, then tap Mark done.
      </p>

      {items.map(({ item, exercise, goalView, prescription }, i) => (
        <PlanItemCard
          key={`${item.exerciseId}-${i}`}
          item={item}
          exercise={exercise}
          names={exercises}
          prescription={prescription}
          goal={goalView}
          rows={rows[i] ?? []}
          done={done[i] === true}
          onRows={(r) => setRows((all) => ({ ...all, [i]: r }))}
          onDone={(d) => setDone((all) => ({ ...all, [i]: d }))}
          onSetGoal={() => setGoalFor(item.exerciseId)}
        />
      ))}

      <section className="card" aria-label="Finish workout">
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
        {error && (
          <p className="notice pain small" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={saving} onClick={() => void finish()}>
          {saving ? 'Saving…' : `Finish workout (${doneCount}/${items.length} done)`}
        </button>
      </section>

      {goalExercise && (
        <GoalEditor
          windowId={plan.windowId}
          exercise={goalExercise}
          today={today}
          bodyMassKg={state.profile.bodyMassKg}
          onSave={saveGoal}
          onClose={() => setGoalFor(undefined)}
        />
      )}
    </div>
  )
}
