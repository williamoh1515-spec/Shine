import type { Profile } from '../domain/models'
import type { GoalSeedV1 } from '../domain/profileLink'

// Personal baselines and goals. The committed app starts empty: real values live in
// src/config/profile.local.ts (git-ignored). If that file exists it is used automatically.
// Other people get their setup through a profile link instead (Settings → Share a profile).

export type { Profile }
export type GoalSeed = GoalSeedV1

interface LocalProfile {
  profile?: Profile
  goalSeeds?: GoalSeed[]
}

// Optional file: import.meta.glob resolves to {} when it doesn't exist.
const local = Object.values(
  import.meta.glob<LocalProfile>('./profile.local.ts', { eager: true }),
)[0]

export const profile: Profile = local?.profile ?? {}
export const goalSeeds: GoalSeed[] = local?.goalSeeds ?? []
