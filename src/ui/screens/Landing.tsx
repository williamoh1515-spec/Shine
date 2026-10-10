import { useState } from 'react'
import { achievements } from '../../config/achievements.config'
import { planTimeConfig } from '../../config/plans.config'
import { clearDemo, loadDemo } from '../../data/demo'
import { estimateMinutes } from '../../domain/plans'
import { ProgressRing } from '../components/ProgressRing'
import { WindowEditor } from '../components/WindowEditor'
import type { AppState } from '../state/derive'

interface Props {
  state: AppState
  today: string
  navigate: (hash: string) => void
}

/** Home: progress header, next workout, and tiles for each area, plans and achievements. */
export function Landing({ state, today, navigate }: Props) {
  const { level, streak, activePlan } = state
  const weekDone = Math.min(streak.thisWeekSessions, streak.target)
  const [creating, setCreating] = useState(false)
  const next = activePlan?.next

  return (
    <div className="stack">
      <header className="topbar">
        <h1 className="grow">✨ Shine</h1>
        <button className="ghost" onClick={() => navigate('#/settings')} aria-label="Settings">
          ⚙️
        </button>
      </header>

      <section className="card hero" aria-label="Your progress">
        <div className="row">
          <ProgressRing value={level.xpIntoLevel / level.xpForNext} size={84} color="var(--xp)" label="Level progress">
            <span style={{ display: 'grid', placeItems: 'center', lineHeight: 1 }}>
              <span className="small muted" style={{ fontSize: 11 }}>
                LVL
              </span>
              {level.level}
            </span>
          </ProgressRing>
          <div className="grow stack" style={{ gap: 6 }}>
            <p>
              <strong className="tabular">{state.xp} XP</strong>{' '}
              <span className="small muted">
                · {level.xpForNext - level.xpIntoLevel} to level {level.level + 1}
              </span>
            </p>
            <p>
              🔥 <strong>{streak.current}-week streak</strong> <span className="small muted">(best {streak.best})</span>
            </p>
            <div>
              <p className="small muted">
                This week: {streak.thisWeekSessions}/{streak.target} sessions
              </p>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${(weekDone / streak.target) * 100}%`, background: 'var(--good)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {activePlan && next ? (
        <button className="card next-workout" onClick={() => navigate(`#/plans/${activePlan.plan.id}/${next.id}`)}>
          <span className="small muted">Next workout · {activePlan.plan.name}</span>
          <strong className="big">{next.title}</strong>
          <span className="small">
            {next.items.length} exercises · ≈ {estimateMinutes(next, state.catalog.exercisesById, planTimeConfig)} min · tap to start →
          </span>
        </button>
      ) : (
        <button className="card next-workout" onClick={() => navigate('#/plans')}>
          <strong>📋 Pick a training plan</strong>
          <span className="small muted">3 balanced sessions a week, ready to log.</span>
        </button>
      )}

      <section aria-label="Areas" className="tiles">
        {state.windows.map((w) => {
          const main = w.goals[0]
          return (
            <button key={w.window.id} className="card tile" onClick={() => navigate(`#/w/${w.window.id}`)}>
              <span className="row spread" style={{ width: '100%' }}>
                <span className="window-icon" aria-hidden="true">
                  {w.window.icon}
                </span>
                {main && <ProgressRing value={main.progress} size={40} label={`${main.goal.title} progress`} />}
              </span>
              <strong>{w.window.title}</strong>
              <span className="small muted">
                Lv {w.level.level} · {w.goals.length} {w.goals.length === 1 ? 'goal' : 'goals'}
              </span>
            </button>
          )
        })}
        <button className="card tile" onClick={() => navigate('#/plans')}>
          <span className="window-icon" aria-hidden="true">
            📋
          </span>
          <strong>Plans</strong>
          <span className="small muted">{activePlan ? 'Following 1 plan' : 'Choose a 3-day plan'}</span>
        </button>
        <button className="card tile" onClick={() => navigate('#/achievements')}>
          <span className="window-icon" aria-hidden="true">
            🏅
          </span>
          <strong>Achievements</strong>
          <span className="small muted">
            {state.unlocked.length}/{achievements.length} unlocked
          </span>
        </button>
      </section>

      <section className="stack" aria-label="More areas" style={{ gap: 8 }}>
        {state.dormantWindows.map((w) => (
          <button key={w.id} className="list-button" onClick={() => navigate(`#/w/${w.id}`)}>
            <span aria-hidden="true">{w.icon}</span>
            <span className="grow">+ Start a {w.title.toLowerCase()} goal</span>
          </button>
        ))}
        <button className="list-button" onClick={() => setCreating(true)}>
          <span aria-hidden="true">➕</span>
          <span className="grow">New window (a sport or training area)</span>
        </button>
      </section>
      {creating && (
        <WindowEditor
          takenIds={new Set(state.catalog.windowsForEditing.map((w) => w.id))}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            navigate(`#/w/${id}`)
          }}
        />
      )}

      {state.hasDemo ? (
        <div className="notice row spread wrap small">
          <span>
            <span className="badge demo">DEMO</span> Fake sample data is loaded so you can explore.
          </span>
          <button onClick={() => void clearDemo()}>Clear demo data</button>
        </div>
      ) : (
        <div className="notice row spread wrap small">
          <span>Want to see how it looks with 6 weeks of training?</span>
          <button onClick={() => void loadDemo(today)}>Load demo data</button>
        </div>
      )}
    </div>
  )
}
