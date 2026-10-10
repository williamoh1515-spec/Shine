import type {
  BodyPart,
  Equipment,
  Exercise,
  FatigueTag,
  GoalMetric,
  LoadType,
  Profile,
  ProgressionModel,
  TrainingWindow,
} from './models'

// A profile link carries a person's starting setup in the URL fragment:
//   …/#/join?p=<base64url(JSON)>
// The fragment never reaches the server. Link contents are UNTRUSTED: everything is narrowed and
// bounded here; nothing is cast.

export const PROFILE_LINK_VERSION = 1

/** Bounds keep a hostile or broken link from creating absurd data. */
export const LIMITS = {
  goals: 20,
  exercises: 80,
  windows: 12,
  bodyPartsPerWindow: 12,
  text: 80,
  longText: 400,
  kettlebells: 12,
  loadKg: 500,
  reps: 200,
  durationSec: 6 * 3600,
  distanceM: 500_000,
  sessionsPerWeek: 7,
  bodyMassKg: 300,
  heightCm: 250,
} as const

export interface GoalSeedV1 {
  windowId: string
  exerciseId: string
  title: string
  metric?: GoalMetric
  baseline: number
  baselineSource: 'test' | 'manual'
  target: number
  sessionsPerWeek: number
  minReps?: number
  startLoadKg?: number
}

export interface ProfileLinkV1 {
  v: typeof PROFILE_LINK_VERSION
  /** Makes applying idempotent. */
  id: string
  profile: Profile
  windows: TrainingWindow[]
  exercises: Exercise[]
  goals: GoalSeedV1[]
}

// ---------- encoding ----------

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

export function encodeProfileLink(link: ProfileLinkV1): string {
  return toBase64Url(JSON.stringify(link))
}

// ---------- validation ----------

export type DecodeResult = { ok: true; link: ProfileLinkV1 } | { ok: false; error: string }

class LinkError extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function fail(message: string): never {
  throw new LinkError(message)
}

function str(v: unknown, field: string, max: number = LIMITS.text): string {
  if (typeof v !== 'string' || v.trim() === '') fail(`${field} is missing`)
  return v.trim().slice(0, max)
}

function optStr(v: unknown, max: number = LIMITS.longText): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined
}

function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${field} is out of range`)
  return v
}

function optNum(v: unknown, field: string, min: number, max: number): number | undefined {
  return v === undefined ? undefined : num(v, field, min, max)
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) fail(`${field} is invalid`)
  return v as T
}

function list(v: unknown, field: string, max: number): unknown[] {
  if (v === undefined) return []
  if (!Array.isArray(v)) fail(`${field} must be a list`)
  if (v.length > max) fail(`Too many ${field}`)
  return v
}

/** Ids are restricted to a safe charset: they become IndexedDB keys and URL parts. */
function id(v: unknown, field: string): string {
  const s = str(v, field, 60)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) fail(`${field} has invalid characters`)
  return s
}

const MODELS: readonly ProgressionModel[] = ['strength', 'repsEndurance', 'timed', 'running', 'cycling', 'custom']
const LOAD_TYPES: readonly LoadType[] = ['plates', 'kettlebell', 'kettlebellPair', 'addedLoad', 'bodyweight']
const TAGS: readonly FatigueTag[] = ['pull', 'push', 'grip', 'shoulder', 'legs', 'posteriorChain', 'core']
const METRICS: readonly GoalMetric[] = ['oneRepMaxKg', 'workingLoadKg', 'maxReps', 'maxDurationSec', 'distanceM']

function parseEquipment(v: unknown): Equipment | undefined {
  if (v === undefined) return undefined
  if (!isRecord(v)) fail('equipment is invalid')
  return {
    kettlebellsKg: list(v.kettlebellsKg, 'kettlebells', LIMITS.kettlebells).map((k) => num(k, 'kettlebell', 0.5, 100)),
    pullUpBar: v.pullUpBar === true,
    bands: v.bands === true,
    ...(v.plateIncrementKg !== undefined ? { plateIncrementKg: num(v.plateIncrementKg, 'plate increment', 0.25, 25) } : {}),
  }
}

function parseProfile(v: unknown): Profile {
  if (v === undefined) return {}
  if (!isRecord(v)) fail('profile is invalid')
  const profile: Profile = {}
  const name = optStr(v.name, LIMITS.text)
  if (name !== undefined) profile.name = name
  const bodyMassKg = optNum(v.bodyMassKg, 'body mass', 20, LIMITS.bodyMassKg)
  if (bodyMassKg !== undefined) profile.bodyMassKg = bodyMassKg
  const heightCm = optNum(v.heightCm, 'height', 80, LIMITS.heightCm)
  if (heightCm !== undefined) profile.heightCm = heightCm
  const equipment = parseEquipment(v.equipment)
  if (equipment !== undefined) profile.equipment = equipment
  return profile
}

function parseExercise(v: unknown): Exercise {
  if (!isRecord(v)) fail('exercise is invalid')
  const exercise: Exercise = {
    id: id(v.id, 'exercise id'),
    name: str(v.name, 'exercise name'),
    progressionModel: oneOf(v.progressionModel, MODELS, 'progression model'),
  }
  if (v.region !== undefined) exercise.region = oneOf(v.region, ['upper', 'lower'] as const, 'region')
  if (v.loadType !== undefined) exercise.loadType = oneOf(v.loadType, LOAD_TYPES, 'load type')
  if (v.fatigueTags !== undefined) {
    exercise.fatigueTags = list(v.fatigueTags, 'fatigue tags', TAGS.length).map((t) => oneOf(t, TAGS, 'fatigue tag'))
  }
  if (isRecord(v.overrides)) {
    const o = v.overrides
    const overrides: NonNullable<Exercise['overrides']> = {}
    if (o.repRange !== undefined) {
      const [lo, hi] = list(o.repRange, 'rep range', 2).map((r) => num(r, 'rep range', 1, LIMITS.reps))
      if (lo === undefined || hi === undefined || lo > hi) fail('rep range is invalid')
      overrides.repRange = [lo, hi]
    }
    const inc = optNum(o.loadIncrementKg, 'load increment', 0.25, 50)
    if (inc !== undefined) overrides.loadIncrementKg = inc
    const ws = optNum(o.workingSets, 'working sets', 1, 10)
    if (ws !== undefined) overrides.workingSets = ws
    const hold = optNum(o.maxHoldSec, 'max hold', 5, 3600)
    if (hold !== undefined) overrides.maxHoldSec = hold
    exercise.overrides = overrides
  }
  const regression = optStr(v.regression)
  if (regression !== undefined) exercise.regression = regression
  const notes = optStr(v.notes)
  if (notes !== undefined) exercise.notes = notes
  if (v.accessories !== undefined) {
    exercise.accessories = list(v.accessories, 'accessories', 12).map((a) => id(a, 'accessory id'))
  }
  if (v.weightedVariantId !== undefined) exercise.weightedVariantId = id(v.weightedVariantId, 'weighted variant id')
  if (v.hidden === true) exercise.hidden = true
  return exercise
}

function parseBodyPart(v: unknown): BodyPart {
  if (!isRecord(v)) fail('body part is invalid')
  return {
    id: id(v.id, 'body part id'),
    title: str(v.title, 'body part title'),
    exerciseIds: list(v.exerciseIds, 'body part exercises', LIMITS.exercises).map((e) => id(e, 'exercise id')),
  }
}

function parseWindow(v: unknown): TrainingWindow {
  if (!isRecord(v)) fail('window is invalid')
  const window: TrainingWindow = {
    id: id(v.id, 'window id'),
    title: str(v.title, 'window title'),
    icon: str(v.icon, 'window icon', 8),
    enabled: v.enabled !== false,
    bodyParts: list(v.bodyParts, 'body parts', LIMITS.bodyPartsPerWindow).map(parseBodyPart),
  }
  if (v.hidden === true) window.hidden = true
  return window
}

function parseGoal(v: unknown): GoalSeedV1 {
  if (!isRecord(v)) fail('goal is invalid')
  const metric = v.metric === undefined ? undefined : oneOf(v.metric, METRICS, 'goal metric')
  const max = metric === 'maxDurationSec' ? LIMITS.durationSec : metric === 'distanceM' ? LIMITS.distanceM : LIMITS.loadKg
  const goal: GoalSeedV1 = {
    windowId: id(v.windowId, 'goal window'),
    exerciseId: id(v.exerciseId, 'goal exercise'),
    title: str(v.title, 'goal title'),
    baseline: num(v.baseline, 'goal baseline', 0, max),
    baselineSource: v.baselineSource === 'test' ? 'test' : 'manual',
    target: num(v.target, 'goal target', 0, max),
    sessionsPerWeek: num(v.sessionsPerWeek, 'sessions per week', 1, LIMITS.sessionsPerWeek),
  }
  if (metric !== undefined) goal.metric = metric
  const minReps = optNum(v.minReps, 'minimum reps', 1, LIMITS.reps)
  if (minReps !== undefined) goal.minReps = minReps
  const startLoadKg = optNum(v.startLoadKg, 'start load', 0, LIMITS.loadKg)
  if (startLoadKg !== undefined) goal.startLoadKg = startLoadKg
  return goal
}

/** Narrows a stored/unknown value to a Profile, dropping anything invalid. */
export function toProfile(value: unknown): Profile {
  try {
    return parseProfile(value)
  } catch {
    return {}
  }
}

/** Validates a decoded JSON value. Also used for pasted profile JSON. */
export function parseProfileLink(json: unknown): DecodeResult {
  try {
    if (!isRecord(json)) fail('Not a profile')
    if (json.v !== PROFILE_LINK_VERSION) fail('This link was made by a different version of the app')
    const link: ProfileLinkV1 = {
      v: PROFILE_LINK_VERSION,
      id: id(json.id, 'link id'),
      profile: parseProfile(json.profile),
      windows: list(json.windows, 'windows', LIMITS.windows).map(parseWindow),
      exercises: list(json.exercises, 'exercises', LIMITS.exercises).map(parseExercise),
      goals: list(json.goals, 'goals', LIMITS.goals).map(parseGoal),
    }
    return { ok: true, link }
  } catch (e) {
    if (e instanceof LinkError) return { ok: false, error: e.message }
    return { ok: false, error: 'The link is damaged' }
  }
}

export function decodeProfileLink(encoded: string): DecodeResult {
  let json: unknown
  try {
    json = JSON.parse(fromBase64Url(encoded.trim()))
  } catch {
    return { ok: false, error: 'The link is damaged or incomplete' }
  }
  return parseProfileLink(json)
}

/**
 * Checks that every goal and body part points at an exercise that will exist after applying
 * (from the link itself or the built-in catalog).
 */
export function missingReferences(link: ProfileLinkV1, knownExerciseIds: Set<string>, knownWindowIds: Set<string>): string[] {
  const exercises = new Set([...knownExerciseIds, ...link.exercises.map((e) => e.id)])
  const windows = new Set([...knownWindowIds, ...link.windows.map((w) => w.id)])
  const missing: string[] = []
  for (const g of link.goals) {
    if (!exercises.has(g.exerciseId)) missing.push(`exercise "${g.exerciseId}"`)
    if (!windows.has(g.windowId)) missing.push(`window "${g.windowId}"`)
  }
  for (const w of link.windows) {
    for (const b of w.bodyParts) for (const e of b.exerciseIds) if (!exercises.has(e)) missing.push(`exercise "${e}"`)
  }
  return [...new Set(missing)]
}
