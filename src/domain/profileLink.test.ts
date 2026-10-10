import { describe, expect, it } from 'vitest'
import {
  decodeProfileLink,
  encodeProfileLink,
  LIMITS,
  missingReferences,
  parseProfileLink,
  toProfile,
  type ProfileLinkV1,
} from './profileLink'

const link: ProfileLinkV1 = {
  v: 1,
  id: 'link-abc',
  profile: {
    name: 'Léo 🧗',
    bodyMassKg: 72,
    equipment: { kettlebellsKg: [4, 8, 12, 16], pullUpBar: true, bands: false },
  },
  windows: [
    {
      id: 'custom-home',
      title: 'Home strength',
      icon: '🏠',
      enabled: true,
      bodyParts: [{ id: 'legs', title: 'Legs', exerciseIds: ['custom-bss'] }],
    },
  ],
  exercises: [
    {
      id: 'custom-bss',
      name: 'Bulgarian split squat',
      progressionModel: 'strength',
      region: 'lower',
      loadType: 'kettlebell',
      fatigueTags: ['legs'],
      overrides: { repRange: [6, 12] },
    },
  ],
  goals: [
    {
      windowId: 'custom-home',
      exerciseId: 'custom-bss',
      title: 'BSS 3×12 @16 kg',
      metric: 'maxReps',
      baseline: 6,
      baselineSource: 'manual',
      target: 12,
      sessionsPerWeek: 2,
      startLoadKg: 16,
    },
  ],
}

/** Encodes arbitrary (possibly invalid) JSON the same way links are encoded: UTF-8 → base64url. */
const raw = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

describe('profile links', () => {
  it('round-trips, including non-ASCII text', () => {
    const decoded = decodeProfileLink(encodeProfileLink(link))
    expect(decoded).toEqual({ ok: true, link })
  })

  it('produces URL-safe output', () => {
    expect(encodeProfileLink(link)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects damaged or foreign input', () => {
    expect(decodeProfileLink('%%%not-base64').ok).toBe(false)
    expect(decodeProfileLink(encodeProfileLink(link).slice(0, 30)).ok).toBe(false)
    expect(decodeProfileLink(raw({ hello: 'world' })).ok).toBe(false)
    expect(decodeProfileLink(raw({ ...link, v: 99 }))).toMatchObject({ ok: false, error: expect.stringContaining('version') })
  })

  it('rejects out-of-range numbers and unknown enums', () => {
    const badGoal = { ...link, goals: [{ ...link.goals[0], sessionsPerWeek: 30 }] }
    expect(parseProfileLink(badGoal).ok).toBe(false)
    const badModel = { ...link, exercises: [{ ...link.exercises[0], progressionModel: 'teleport' }] }
    expect(parseProfileLink(badModel).ok).toBe(false)
    const nanBaseline = { ...link, goals: [{ ...link.goals[0], baseline: Number.NaN }] }
    expect(parseProfileLink(nanBaseline).ok).toBe(false)
    const badRange = { ...link, exercises: [{ ...link.exercises[0], overrides: { repRange: [12, 6] } }] }
    expect(parseProfileLink(badRange).ok).toBe(false)
  })

  it('carries muscles and antagonist pairs, and rejects unknown muscles', () => {
    const withMuscles = { ...link, exercises: [{ ...link.exercises[0], muscles: ['quads', 'glutes'], pairWith: ['nordic-curl'] }] }
    const parsed = parseProfileLink(withMuscles)
    expect(parsed.ok && parsed.link.exercises[0]).toMatchObject({ muscles: ['quads', 'glutes'], pairWith: ['nordic-curl'] })
    const bad = { ...link, exercises: [{ ...link.exercises[0], muscles: ['biceps-of-steel'] }] }
    expect(parseProfileLink(bad).ok).toBe(false)
  })

  it('rejects unsafe ids', () => {
    const evil = { ...link, exercises: [{ ...link.exercises[0], id: '<img src=x>' }] }
    expect(parseProfileLink(evil).ok).toBe(false)
  })

  it('bounds list sizes', () => {
    const many = { ...link, goals: Array.from({ length: LIMITS.goals + 1 }, () => link.goals[0]) }
    expect(parseProfileLink(many)).toMatchObject({ ok: false, error: 'Too many goals' })
  })

  it('trims long text', () => {
    const long = { ...link, profile: { name: 'x'.repeat(500) } }
    const parsed = parseProfileLink(long)
    expect(parsed.ok && parsed.link.profile.name?.length).toBe(LIMITS.text)
  })

  it('drops unknown fields', () => {
    const extra = { ...link, profile: { ...link.profile, isAdmin: true } }
    const parsed = parseProfileLink(extra)
    expect(parsed.ok && 'isAdmin' in parsed.link.profile).toBe(false)
  })

  it('finds references to exercises or windows that will not exist', () => {
    expect(missingReferences(link, new Set(), new Set())).toEqual([])
    const broken = { ...link, goals: [{ ...link.goals[0]!, exerciseId: 'custom-nope' }] }
    expect(missingReferences(broken, new Set(), new Set())).toEqual(['exercise "custom-nope"'])
  })

  it('narrows stored profiles safely', () => {
    expect(toProfile({ bodyMassKg: 80 })).toEqual({ bodyMassKg: 80 })
    expect(toProfile('garbage')).toEqual({})
    expect(toProfile({ bodyMassKg: -5 })).toEqual({})
  })
})
