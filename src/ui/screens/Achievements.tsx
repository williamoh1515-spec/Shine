import { AchievementGrid } from '../components/AchievementGrid'
import type { AppState } from '../state/derive'

interface Props {
  state: AppState
  navigate: (hash: string) => void
}

export function Achievements({ state, navigate }: Props) {
  return (
    <div className="stack">
      <header className="topbar">
        <button className="ghost" aria-label="Back" onClick={() => navigate('#/')}>
          ←
        </button>
        <h1 className="grow">🏅 Achievements</h1>
      </header>
      <AchievementGrid unlocked={state.unlocked} />
    </div>
  )
}
