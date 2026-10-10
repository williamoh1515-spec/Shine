import { useState } from 'react'
import { saveWindow } from '../../data/repositories/catalog'
import { customId } from '../../domain/catalog'
import type { TrainingWindow } from '../../domain/models'
import { Sheet } from './Sheet'

interface Props {
  takenIds: Set<string>
  onClose: () => void
  onCreated: (windowId: string) => void
}

/** Creates a new window (training area or sport) with a first body part. */
export function WindowEditor({ takenIds, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('⭐')
  const [part, setPart] = useState('')

  const save = async () => {
    if (title.trim() === '') return
    const id = customId(title, takenIds)
    const window: TrainingWindow = {
      id,
      title: title.trim(),
      icon: icon.trim().slice(0, 8) || '⭐',
      enabled: true,
      bodyParts: [{ id: 'main', title: part.trim() || 'All', exerciseIds: [] }],
    }
    await saveWindow(window)
    onCreated(id)
  }

  return (
    <Sheet title="New window" onClose={onClose}>
      <p className="small muted">A window is a training area or sport, e.g. Home kettlebells, Climbing, Mobility.</p>
      <div className="row">
        <label style={{ width: 80 }}>
          Icon
          <input value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="Icon (an emoji)" />
        </label>
        <label className="grow">
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Home kettlebells" />
        </label>
      </div>
      <label>
        First group (optional)
        <input value={part} onChange={(e) => setPart(e.target.value)} placeholder="e.g. Lower body" />
      </label>
      <button className="primary" disabled={title.trim() === ''} onClick={() => void save()}>
        Create window
      </button>
    </Sheet>
  )
}
