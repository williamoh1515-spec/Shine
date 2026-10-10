import type { Plan, TimeConfig } from '../domain/plans'

// Ready-made plans. Exercises come from the catalog; a unit test checks every plan against the
// opposite-muscle balance pairs (balance.config.ts), so an edit can't unbalance it silently.
// Sets × reps follow the strength defaults: 1–3 RIR, 2–3 hard sets per exercise.

export const plans: Plan[] = [
  {
    id: 'legs-push-pull',
    name: 'Strength & balance · Legs / Push / Pull',
    summary: '3 days a week, ~50–55 min each. Big lifts first, core in every session.',
    why: 'One day per area keeps sessions short. Hamstrings, rear shoulders and shoulder rotators get more work than usual to protect knees and shoulders; every exercise is paired with its opposite muscles.',
    windowId: 'strength',
    days: [
      {
        id: 'legs',
        title: 'Legs + core',
        items: [
          { exerciseId: 'back-squat', sets: 3, reps: [5, 8], superset: 'A1', main: true },
          { exerciseId: 'nordic-curl', sets: 3, reps: [3, 6], superset: 'A2' },
          { exerciseId: 'romanian-deadlift', sets: 3, reps: [6, 10], superset: 'B1' },
          { exerciseId: 'step-down', sets: 2, reps: [8, 12], superset: 'B2' },
          { exerciseId: 'lateral-band-walk', sets: 2, reps: [10, 20], superset: 'C1' },
          { exerciseId: 'copenhagen-plank', sets: 2, holdSec: [20, 30], superset: 'C2' },
          { exerciseId: 'single-leg-calf-raise', sets: 2, reps: [10, 15], superset: 'D1' },
          { exerciseId: 'tibialis-raise', sets: 2, reps: [15, 25], superset: 'D2' },
        ],
      },
      {
        id: 'push',
        title: 'Push (chest & shoulders) + core',
        items: [
          { exerciseId: 'bench-press', sets: 3, reps: [5, 8], superset: 'A1', main: true },
          { exerciseId: 'face-pull', sets: 2, reps: [12, 15], superset: 'A2' },
          { exerciseId: 'db-overhead-press', sets: 3, reps: [6, 10], superset: 'B1', main: true },
          { exerciseId: 'cable-external-rotation', sets: 2, reps: [10, 15], superset: 'B2' },
          { exerciseId: 'push-up', sets: 2, reps: [8, 20], superset: 'C1', note: 'Stop 2 reps before failure.' },
          { exerciseId: 'ab-wheel', sets: 3, reps: [6, 10], superset: 'C2' },
          { exerciseId: 'side-plank', sets: 2, holdSec: [20, 45] },
        ],
      },
      {
        id: 'pull',
        title: 'Pull + core',
        items: [
          { exerciseId: 'deadlift', sets: 3, reps: [3, 5], superset: 'A1', main: true },
          { exerciseId: 'hanging-knee-raise', sets: 3, reps: [8, 12], superset: 'A2' },
          { exerciseId: 'pull-up', sets: 3, reps: [4, 8], superset: 'B1', main: true, note: 'Add weight once 3 × 8 is easy.' },
          { exerciseId: 'barbell-row', sets: 3, reps: [6, 10], superset: 'B2' },
          { exerciseId: 'face-pull', sets: 2, reps: [12, 15], superset: 'C1' },
          { exerciseId: 'back-extension', sets: 2, reps: [8, 15], superset: 'C2' },
        ],
      },
    ],
  },
  {
    id: 'full-body-3',
    name: 'Full body ×3 · strength focus',
    summary: '3 days a week, ~55 min each. Squat, bench and pull-ups twice a week.',
    why: 'Training each main lift about twice a week tends to build strength faster than once. Choose this if lifting numbers matter most; the knee and shoulder work is spread over the three days.',
    windowId: 'strength',
    days: [
      {
        id: 'a',
        title: 'Full body A',
        items: [
          { exerciseId: 'back-squat', sets: 3, reps: [5, 8], main: true },
          { exerciseId: 'bench-press', sets: 3, reps: [5, 8], superset: 'B1', main: true },
          { exerciseId: 'face-pull', sets: 2, reps: [12, 15], superset: 'B2' },
          { exerciseId: 'pull-up', sets: 3, reps: [4, 8], superset: 'C1', main: true },
          { exerciseId: 'nordic-curl', sets: 2, reps: [3, 6], superset: 'C2' },
          { exerciseId: 'ab-wheel', sets: 2, reps: [6, 10] },
        ],
      },
      {
        id: 'b',
        title: 'Full body B',
        items: [
          { exerciseId: 'deadlift', sets: 3, reps: [3, 5], main: true },
          { exerciseId: 'db-overhead-press', sets: 3, reps: [6, 10], superset: 'B1', main: true },
          { exerciseId: 'barbell-row', sets: 3, reps: [6, 10], superset: 'B2' },
          { exerciseId: 'step-down', sets: 2, reps: [8, 12], superset: 'C1' },
          { exerciseId: 'back-extension', sets: 2, reps: [8, 15], superset: 'C2' },
          { exerciseId: 'lateral-band-walk', sets: 2, reps: [10, 20], superset: 'D1' },
          { exerciseId: 'copenhagen-plank', sets: 2, holdSec: [20, 30], superset: 'D2' },
          { exerciseId: 'cable-external-rotation', sets: 2, reps: [10, 15] },
        ],
      },
      {
        id: 'c',
        title: 'Full body C',
        items: [
          { exerciseId: 'back-squat', sets: 3, reps: [5, 8], main: true },
          { exerciseId: 'bench-press', sets: 3, reps: [5, 8], superset: 'B1', main: true },
          { exerciseId: 'single-leg-rdl', sets: 2, reps: [6, 10], superset: 'B2' },
          { exerciseId: 'pull-up', sets: 3, reps: [4, 8], superset: 'C1', main: true },
          { exerciseId: 'hanging-knee-raise', sets: 2, reps: [8, 12], superset: 'C2' },
          { exerciseId: 'single-leg-calf-raise', sets: 2, reps: [10, 15], superset: 'D1' },
          { exerciseId: 'tibialis-raise', sets: 2, reps: [15, 25], superset: 'D2' },
        ],
      },
    ],
  },
]

// Rough minutes per set including rest. Estimates for planning, not rules.
export const planTimeConfig: TimeConfig = {
  warmUpMin: 8,
  // Heavy compound lifts: ~2–3 min rest plus the set.
  mainSetMin: 4,
  setMin: 2.5,
  bodyweightSetMin: 2,
  supersetShare: 0.6,
}

export const plansById: Record<string, Plan> = Object.fromEntries(plans.map((p) => [p.id, p]))
