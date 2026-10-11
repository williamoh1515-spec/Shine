import type { Habit } from '../domain/models'

// Daily habits shown on the home page. Adding another daily tick only needs an entry here.

export const habits: Habit[] = [
  {
    id: 'morning',
    name: 'Morning routine',
    icon: '☀️',
    description: 'Yoga, mobility and your morning routine: tick it once it is done.',
  },
]
