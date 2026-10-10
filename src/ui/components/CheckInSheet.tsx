import { useState } from 'react'
import type { CheckIn, IssueType } from '../../domain/models'
import { issueLabels } from '../format'
import { Sheet } from './Sheet'

interface Props {
  windowId: string
  goalId?: string
  today: string
  onSubmit: (checkIn: Omit<CheckIn, 'id'>) => Promise<void>
  onClose: () => void
}

const issues = Object.keys(issueLabels) as IssueType[]

export function CheckInSheet({ windowId, goalId, today, onSubmit, onClose }: Props) {
  const [issue, setIssue] = useState<IssueType>()
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)

  if (done && issue) {
    return (
      <Sheet title="Got it 👍" onClose={onClose}>
        <p>{issueLabels[issue].effect}</p>
        {issue === 'pain' && (
          <p className="notice pain small">
            If pain is sharp, persists, or gets worse, stop and see a physio or doctor. The app only adjusts training.
          </p>
        )}
        <button className="primary" onClick={onClose}>
          Back to my program
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet title="Something wrong?" onClose={onClose}>
      <p className="small muted">Tell me what's going on and the program adapts. Reporting earns XP, never costs it.</p>
      <div className="stack" role="radiogroup" aria-label="Issue">
        {issues.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={issue === id}
            aria-pressed={issue === id}
            className="list-button"
            onClick={() => setIssue(id)}
          >
            <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
              {issueLabels[id].icon}
            </span>
            <span>
              <strong>{issueLabels[id].title}</strong>
              <br />
              <span className="small">{issueLabels[id].effect}</span>
            </span>
          </button>
        ))}
      </div>
      <label>
        Notes (optional)
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. right knee twinges on deep squats" />
      </label>
      <button
        className="primary"
        disabled={issue === undefined}
        onClick={() => {
          if (issue === undefined) return
          void onSubmit({ date: today, windowId, goalId, issue, note: note.trim() }).then(() => setDone(true))
        }}
      >
        Adjust my program
      </button>
    </Sheet>
  )
}
