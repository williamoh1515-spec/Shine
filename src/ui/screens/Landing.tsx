import { clearDemo, loadDemo } from '../../data/demo'
import { weekStart } from '../../domain/dates'
import { AchievementGrid } from '../components/AchievementGrid'
import { ProgressRing } from '../components/ProgressRing'
import { formatMetric } from '../format'
import type { AppState } from '../state/derive'

interface Props {
  state: AppState
  today: string
  navigate: (hash: string) => void
}

export function Landing({ state, today, navigate }: Props) {
  const { level, streak } = state
  const weekDone = Math.min(streak.thisWeekSessions, streak.target)
  const monday = weekStart(today)

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

      <section className="stack" aria-label="Training windows">
        <h2>Your windows</h2>
        {state.windows.map((w) => {
          const main = w.goals[0]
          const thisWeek = w.sessions.filter((s) => s.date >= monday).length
          return (
            <button key={w.window.id} className="card window-card" onClick={() => navigate(`#/w/${w.window.id}`)}>
              <span className="window-icon" aria-hidden="true">
                {w.window.icon}
              </span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <strong>{w.window.title}</strong> <span className="badge">Lv {w.level.level}</span>
                <br />
                <span className="small muted">
                  {main
                    ? `${main.goal.title} · now ${formatMetric(main.goal.metric, main.currentValue)}`
                    : 'No goal yet. Tap to set one'}
                </span>
                <br />
                <span className="small muted">
                  {thisWeek}/{w.plannedPerWeek} sessions this week
                  {w.goals.length > 1 ? ` · ${w.goals.length} goals` : ''}
                </span>
              </span>
              {main && <ProgressRing value={main.progress} size={56} label={`${main.goal.title} progress`} />}
            </button>
          )
        })}
        {state.dormantWindows.map((w) => (
          <button key={w.id} className="list-button" onClick={() => navigate(`#/w/${w.id}`)}>
            <span aria-hidden="true">{w.icon}</span>
            <span className="grow">+ Start a {w.title.toLowerCase()} goal</span>
          </button>
        ))}
      </section>

      <AchievementGrid unlocked={state.unlocked} />
    </div>
  )
}
