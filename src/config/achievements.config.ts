import type { Achievement } from '../domain/models'

// Achievement definitions are data. Most reward process (consistency, logging, recovery), not just PRs.

export const achievements: Achievement[] = [
  { id: 'first-session', title: 'First Step', description: 'Log your first session.', icon: '👟', rule: { type: 'sessionCount', count: 1 } },
  { id: 'ten-sessions', title: 'Showing Up', description: 'Log 10 sessions.', icon: '📅', rule: { type: 'sessionCount', count: 10 } },
  { id: 'first-pr', title: 'New Best', description: 'Beat a previous best on any exercise.', icon: '⚡', rule: { type: 'personalRecord', count: 1 } },
  { id: 'five-prs', title: 'On a Roll', description: 'Set 5 personal records.', icon: '🔥', rule: { type: 'personalRecord', count: 5 } },
  { id: 'first-milestone', title: 'Checkpoint', description: 'Reach your first milestone.', icon: '🚩', rule: { type: 'milestonesHit', count: 1 } },
  { id: 'three-milestones', title: 'Climber', description: 'Reach 3 milestones.', icon: '⛰️', rule: { type: 'milestonesHit', count: 3 } },
  { id: 'streak-4', title: 'Four-Week Habit', description: 'Hit your weekly plan 4 weeks in a row.', icon: '🗓️', rule: { type: 'weeklyStreak', weeks: 4 } },
  { id: 'habit-7', title: 'Morning Habit', description: 'Do your daily routine 7 days in a row.', icon: '☀️', rule: { type: 'habitStreak', days: 7 } },
  { id: 'habit-30', title: 'Unshakeable', description: 'Do your daily routine 30 days in a row.', icon: '🌅', rule: { type: 'habitStreak', days: 30 } },
  { id: 'rir-logger', title: 'Honest Effort', description: 'Log RIR on every set in 5 sessions.', icon: '🎯', rule: { type: 'rirLoggedSessions', count: 5 } },
  { id: 'first-test', title: 'Measured', description: 'Complete a test session.', icon: '📏', rule: { type: 'testSessions', count: 1 } },
  { id: 'first-deload', title: 'Smart Recovery', description: 'Complete a deload session.', icon: '🛌', rule: { type: 'deloadSessions', count: 1 } },
  { id: 'first-check-in', title: 'Listening to the Body', description: 'Report how training is going.', icon: '💬', rule: { type: 'checkIns', count: 1 } },
]
