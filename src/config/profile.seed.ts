// Personal baselines and goals. The committed app starts empty: real values live in
// src/config/profile.local.ts (git-ignored). If that file exists it is used automatically.

export interface Profile {
  bodyMassKg?: number
  heightCm?: number
}

export interface GoalSeed {
  windowId: string
  exerciseId: string
  title: string
  baseline: number
  baselineSource: 'test' | 'manual'
  target: number
  sessionsPerWeek: number
}

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
