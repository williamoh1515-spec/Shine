import { describe, expect, it } from 'vitest'
import { gamificationConfig as config } from '../config/progression.config'
import {
  computeXp,
  evaluateAchievements,
  levelFromXp,
  personalRecords,
  rirFullyLogged,
  weeklyStreak,
  type AchievementFacts,
} from './gamification'
import { checkIn, session, sets } from './testUtils'

const planned = { strength: 2 }

describe('computeXp', () => {
  it('rewards a planned session, logged RIR, tests and deloads', () => {
    const xp = computeXp(
      [
        session('2026-10-05', sets('box-squat', 60, [8, 8], 2)),
        session('2026-10-07', sets('box-squat', 60, [8, 8]), { kind: 'deload' }),
      ],
      [],
      planned,
      config,
    )
    expect(xp.total).toBe(50 + 10 + 50 + 20)
    expect(xp.byWindow.strength).toBe(xp.total)
  })

  it('gives no XP for sessions beyond the weekly plan', () => {
    const xp = computeXp(
      ['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => session(d, sets('box-squat', 60, [5]))),
      [],
      planned,
      config,
    )
    expect(xp.total).toBe(100)
  })

  it('caps XP per day', () => {
    const xp = computeXp(
      [session('2026-10-05', sets('box-squat', 60, [5], 2), { kind: 'test' })],
      [checkIn('2026-10-05', 'tooEasy'), checkIn('2026-10-05', 'plateau')],
      planned,
      config,
    )
    expect(xp.total).toBe(config.xp.dailyCap)
  })

  it('never costs XP for a pain flag', () => {
    const xp = computeXp([session('2026-10-05', sets('box-squat', 60, [5]), { painFlag: true })], [], planned, config)
    expect(xp.total).toBe(50)
  })
})

describe('habit ticks', () => {
  it('earn a small XP amount each, counted toward the global total only', () => {
    const xp = computeXp([], [], planned, config, ['2026-10-05', '2026-10-06', '2026-10-07'])
    expect(xp.total).toBe(3 * config.xp.habitTick)
    expect(xp.byWindow.strength).toBeUndefined()
  })

  it('stay inside the daily XP cap together with training', () => {
    const xp = computeXp([session('2026-10-05', sets('x', 60, [5], 2), { kind: 'test' })], [checkIn('2026-10-05', 'tooEasy')], planned, config, ['2026-10-05'])
    expect(xp.total).toBeLessThanOrEqual(config.xp.dailyCap)
  })
})

describe('habit achievements', () => {
  const facts = (streaks: number[]): AchievementFacts => ({
    sessionDates: [], prDates: [], milestoneHitDates: [], rirLoggedDates: [], testDates: [], deloadDates: [], checkInDates: [],
    streakWeeks: [],
    habitStreak: streaks.map((streak, i) => ({ date: `2026-10-${String(1 + i).padStart(2, '0')}`, streak })),
  })
  const seven = { id: 'h7', title: '', description: '', icon: '', rule: { type: 'habitStreak' as const, days: 7 } }

  it('unlocks on the day the streak first reaches the target', () => {
    expect(evaluateAchievements([seven], facts([1, 2, 3, 4, 5, 6, 7, 8]))[0]?.unlockedOn).toBe('2026-10-07')
  })

  it('stays locked below the target or without habit data', () => {
    expect(evaluateAchievements([seven], facts([1, 2, 3]))).toEqual([])
    expect(evaluateAchievements([seven], { ...facts([]), habitStreak: undefined })).toEqual([])
  })
})

describe('rirFullyLogged', () => {
  it('needs RIR on every set with reps', () => {
    expect(rirFullyLogged(session('2026-10-05', sets('x', 60, [5, 5], 2)))).toBe(true)
    expect(rirFullyLogged(session('2026-10-05', [...sets('x', 60, [5], 2), ...sets('x', 60, [5])]))).toBe(false)
    expect(rirFullyLogged(session('2026-10-05', []))).toBe(false)
  })
})

describe('levelFromXp', () => {
  it('starts at level 1 and levels up', () => {
    expect(levelFromXp(0, config)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 150 })
    expect(levelFromXp(160, config).level).toBe(2)
    expect(levelFromXp(-5, config).level).toBe(1)
  })
})

describe('weeklyStreak', () => {
  const twice = (monday: string, extra = {}) => [
    session(monday, sets('x', 60, [5]), extra),
    session(monday.replace(/\d\d$/, (d) => String(Number(d) + 2).padStart(2, '0')), sets('x', 60, [5])),
  ]

  it('counts consecutive hit weeks', () => {
    const s = [...twice('2026-09-21'), ...twice('2026-09-28'), ...twice('2026-10-05')]
    const r = weeklyStreak(s, [], 2, '2026-10-08', config)
    expect(r.current).toBe(3)
    expect(r.best).toBe(3)
  })

  it('does not break on the week still in progress', () => {
    const r = weeklyStreak([...twice('2026-09-28')], [], 2, '2026-10-06', config)
    expect(r.current).toBe(1)
    expect(r.weeks.at(-1)?.outcome).toBe('inProgress')
  })

  it('uses one freeze per month, then breaks', () => {
    const s = [
      ...twice('2026-09-07'),
      // weeks of 09-14 and 09-21 missed: the first is frozen, the second breaks
      ...twice('2026-09-28'),
    ]
    const r = weeklyStreak(s, [], 2, '2026-10-01', config)
    expect(r.weeks.map((w) => w.outcome)).toEqual(['hit', 'frozen', 'missed', 'hit'])
    expect(r.current).toBe(1)
  })

  it('never breaks on a deload or pain week', () => {
    const s = [
      ...twice('2026-09-07'),
      session('2026-09-14', sets('x', 60, [5]), { kind: 'deload' }),
      ...twice('2026-09-28'),
    ]
    const r = weeklyStreak(s, [checkIn('2026-09-22', 'pain')], 2, '2026-10-01', config)
    expect(r.weeks.map((w) => w.outcome)).toEqual(['hit', 'protected', 'protected', 'hit'])
    expect(r.current).toBe(2)
  })
})

describe('personalRecords', () => {
  it('detects improvements but not the first session', () => {
    const prs = personalRecords([
      session('2026-10-01', sets('box-squat', 60, [5])),
      session('2026-10-03', sets('box-squat', 60, [5])),
      session('2026-10-05', sets('box-squat', 65, [5])),
      session('2026-10-07', [{ exerciseId: 'pull-up', reps: 10 }]),
      session('2026-10-09', [{ exerciseId: 'pull-up', reps: 11 }]),
    ])
    expect(prs.map((p) => [p.date, p.exerciseId])).toEqual([
      ['2026-10-05', 'box-squat'],
      ['2026-10-09', 'pull-up'],
    ])
  })
})

describe('evaluateAchievements', () => {
  const facts: AchievementFacts = {
    sessionDates: ['2026-10-03', '2026-10-01'],
    prDates: [],
    milestoneHitDates: ['2026-10-05'],
    rirLoggedDates: [],
    testDates: [],
    deloadDates: [],
    checkInDates: [],
    streakWeeks: [{ weekOf: '2026-09-28', sessions: 2, outcome: 'hit', streak: 1 }],
  }

  it('unlocks on the date the rule was first satisfied', () => {
    const unlocked = evaluateAchievements(
      [
        { id: 'a', title: '', description: '', icon: '', rule: { type: 'sessionCount', count: 2 } },
        { id: 'b', title: '', description: '', icon: '', rule: { type: 'personalRecord', count: 1 } },
        { id: 'c', title: '', description: '', icon: '', rule: { type: 'milestonesHit', count: 1 } },
        { id: 'd', title: '', description: '', icon: '', rule: { type: 'weeklyStreak', weeks: 1 } },
      ],
      facts,
    )
    expect(unlocked.map((u) => [u.achievement.id, u.unlockedOn])).toEqual([
      ['a', '2026-10-03'],
      ['c', '2026-10-05'],
      ['d', '2026-10-04'],
    ])
  })
})
