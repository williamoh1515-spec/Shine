import { describe, expect, it } from 'vitest'
import { dailyStreak, lastSevenDays } from './habits'

// 2026-10-05 is a Monday; weeks run Mon–Sun.
const run = (checked: string[], today: string, passes = 1) => dailyStreak(checked, today, passes)

describe('dailyStreak', () => {
  it('is empty without ticks', () => {
    const s = run([], '2026-10-11')
    expect(s).toMatchObject({ current: 0, best: 0, doneToday: false, passAvailable: true })
  })

  it('counts consecutive days including today', () => {
    const s = run(['2026-10-09', '2026-10-10', '2026-10-11'], '2026-10-11')
    expect(s).toMatchObject({ current: 3, best: 3, doneToday: true })
  })

  it('does not break the streak while today is still open', () => {
    const s = run(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-11')
    expect(s).toMatchObject({ current: 3, doneToday: false })
  })

  it('forgives one missed day in a week', () => {
    // Mon, Tue, (Wed missed), Thu, Fri
    const s = run(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'], '2026-10-09')
    expect(s.current).toBe(4)
    expect(s.days.get('2026-10-07')).toBe('pass')
    expect(s.passAvailable).toBe(false)
  })

  it('resets on a second miss in the same week', () => {
    // Mon, (Tue pass), Wed, (Thu missed → reset), Fri
    const s = run(['2026-10-05', '2026-10-07', '2026-10-09'], '2026-10-09')
    expect(s.current).toBe(1)
    expect(s.best).toBe(2)
    expect(s.days.get('2026-10-06')).toBe('pass')
    expect(s.days.get('2026-10-08')).toBe('missed')
  })

  it('gives a fresh free pass every week', () => {
    // Misses on Wed of week 1 and Wed of week 2: both forgiven.
    const checked = ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-15']
    const s = run(checked, '2026-10-15')
    expect(s.current).toBe(9)
    expect(s.days.get('2026-10-07')).toBe('pass')
    expect(s.days.get('2026-10-14')).toBe('pass')
  })

  it('supports a strict streak with zero passes', () => {
    const s = run(['2026-10-05', '2026-10-07'], '2026-10-07', 0)
    expect(s.current).toBe(1)
    expect(s.days.get('2026-10-06')).toBe('missed')
  })

  it('ignores ticks in the future and days before the first tick', () => {
    const s = run(['2026-10-10', '2026-10-20'], '2026-10-11')
    expect(s.current).toBe(1)
    expect(s.days.has('2026-10-09')).toBe(false)
  })

  it('keeps the best streak after a reset', () => {
    const checked = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-11']
    const s = run(checked, '2026-10-11')
    expect(s.best).toBe(5)
    expect(s.current).toBe(1)
  })

  it('records the streak length after each ticked day', () => {
    const s = run(['2026-10-05', '2026-10-06', '2026-10-08'], '2026-10-08')
    expect(s.streakOnDate).toEqual([
      { date: '2026-10-05', streak: 1 },
      { date: '2026-10-06', streak: 2 },
      { date: '2026-10-08', streak: 3 },
    ])
  })
})

describe('lastSevenDays', () => {
  it('shows the week ending today with the right statuses', () => {
    const s = run(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'], '2026-10-11')
    const dots = lastSevenDays(s, '2026-10-11')
    expect(dots.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
    expect(dots.map((d) => d.status)).toEqual(['done', 'done', 'pass', 'done', 'done', 'missed', 'open'])
  })
})
