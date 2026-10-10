import { activePlan } from '../../domain/milestones'
import type { GoalView } from '../state/derive'
import { formatDate, formatMetric, replanReasonText } from '../format'

interface Props {
  view: GoalView
  today: string
}

export function MilestoneTimeline({ view, today }: Props) {
  const { goal, milestones, currentValue } = view
  const plan = activePlan(goal)
  const nextIndex = milestones.findIndex((m) => m.hitOn === undefined)

  return (
    <section className="card" aria-labelledby={`tl-${goal.id}`}>
      <div className="row spread">
        <h3 id={`tl-${goal.id}`}>Milestones</h3>
        {plan && plan.reason !== 'initial' && <span className="badge">{replanReasonText[plan.reason]}</span>}
      </div>
      <ol className="timeline">
        <li className="done">
          <span className="dot" aria-hidden="true" />
          <div>
            <strong>Start · {formatMetric(goal.metric, goal.baseline)}</strong>
            <p className="small muted">
              {formatDate(goal.startDate)} · baseline {goal.baselineSource === 'test' ? 'from a test' : '(manual, unverified)'}
            </p>
          </div>
        </li>
        {milestones.map((m, i) => {
          const done = m.hitOn !== undefined
          const late = !done && m.milestone.targetDate < today
          return (
            <li key={m.milestone.index} className={done ? 'done' : i === nextIndex ? 'next' : ''}>
              <span className="dot" aria-hidden="true">{done ? '✓' : ''}</span>
              <div>
                <strong>
                  {i === milestones.length - 1 ? '🏁 ' : ''}
                  {formatMetric(goal.metric, m.milestone.targetValue)}
                </strong>
                <p className="small muted">
                  {done
                    ? `Reached ${formatDate(m.hitOn ?? '')}`
                    : `Target ${formatDate(m.milestone.targetDate)}${late ? ' · overdue (will re-plan)' : ''}`}
                  {i === nextIndex && ` · now ${formatMetric(goal.metric, currentValue)}`}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      {goal.plans.length > 1 && (
        <details>
          <summary className="small muted">Plan history ({goal.plans.length} versions)</summary>
          <ul className="small muted">
            {goal.plans.map((p, i) => (
              <li key={i}>
                {formatDate(p.createdOn)}: {replanReasonText[p.reason]} (from {formatMetric(goal.metric, p.fromValue)})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
