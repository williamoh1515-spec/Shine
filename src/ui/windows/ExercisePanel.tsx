import { useState } from 'react'
import { exercisesById } from '../../config/windows.config'
import { addCheckIn, addSession, deleteGoal, deleteSession, saveGoal } from '../../data/repositories/training'
import type { WeekProgram } from '../../domain/program'
import { CheckInSheet } from '../components/CheckInSheet'
import { GoalEditor } from '../components/GoalEditor'
import { MilestoneTimeline } from '../components/MilestoneTimeline'
import { ProgramCard } from '../components/ProgramCard'
import { ProgressCharts } from '../components/ProgressCharts'
import { ProgressRing } from '../components/ProgressRing'
import { SetLogger } from '../components/SetLogger'
import { exerciseName, formatDate, formatMetric } from '../format'
import type { AppState } from '../state/derive'

interface Props {
  state: AppState
  windowId: string
  exerciseId: string
  today: string
}

function suggestionFrom(program: WeekProgram | undefined) {
  const item = program?.item
  if (item?.kind === 'strength') {
    return { loadKg: item.prescription.loadKg, reps: item.prescription.repRange[0], sets: item.prescription.sets }
  }
  if (item?.kind === 'reps' && item.prescription.action !== 'test') {
    return { reps: item.prescription.reps, sets: item.prescription.sets }
  }
  return undefined
}

export function ExercisePanel({ state, windowId, exerciseId, today }: Props) {
  const [sheet, setSheet] = useState<'checkIn' | 'goal'>()
  const exercise = exercisesById[exerciseId]
  const view = state.windows.find((w) => w.window.id === windowId)
  const goalView = view?.goals.find((g) => g.goal.exerciseId === exerciseId)
  const sessions = (view?.sessions ?? []).filter((s) => s.setLogs.some((l) => l.exerciseId === exerciseId))
  const loggable = [exerciseId, exercise?.weightedVariantId, ...(exercise?.accessories ?? [])].filter(
    (id): id is string => id !== undefined,
  )

  return (
    <div className="stack">
      {goalView ? (
        <section className="card" aria-label="Goal">
          <div className="row">
            <ProgressRing value={goalView.progress} size={72} label="Goal progress" />
            <div className="grow">
              <h2>
                {goalView.goal.title} {goalView.goal.demo && <span className="badge demo">DEMO</span>}
              </h2>
              <p className="small muted">{exercise?.name}</p>
              <p className="tabular">
                {formatMetric(goalView.goal.metric, goalView.currentValue)} →{' '}
                <strong>{formatMetric(goalView.goal.metric, goalView.goal.target)}</strong>
              </p>
            </div>
          </div>
          <div className="row wrap">
            <button className="grow" onClick={() => setSheet('checkIn')}>
              💬 Something wrong?
            </button>
            <button
              className="ghost danger small"
              onClick={() => {
                if (confirm('Delete this goal? Logged sessions are kept.')) void deleteGoal(goalView.goal.id)
              }}
            >
              Delete goal
            </button>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>{exercise?.name ?? exerciseId}</h2>
          {exercise?.notes && <p className="small">{exercise.notes}</p>}
          <p className="muted">
            No goal yet. Set one and you'll get milestones and a weekly program to reach it.
          </p>
          <button className="primary" onClick={() => setSheet('goal')}>
            🎯 Set a goal
          </button>
        </section>
      )}

      {goalView && <ProgramCard program={goalView.program} metric={goalView.goal.metric} />}

      <section className="card" aria-label="Log a session">
        <h3>Log a session</h3>
        <SetLogger
          key={goalView?.program.weekOf ?? 'none'}
          windowId={windowId}
          exerciseIds={loggable}
          today={today}
          suggestion={suggestionFrom(goalView?.program)}
          onSave={async (s) => {
            await addSession(s, today)
          }}
        />
      </section>

      {goalView && <MilestoneTimeline view={goalView} today={today} />}
      {goalView && <ProgressCharts goal={goalView.goal} history={goalView.history} sessions={sessions} />}

      {sessions.length > 0 && (
        <section className="card" aria-label="Recent sessions">
          <h3>Recent sessions</h3>
          <ul className="sessions">
            {[...sessions]
              .reverse()
              .slice(0, 6)
              .map((s) => (
                <li key={s.id} className="row spread">
                  <span className="small">
                    <strong>{formatDate(s.date)}</strong> {s.kind !== 'training' && <span className="badge">{s.kind}</span>}{' '}
                    {s.painFlag && <span className="badge warn">pain</span>} {s.demo && <span className="badge demo">demo</span>}
                    <br />
                    <span className="muted">
                      {s.setLogs
                        .map((l) =>
                          l.distanceM !== undefined
                            ? `${(l.distanceM / 1000).toFixed(1)} km`
                            : `${l.loadKg ? `${l.loadKg}kg×` : ''}${l.reps ?? ''}${l.exerciseId !== exerciseId ? ` ${exerciseName(l.exerciseId)}` : ''}`,
                        )
                        .join(' · ')}
                    </span>
                  </span>
                  <button
                    className="ghost small"
                    aria-label={`Delete session on ${s.date}`}
                    onClick={() => confirm('Delete this session?') && void deleteSession(s.id)}
                  >
                    🗑
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {sheet === 'checkIn' && (
        <CheckInSheet
          windowId={windowId}
          goalId={goalView?.goal.id}
          today={today}
          onSubmit={async (c) => {
            await addCheckIn(c, today)
          }}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === 'goal' && (
        <GoalEditor
          windowId={windowId}
          exerciseId={exerciseId}
          today={today}
          onSave={saveGoal}
          onClose={() => setSheet(undefined)}
        />
      )}
    </div>
  )
}
