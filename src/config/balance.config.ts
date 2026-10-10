import type { MuscleGroup } from '../domain/models'

// Opposite-muscle ("antagonist") balance. Two kinds of check per pair:
// - strength: measured ratio between two test exercises (machines/cables), compared with the
//   ratio the research associates with fewer injuries. Lab studies use isokinetic machines, so a
//   gym ratio is only a rough guide.
// - volume: weekly hard sets for each side. Volume targets are PRACTICE HEURISTICS (no study gives
//   injury-proof set ratios); they keep the opposite muscle from being neglected.

export type EvidenceLevel = 'strong' | 'moderate' | 'weak' | 'practice'

export interface BalancePair {
  id: string
  title: string
  /** Numerator side (the one that tends to be neglected). */
  a: { label: string; muscles: MuscleGroup[]; fixes: string[] }
  /** Denominator side. */
  b: { label: string; muscles: MuscleGroup[]; fixes: string[] }
  /** Strength ratio a ÷ b from test exercises. */
  strength?: { min: number; max?: number; testA: string; testB: string }
  /** Weekly hard sets a ÷ b. With `atLeast`, only too-low counts as imbalance. */
  volume?: { aim: number; tolerance: number; atLeast?: boolean }
  info: { aim: string; why: string; evidence: EvidenceLevel; evidenceNote: string; source?: string }
}

export const balancePairs: BalancePair[] = [
  {
    id: 'hamstrings-quads',
    title: 'Hamstrings : quads',
    a: { label: 'Hamstrings', muscles: ['hamstrings'], fixes: ['nordic-curl', 'single-leg-rdl', 'single-leg-hamstring-bridge'] },
    b: { label: 'Quads', muscles: ['quads'], fixes: ['step-down', 'split-squat-box', 'spanish-squat'] },
    strength: { min: 0.6, testA: 'leg-curl', testB: 'leg-extension' },
    volume: { aim: 1, tolerance: 0.35 },
    info: {
      aim: 'Hamstrings at least 60% as strong as quads; train them about as often.',
      why: 'Hamstrings hold the shin back when you land, cut or decelerate, protecting the ACL and themselves from strains. Squat-heavy training builds quads much faster.',
      evidence: 'weak',
      evidenceNote: 'The 0.6 cutoff is widely used, but prospective studies disagree on how well it predicts injury.',
      source: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10140913/',
    },
  },
  {
    id: 'adductors-abductors',
    title: 'Inner : outer hip',
    a: { label: 'Adductors (inner thigh)', muscles: ['hipAdductors'], fixes: ['copenhagen-plank', 'hip-adduction-machine'] },
    b: { label: 'Abductors (outer hip)', muscles: ['hipAbductors'], fixes: ['lateral-band-walk', 'hip-abduction-machine'] },
    strength: { min: 0.8, testA: 'hip-adduction-machine', testB: 'hip-abduction-machine' },
    volume: { aim: 1, tolerance: 0.5 },
    info: {
      aim: 'Adductors at least 80% as strong as abductors.',
      why: 'Abductors keep the knee from caving in (key for knee pain); adductors protect the groin. In NHL players, adductors below 80% of abductors meant 17× more groin strains.',
      evidence: 'moderate',
      evidenceNote: 'One strong study (Tyler 2001); later studies replicated it only partly.',
      source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4223288',
    },
  },
  {
    id: 'shoulder-rotation',
    title: 'Shoulder rotation (out : in)',
    a: { label: 'External rotators', muscles: ['externalRotators', 'rearDelts'], fixes: ['face-pull', 'cable-external-rotation', 'band-pull-apart'] },
    b: { label: 'Pressing / internal rotators', muscles: ['chest', 'frontDelts', 'internalRotators'], fixes: ['bench-press'] },
    strength: { min: 0.66, max: 0.85, testA: 'cable-external-rotation', testB: 'cable-internal-rotation' },
    volume: { aim: 0.5, tolerance: 0.4, atLeast: true },
    info: {
      aim: 'External rotation about 66–75% of internal rotation.',
      why: 'Bench and overhead presses build the internal rotators; weak external rotators let the shoulder drift forward. Below ~0.68 meant 4.5× more shoulder injuries in swimmers; similar findings in handball.',
      evidence: 'moderate',
      evidenceNote: 'Small prospective studies, different test methods.',
      source: 'https://johk.pl/?p=5735',
    },
  },
  {
    id: 'pull-push',
    title: 'Pull : push',
    a: { label: 'Pulling (back)', muscles: ['back', 'rearDelts'], fixes: ['barbell-row', 'pull-up', 'face-pull'] },
    b: { label: 'Pushing (chest, front shoulder)', muscles: ['chest', 'frontDelts'], fixes: ['bench-press', 'push-up'] },
    volume: { aim: 1, tolerance: 0.2, atLeast: true },
    info: {
      aim: 'At least as many pulling sets as pushing sets.',
      why: 'Lots of pressing without matching rows pulls the shoulders forward. More pulling also protects the shoulder for climbing and surfing.',
      evidence: 'practice',
      evidenceNote: 'Coaching practice; no study gives an injury-proof set ratio.',
    },
  },
  {
    id: 'back-abs',
    title: 'Lower back : abs',
    a: { label: 'Lower back', muscles: ['lowerBack'], fixes: ['back-extension', 'romanian-deadlift'] },
    b: { label: 'Abs', muscles: ['abs'], fixes: ['ab-wheel', 'cable-crunch'] },
    strength: { min: 1.0, max: 1.4, testA: 'back-extension', testB: 'cable-crunch' },
    volume: { aim: 1, tolerance: 0.6 },
    info: {
      aim: 'Back extensors about as strong as, or a bit stronger than (×1.0–1.3), the abs.',
      why: 'In healthy adults the back extensors are usually the stronger side; relatively weak extensors are linked to low-back pain.',
      evidence: 'weak',
      evidenceNote: 'No agreed norm; values depend a lot on the test.',
      source: 'https://journalofsportsmedicine.org/full-text/735/eng',
    },
  },
  {
    id: 'shins-calves',
    title: 'Shins : calves',
    a: { label: 'Shins (tibialis)', muscles: ['tibialis'], fixes: ['tibialis-raise'] },
    b: { label: 'Calves', muscles: ['calves'], fixes: ['single-leg-calf-raise'] },
    volume: { aim: 0.5, tolerance: 0.4, atLeast: true },
    info: {
      aim: 'Some shin work: roughly one set for every two calf sets.',
      why: 'Calves take most of the running and landing load; the tibialis controls the foot and ankle on the way down.',
      evidence: 'practice',
      evidenceNote: 'No injury-ratio data; common in knee/shin rehab.',
    },
  },
  {
    id: 'left-right',
    title: 'Left : right leg',
    a: { label: 'Weaker leg', muscles: [], fixes: ['step-down', 'single-leg-rdl', 'single-leg-balance'] },
    b: { label: 'Stronger leg', muscles: [], fixes: [] },
    info: {
      aim: 'Weaker leg within 10% of the stronger one (≥ 90%).',
      why: 'Asymmetry over ~15% is linked to more injuries; 90% is the usual bar for returning to sport after a knee injury. Check it on single-leg exercises (same weight, compare reps) and start sets with the weaker leg.',
      evidence: 'moderate',
      evidenceNote: 'A convention from knee rehab; symmetry alone does not guarantee safety.',
      source: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9808831/',
    },
  },
]

export const balanceConfig = {
  // Training volume is judged over the last 4 weeks.
  volumeWeeks: 4,
  // Strength tests older than this are considered outdated.
  strengthWeeks: 8,
  // Below this many sets per week for a pair, there's not enough data to judge.
  minSetsPerWeek: 1,
}
