import { achievements } from '../../config/achievements.config'
import type { UnlockedAchievement } from '../../domain/models'
import { formatDate } from '../format'

export function AchievementGrid({ unlocked }: { unlocked: UnlockedAchievement[] }) {
  const byId = new Map(unlocked.map((u) => [u.achievement.id, u]))
  return (
    <section className="card" aria-labelledby="ach-title">
      <div className="row spread">
        <h3 id="ach-title">Achievements</h3>
        <span className="small muted">
          {unlocked.length}/{achievements.length}
        </span>
      </div>
      <ul className="achievements">
        {achievements.map((a) => {
          const u = byId.get(a.id)
          return (
            <li key={a.id} className={u ? 'unlocked' : 'locked'}>
              <span className="icon" aria-hidden="true">
                {u ? a.icon : '🔒'}
              </span>
              <div>
                <strong>{a.title}</strong>
                <p className="small muted">
                  {a.description}
                  {u && ` · ${formatDate(u.unlockedOn)}`}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
