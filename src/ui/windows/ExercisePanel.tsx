import { useState } from 'react'
import {
  addCheckIn,
  addSession,
  deleteGoal,
  deleteSession,
  dismissRaise,
  replaceGoal,
  saveGoal,
} from '../../data/repositories/training'
import type { WeekProgram } from '../../domain/program'
import { CheckInSheet } from '../components/CheckInSheet'
import { GoalChangeEditor } from '../components/GoalChangeEditor'
import { GoalEditor } from '../components/GoalEditor'
import { MilestoneTimeline } from '../components/MilestoneTimeline'
import { ProgramCard } from '../components/ProgramCard'
import { ProgressCharts } from '../components/ProgressCharts'
import { ProgressRing } from '../components/ProgressRing'
import { SetLogger } from '../components/SetLogger'
import { exerciseName, formatDate, formatDuration, formatMetric, formatPerWeek, priorBasisText } from '../format'
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
    const p = item.prescription
    return { loadKg: p.loadKg, reps: p.repRange[0], sets: p.sets, technique: p.technique }
  }
  if (item?.kind === 'reps' && item.prescription.action !== 'test') {
    return { reps: item.prescription.reps, sets: item.prescription.sets }
  }
  if (item?.kind === 'timed') {
    const p = item.prescription
    return { loadKg: p.loadKg, seconds: p.seconds, sets: p.sets }
  }
  return undefined
}

export function ExercisePanel({ state, windowId, exerciseId, today }: Props) {
  const [sheet, setSheet] = useState<'checkIn' | 'goal' | 'next' | 'change' | 'raise'>()
  const { exercisesById } = state.catalog
  const exercise = exercisesById[exerciseId]
  const view = state.windows.find((w) => w.window.id === windowId)
  const goalView = view?.goals.find((g) => g.goal.exerciseId === exerciseId)
  const completed = (view?.completedGoals ?? []).filter((g) => g.goal.exerciseId === exerciseId)
  const pairs = (exercise?.pairWith ?? []).filter((id) => exercisesById[id] !== undefined && !exercisesById[id]?.hidden)
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
              {goalView.pace && (
                <p className="small muted">
                  {goalView.pace.observedPerWeek !== undefined && (
                    <>
                      Your pace:{' '}
                      <strong>{formatPerWeek(goalView.goal.metric, goalView.pace.observedPerWeek, exercise?.progressionModel)}</strong>{' '}
                      ·{' '}
                    </>
                  )}
                  Expected: {formatPerWeek(goalView.goal.metric, goalView.pace.prior.perWeek, exercise?.progressionModel)} (
                  {priorBasisText[goalView.pace.prior.basis]})
                </p>
              )}
            </div>
          </div>
          <div className="row wrap">
            <button className="grow" onClick={() => setSheet('change')}>
              ✏️ Change goal
            </button>
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

      {(pairs.length > 0 || (goalView && exercise?.notes)) && (
        <section className="card" aria-label="Technique and pairs">
          {goalView && exercise?.notes && <p className="small">{exercise.notes}</p>}
          {pairs.length > 0 && (
            <p className="small">
              ⇄ Pairs well with (opposite muscles):{' '}
              {pairs.map((id, i) => (
                <span key={id}>
                  {i > 0 && ' · '}
                  <a href={`#/w/${windowId}/${id}`}>{exerciseName(id, exercisesById)}</a>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {goalView?.suggestion && (
        <section className="card" aria-label="Next goal">
          <h3>🏆 Goal reached!</h3>
          <p>
            You hit <strong>{formatMetric(goalView.goal.metric, goalView.currentValue)}</strong>. Next up:{' '}
            <strong>{formatMetric(goalView.goal.metric, goalView.suggestion.target)}</strong>, about{' '}
            {goalView.suggestion.horizonWeeks} weeks ahead at a natural pace.
          </p>
          <button className="primary" onClick={() => setSheet('next')}>
            🚀 Take on the next goal
          </button>
          <p className="small muted">You can change the number before starting. The reached goal stays in your history.</p>
        </section>
      )}

      {goalView?.raise && (
        <section className="card" aria-label="Faster than expected">
          <h3>🚀 You're progressing faster than expected</h3>
          <p>
            You're gaining <strong>{formatPerWeek(goalView.goal.metric, goalView.raise.observedPerWeek, exercise?.progressionModel)}</strong>,
            about {Math.round(goalView.raise.ratio * 10) / 10}× the expected pace. Raise your goal from{' '}
            {formatMetric(goalView.goal.metric, goalView.goal.target)} to{' '}
            <strong>{formatMetric(goalView.goal.metric, goalView.raise.target)}</strong>, about {Math.round(goalView.raise.weeks)}{' '}
            weeks away at your pace?
          </p>
          <div className="row wrap">
            <button className="primary grow" onClick={() => setSheet('raise')}>
              Raise goal
            </button>
            <button className="ghost" onClick={() => void dismissRaise(goalView.goal, today)}>
              Not now
            </button>
          </div>
        </section>
      )}

      {goalView && <ProgramCard program={goalView.program} metric={goalView.goal.metric} names={exercisesById} />}

      <section className="card" aria-label="Log a session">
        <h3>Log a session</h3>
        <SetLogger
          key={goalView?.program.weekOf ?? 'none'}
          windowId={windowId}
          exerciseIds={loggable}
          exercises={exercisesById}
          today={today}
          suggestion={suggestionFrom(goalView?.program)}
          onSave={async (s) => {
            await addSession(s, today)
          }}
        />
      </section>

      {goalView && <MilestoneTimeline view={goalView} today={today} />}
      {goalView && <ProgressCharts goal={goalView.goal} history={goalView.history} sessions={sessions} />}

      {completed.length > 0 && (
        <section className="card" aria-label="Completed goals">
          <h3>✅ Completed goals</h3>
          <ul className="sessions">
            {completed.map((g) => (
              <li key={g.goal.id} className="small">
                <strong>{g.goal.title}</strong>{' '}
                <span className="muted">
                  {formatMetric(g.goal.metric, g.goal.baseline)} → {formatMetric(g.goal.metric, g.goal.target)}
                  {g.goal.completedOn ? `, done ${formatDate(g.goal.completedOn)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                        .map((l) => {
                          const other = l.exerciseId !== exerciseId ? ` ${exerciseName(l.exerciseId, exercisesById)}` : ''
                          if (l.distanceM !== undefined) return `${(l.distanceM / 1000).toFixed(1)} km`
                          if (l.durationSec !== undefined) {
                            return `${l.loadKg ? `${l.loadKg}kg ` : ''}${formatDuration(l.durationSec)}${other}`
                          }
                          return `${l.loadKg ? `${l.loadKg}kg×` : ''}${l.reps ?? ''}${l.technique ? '*' : ''}${other}`
                        })
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
      {(sheet === 'change' || sheet === 'raise') && exercise && goalView && (
        <GoalChangeEditor
          goal={goalView.goal}
          exercise={exercise}
          currentValue={goalView.currentValue}
          today={today}
          bodyMassKg={state.profile.bodyMassKg}
          suggestedTarget={sheet === 'raise' ? goalView.raise?.target : undefined}
          paceOverride={sheet === 'raise' ? goalView.raise?.perWeek : goalView.pace?.planningPerWeek}
          title={sheet === 'raise' ? 'Raise your goal' : 'Change goal'}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === 'next' && exercise && goalView?.suggestion && (
        <GoalEditor
          windowId={windowId}
          exercise={exercise}
          today={today}
          bodyMassKg={state.profile.bodyMassKg}
          title="Your next goal"
          initial={{
            metric: goalView.goal.metric,
            baseline: goalView.currentValue,
            target: goalView.suggestion.target,
            startLoadKg: goalView.goal.startLoadKg,
            minReps: goalView.goal.minReps,
          }}
          onSave={(next) => replaceGoal(goalView.goal, next, today)}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === 'goal' && exercise && (
        <GoalEditor
          windowId={windowId}
          exercise={exercise}
          today={today}
          bodyMassKg={state.profile.bodyMassKg}
          onSave={saveGoal}
          onClose={() => setSheet(undefined)}
        />
      )}
    </div>
  )
}
