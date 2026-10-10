import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Goal, Session } from '../../domain/models'
import { formatDate, formatMetric, metricLabel } from '../format'
import type { ValuePoint } from '../../domain/metrics'

interface Props {
  goal: Goal
  history: ValuePoint[]
  sessions: Session[]
}

const axisProps = {
  stroke: 'var(--axis)',
  tick: { fill: 'var(--muted)', fontSize: 12 },
  tickLine: false,
} as const

const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text-2)' },
} as const

/** Time-based goals chart total time per session; others chart total reps. */
const isTimeBased = (goal: Goal) => goal.metric === 'distanceM' || goal.metric === 'maxDurationSec'

/** Long durations (runs) in minutes, short ones (holds) in seconds. */
const inMinutes = (goal: Goal) => goal.metric === 'distanceM' || goal.target >= 600

/** Per-session volume for the goal's exercise: total reps, or total time. */
function volumePoints(goal: Goal, sessions: Session[]) {
  const timeDivisor = inMinutes(goal) ? 60 : 1
  return sessions
    .filter((s) => s.date >= goal.startDate)
    .map((s) => {
      const logs = s.setLogs.filter((l) => l.exerciseId === goal.exerciseId)
      const value = isTimeBased(goal)
        ? logs.reduce((sum, l) => sum + (l.durationSec ?? 0), 0) / timeDivisor
        : logs.reduce((sum, l) => sum + (l.reps ?? 0), 0)
      return { date: s.date, label: formatDate(s.date), value: Math.round(value) }
    })
    .filter((p) => p.value > 0)
}

function lineScale(goal: Goal): { scale: number; unit: string } {
  switch (goal.metric) {
    case 'distanceM':
      return { scale: 1 / 1000, unit: 'km' }
    case 'maxDurationSec':
      return inMinutes(goal) ? { scale: 1 / 60, unit: 'min' } : { scale: 1, unit: 's' }
    case 'maxReps':
      return { scale: 1, unit: 'reps' }
    case 'oneRepMaxKg':
    case 'workingLoadKg':
      return { scale: 1, unit: 'kg' }
  }
}

export function ProgressCharts({ goal, history, sessions }: Props) {
  const isRide = isTimeBased(goal)
  const { scale, unit } = lineScale(goal)
  const timeUnit = inMinutes(goal) ? 'min' : 's'
  const line = history.map((p) => ({ label: formatDate(p.date), value: Math.round(p.value * scale * 10) / 10 }))
  const volume = volumePoints(goal, sessions)

  if (line.length === 0 && volume.length === 0) {
    return (
      <section className="card">
        <h3>Progress</h3>
        <p className="muted small">Log a session to see your charts.</p>
      </section>
    )
  }

  return (
    <section className="card" aria-label="Progress charts">
      <div>
        <h3>{metricLabel(goal.metric)}</h3>
        <p className="small muted">
          Goal line at {formatMetric(goal.metric, goal.target)}
          {goal.metric === 'oneRepMaxKg' && ' · estimated from sets of ≤10 reps'}
        </p>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={line} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis {...axisProps} domain={['auto', (max: number) => Math.max(max, goal.target * scale)]} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${String(v)} ${unit}`, metricLabel(goal.metric)]} />
            <ReferenceLine
              y={goal.target * scale}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: 'Goal', fill: 'var(--muted)', fontSize: 12, position: 'insideTopRight' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3>{isRide ? 'Time per session' : 'Total reps per session'}</h3>
        <p className="small muted">{isRide ? (timeUnit === 'min' ? 'Minutes' : 'Seconds, all sets') : 'All sets of this exercise'}</p>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer>
          <BarChart data={volume} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: 'var(--surface-2)' }}
              formatter={(v) => [`${String(v)} ${isRide ? timeUnit : 'reps'}`, isRide ? 'Time' : 'Reps']}
            />
            <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary className="small muted">Show as table</summary>
        <table className="small tabular data-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">{metricLabel(goal.metric)}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((p, i) => (
              <tr key={i}>
                <td>{formatDate(p.date)}</td>
                <td>{formatMetric(goal.metric, p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
