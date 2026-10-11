import { toggleHabitCheck } from '../../data/repositories/habits'
import type { WeekDot } from '../../domain/habits'
import type { HabitView } from '../state/derive'

interface Props {
  view: HabitView
  today: string
}

/** First letter of the weekday, e.g. "M", in the user's language. */
function weekdayLetter(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return ''
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' })
}

const dotIcon: Record<WeekDot['status'], string> = {
  done: '✓',
  pass: '↷',
  missed: '✕',
  open: '',
  empty: '',
}

const dotLabel: Record<WeekDot['status'], string> = {
  done: 'done',
  pass: 'free pass used',
  missed: 'missed',
  open: 'not done yet',
  empty: 'not done',
}

/** A daily tick (e.g. morning routine): big button for today, streak, and the last 7 days. */
export function HabitCard({ view, today }: Props) {
  const { habit, streak, week } = view
  const toggle = (date: string) => void toggleHabitCheck(habit.id, date)

  return (
    <section className="card habit" aria-label={habit.name}>
      <div className="row spread">
        <h3>
          <span aria-hidden="true">{habit.icon}</span> {habit.name}
        </h3>
        <span className="small tabular">
          🔥 <strong>{streak.current}</strong> {streak.current === 1 ? 'day' : 'days'} in a row
        </span>
      </div>

      <button
        className={`habit-tick ${streak.doneToday ? 'done' : 'primary'}`}
        aria-pressed={streak.doneToday}
        onClick={() => toggle(today)}
      >
        {streak.doneToday ? '✓ Done today (tap to undo)' : `Tick off ${habit.name.toLowerCase()}`}
      </button>

      <div className="habit-week" role="group" aria-label="Last 7 days">
        {week.map((dot) => (
          <button
            key={dot.date}
            className={`habit-dot ${dot.status}`}
            aria-label={`${dot.date}: ${dotLabel[dot.status]}. Tap to ${dot.status === 'done' ? 'undo' : 'tick'}`}
            onClick={() => toggle(dot.date)}
          >
            <span className="small muted">{weekdayLetter(dot.date)}</span>
            <span className="habit-mark" aria-hidden="true">
              {dotIcon[dot.status]}
            </span>
          </button>
        ))}
      </div>

      <p className="small muted">
        Best: {streak.best} {streak.best === 1 ? 'day' : 'days'} ·{' '}
        {streak.passAvailable ? '1 free pass left this week' : 'free pass used this week'}. Forgot yesterday? Tap its day to tick it.
      </p>
    </section>
  )
}
