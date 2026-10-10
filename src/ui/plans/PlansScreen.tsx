import { balancePairs } from '../../config/balance.config'
import { plans, planTimeConfig } from '../../config/plans.config'
import { setActivePlan } from '../../data/repositories/catalog'
import { estimateMinutes, planBalance } from '../../domain/plans'
import { exerciseName } from '../format'
import type { AppState } from '../state/derive'

interface Props {
  state: AppState
  /** Show only this plan (detail view). */
  planId?: string
  today: string
  navigate: (hash: string) => void
}

export function PlansScreen({ state, planId, today, navigate }: Props) {
  const exercises = state.catalog.exercisesById
  const shown = planId ? plans.filter((p) => p.id === planId) : plans
  const activeId = state.activePlan?.plan.id

  return (
    <div className="stack">
      <header className="topbar">
        <button className="ghost" aria-label="Back" onClick={() => navigate(planId ? '#/plans' : '#/')}>
          ←
        </button>
        <h1 className="grow">📋 Plans</h1>
      </header>
      {!planId && (
        <p className="small muted">
          Ready-made weeks of 3 sessions, balanced between opposite muscles. Follow one and the home page shows your next workout.
        </p>
      )}

      {shown.map((plan) => {
        const balance = planBalance(plan, exercises, balancePairs)
        const failing = balance.filter((b) => !b.ok)
        const following = plan.id === activeId
        return (
          <section key={plan.id} className="card" aria-label={plan.name}>
            <div>
              <h2>{plan.name}</h2>
              <p className="small">{plan.summary}</p>
            </div>
            <p className="small muted">{plan.why}</p>
            <p className="small">
              {failing.length === 0
                ? `✓ Balanced on all ${balance.length} opposite-muscle pairs`
                : `⚠ Unbalanced: ${failing.map((f) => f.pairId).join(', ')}`}
            </p>
            <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 8 }}>
              {plan.days.map((day, i) => (
                <li key={day.id}>
                  <button className="list-button" onClick={() => navigate(`#/plans/${plan.id}/${day.id}`)}>
                    <span className="superset-tag" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="grow">
                      <strong>{day.title}</strong> <span className="small muted">≈ {estimateMinutes(day, exercises, planTimeConfig)} min</span>
                      <br />
                      <span className="small muted">{day.items.map((it) => exerciseName(it.exerciseId, exercises)).join(' · ')}</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ol>
            {following ? (
              <div className="row wrap">
                <span className="badge">✓ You're following this plan</span>
                <button className="ghost small" onClick={() => void setActivePlan(null)}>
                  Stop following
                </button>
              </div>
            ) : (
              <button className="primary" onClick={() => void setActivePlan({ planId: plan.id, startedOn: today })}>
                Follow this plan
              </button>
            )}
          </section>
        )
      })}
      {shown.length === 0 && <p>That plan doesn't exist.</p>}
    </div>
  )
}
