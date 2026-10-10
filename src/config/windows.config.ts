import type { Exercise, TrainingWindow } from '../domain/models'
import { kneeExercises, ratioTestExercises } from './exercises.knee.config'

// Which windows exist and which exercises belong to them.
// Adding a window or exercise should only require editing config files.
// `muscles` feeds the balance check; `pairWith` names exercises for the opposite muscles.

const mainExercises: Exercise[] = [
  // Pull
  {
    id: 'pull-up',
    name: 'Pull-up (rings)',
    progressionModel: 'repsEndurance',
    muscles: ['back'],
    pairWith: ['overhead-press', 'db-overhead-press'],
    regression: 'Band-assisted pull-ups or slow negatives',
    // Rear-delt / scapular work: a common limiter in pull-up endurance.
    accessories: ['face-pull', 'band-pull-apart', 'scapular-pull-up'],
    weightedVariantId: 'weighted-pull-up',
  },
  { id: 'weighted-pull-up', name: 'Weighted pull-up (added kg)', progressionModel: 'strength', region: 'upper', muscles: ['back'], pairWith: ['overhead-press'] },
  {
    id: 'barbell-row',
    name: 'Barbell row',
    progressionModel: 'strength',
    region: 'upper',
    muscles: ['back', 'rearDelts'],
    pairWith: ['bench-press'],
    overrides: { repRange: [6, 10] },
    regression: 'Chest-supported dumbbell row',
  },
  { id: 'ring-row', name: 'Ring row', progressionModel: 'repsEndurance', muscles: ['back', 'rearDelts'], pairWith: ['push-up'], regression: 'Ring row, more upright body' },
  { id: 'face-pull', name: 'Face pull', progressionModel: 'strength', region: 'upper', muscles: ['rearDelts', 'externalRotators'], pairWith: ['bench-press'], overrides: { repRange: [12, 15] } },
  { id: 'band-pull-apart', name: 'Band pull-apart', progressionModel: 'repsEndurance', muscles: ['rearDelts'] },
  { id: 'scapular-pull-up', name: 'Scapular pull-up', progressionModel: 'repsEndurance', muscles: ['back'] },
  // Push
  { id: 'bench-press', name: 'Bench press', progressionModel: 'strength', region: 'upper', liftClass: 'horizontalPush', muscles: ['chest', 'frontDelts'], pairWith: ['barbell-row', 'face-pull'], regression: 'Dumbbell floor press' },
  { id: 'overhead-press', name: 'Overhead press', progressionModel: 'strength', region: 'upper', liftClass: 'verticalPush', muscles: ['frontDelts'], pairWith: ['pull-up'], regression: 'Landmine press' },
  {
    id: 'db-overhead-press',
    name: 'Dumbbell shoulder press (per dumbbell)',
    progressionModel: 'strength',
    region: 'upper',
    loadType: 'plates',
    liftClass: 'verticalPush',
    implementCount: 2,
    muscles: ['frontDelts'],
    pairWith: ['pull-up'],
    // Dumbbells usually step 1–2 kg each.
    overrides: { loadIncrementKg: 2, repRange: [6, 10] },
    regression: 'Seated dumbbell press with back support',
  },
  { id: 'push-up', name: 'Push-up', progressionModel: 'repsEndurance', muscles: ['chest', 'frontDelts'], pairWith: ['ring-row'], regression: 'Incline push-up' },
  // Legs — knee-friendly defaults: ROM/depth progressions before load.
  { id: 'back-squat', name: 'Back squat', progressionModel: 'strength', region: 'lower', liftClass: 'squat', muscles: ['quads', 'glutes'], pairWith: ['nordic-curl', 'single-leg-rdl'], regression: 'Box squat' },
  { id: 'box-squat', name: 'Box squat', progressionModel: 'strength', region: 'lower', liftClass: 'squat', muscles: ['quads', 'glutes'], pairWith: ['nordic-curl', 'single-leg-rdl'], regression: 'Box squat to a higher box' },
  {
    id: 'split-squat-box',
    name: 'Split squat to a box',
    progressionModel: 'strength',
    region: 'lower',
    muscles: ['quads', 'glutes'],
    pairWith: ['single-leg-hamstring-bridge'],
    overrides: { loadIncrementKg: 2.5 },
    regression: 'Split squat with a taller box (shorter range)',
  },
  // Hinge
  { id: 'deadlift', name: 'Deadlift', progressionModel: 'strength', region: 'lower', liftClass: 'hinge', muscles: ['hamstrings', 'glutes', 'lowerBack'], pairWith: ['step-down'], regression: 'Trap-bar deadlift from blocks' },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', progressionModel: 'strength', region: 'lower', muscles: ['hamstrings', 'glutes', 'lowerBack'], pairWith: ['step-down'], regression: 'Kettlebell RDL' },
  { id: 'trap-bar-deadlift', name: 'Trap-bar deadlift', progressionModel: 'strength', region: 'lower', liftClass: 'hinge', muscles: ['quads', 'glutes', 'lowerBack'], pairWith: ['nordic-curl'], regression: 'Trap-bar deadlift from blocks' },
  { id: 'hip-thrust', name: 'Hip thrust', progressionModel: 'strength', region: 'lower', muscles: ['glutes'], pairWith: ['hanging-knee-raise'], regression: 'Glute bridge' },
  // Core
  { id: 'hanging-knee-raise', name: 'Hanging knee raise', progressionModel: 'repsEndurance', muscles: ['hipFlexors', 'abs'], pairWith: ['hip-thrust'], regression: 'Lying leg raise' },
  { id: 'ab-wheel', name: 'Ab wheel rollout', progressionModel: 'repsEndurance', muscles: ['abs'], pairWith: ['back-extension'], regression: 'Kneeling rollout, shorter range' },
  // Cardio
  { id: 'ride', name: 'Bike ride', progressionModel: 'cycling' },
  { id: 'run', name: 'Run', progressionModel: 'running' },
]

export const exercises: Exercise[] = [...mainExercises, ...kneeExercises, ...ratioTestExercises]

export const windows: TrainingWindow[] = [
  {
    id: 'strength',
    title: 'Strength',
    icon: '🏋️',
    enabled: true,
    bodyParts: [
      { id: 'pull', title: 'Pull', exerciseIds: ['pull-up', 'weighted-pull-up', 'barbell-row', 'ring-row', 'face-pull', 'band-pull-apart', 'scapular-pull-up'] },
      { id: 'push', title: 'Push', exerciseIds: ['bench-press', 'overhead-press', 'db-overhead-press', 'push-up'] },
      { id: 'legs', title: 'Legs', exerciseIds: ['back-squat', 'box-squat', 'split-squat-box'] },
      { id: 'hinge', title: 'Hinge', exerciseIds: ['deadlift', 'romanian-deadlift', 'single-leg-rdl', 'trap-bar-deadlift', 'hip-thrust'] },
      {
        id: 'knee',
        title: 'Knee & balance',
        exerciseIds: [
          'step-down', 'spanish-squat', 'terminal-knee-extension', 'reverse-nordic', 'nordic-curl',
          'single-leg-hamstring-bridge', 'lateral-band-walk', 'copenhagen-plank', 'single-leg-calf-raise',
          'tibialis-raise', 'single-leg-balance',
        ],
      },
      { id: 'core', title: 'Core', exerciseIds: ['hanging-knee-raise', 'ab-wheel', 'cable-crunch', 'back-extension'] },
      {
        id: 'ratio-tests',
        title: 'Ratio tests',
        exerciseIds: ['leg-extension', 'leg-curl', 'hip-abduction-machine', 'hip-adduction-machine', 'cable-external-rotation', 'cable-internal-rotation'],
      },
    ],
  },
  {
    // Optional: shown once a cycling goal exists (or set enabled: true).
    id: 'cycling',
    title: 'Cycling',
    icon: '🚴',
    enabled: false,
    bodyParts: [{ id: 'bike', title: 'Bike', exerciseIds: ['ride'] }],
  },
  {
    // Optional: shown once a running goal exists.
    id: 'running',
    title: 'Running',
    icon: '🏃',
    enabled: false,
    bodyParts: [{ id: 'run', title: 'Run', exerciseIds: ['run'] }],
  },
]

export const exercisesById: Record<string, Exercise> = Object.fromEntries(
  exercises.map((e) => [e.id, e]),
)
