import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../state/derive'
import { formatMetric } from '../format'

interface MilestoneMoment {
  key: string
  title: string
  stat: string
  final: boolean
}

interface Toast {
  key: string
  icon: string
  text: string
}

/** More new items than this at once means an import/demo load, not a real moment. */
const BULK_THRESHOLD = 3
const TOAST_MS = 4000

function milestoneKeys(state: AppState): Map<string, MilestoneMoment> {
  const out = new Map<string, MilestoneMoment>()
  for (const w of state.windows) {
    for (const g of w.goals) {
      g.milestones.forEach((m, i) => {
        if (m.hitOn === undefined) return
        const key = `${g.goal.id}:${m.milestone.index}`
        out.set(key, {
          key,
          title: g.goal.title,
          stat: formatMetric(g.goal.metric, m.milestone.targetValue),
          final: i === g.milestones.length - 1,
        })
      })
    }
  }
  return out
}

/** Watches state changes: milestone → full-screen moment, achievement → toast, PR → confetti. */
export function Celebrations({ state }: { state: AppState }) {
  const prev = useRef<{ milestones: Set<string>; achievements: Set<string>; prs: number } | null>(null)
  const [moment, setMoment] = useState<MilestoneMoment>()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confetti, setConfetti] = useState(0)

  useEffect(() => {
    const milestones = milestoneKeys(state)
    const achievementIds = new Set(state.unlocked.map((u) => u.achievement.id))
    const before = prev.current
    prev.current = { milestones: new Set(milestones.keys()), achievements: achievementIds, prs: state.prs.length }
    if (before === null) return

    const newMilestones = [...milestones.values()].filter((m) => !before.milestones.has(m.key))
    const newAchievements = state.unlocked.filter((u) => !before.achievements.has(u.achievement.id))
    const newPrs = state.prs.length - before.prs
    if (newMilestones.length + newAchievements.length + Math.max(0, newPrs) > BULK_THRESHOLD) return

    if (newMilestones[0]) setMoment(newMilestones[0])
    if (newAchievements.length > 0) {
      setToasts((t) => [
        ...t,
        ...newAchievements.map((u) => ({
          key: `${u.achievement.id}-${Date.now()}`,
          icon: u.achievement.icon,
          text: `Achievement unlocked: ${u.achievement.title}`,
        })),
      ])
    }
    if (newPrs > 0) setConfetti((c) => c + 1)
  }, [state])

  useEffect(() => {
    if (toasts.length === 0) return
    const id = setTimeout(() => setToasts((t) => t.slice(1)), TOAST_MS)
    return () => clearTimeout(id)
  }, [toasts])

  useEffect(() => {
    if (!moment) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMoment(undefined)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [moment])

  return (
    <>
      {moment && (
        <button className="moment" onClick={() => setMoment(undefined)} aria-label="Milestone reached. Tap to continue.">
          <span className="moment-emoji" aria-hidden="true">
            {moment.final ? '🏆' : '🚩'}
          </span>
          <span className="moment-title">{moment.final ? 'GOAL REACHED' : 'Milestone reached'}</span>
          <span className="moment-stat">{moment.stat}</span>
          <span className="small">{moment.title}</span>
          <span className="small muted">Tap to continue</span>
        </button>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.slice(0, 2).map((t) => (
          <button key={t.key} className="toast" onClick={() => setToasts((all) => all.filter((x) => x.key !== t.key))}>
            <span aria-hidden="true">{t.icon}</span> {t.text}
          </button>
        ))}
      </div>
      {confetti > 0 && <Confetti key={confetti} />}
    </>
  )
}

function Confetti() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 1600)
    return () => clearTimeout(id)
  }, [])
  if (!visible) return null
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 60}ms` }}>
          {['⚡', '✨', '🎉'][i % 3]}
        </span>
      ))}
    </div>
  )
}
