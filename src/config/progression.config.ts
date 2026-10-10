// All science-derived numbers live here. These are well-supported defaults, not absolutes.
// Every value can be overridden per exercise via Exercise.overrides.

export const progressionConfig = {
  strength: {
    // Double progression: work in a rep range; when every set hits the top at target effort, add load.
    repRange: [5, 8] as [number, number],
    workingSets: 3,
    // Typical plate jumps: ~2.5 kg upper body, ~5 kg lower body.
    loadIncrementKg: { upper: 2.5, lower: 5 },
    // Most working sets at 1–3 RIR. Progress only if the top of the range was hit with ≥ minRir in reserve.
    targetRir: 2,
    minRirToProgress: 1,
    // Stall rule: no improvement for this many sessions → reduce load and build back.
    stallSessions: 3,
    stallLoadReduction: 0.1,
    // Planned deload every 4–8 weeks; 6 is a middle-ground default.
    deloadEveryWeeks: 6,
    // Deload: keep load, cut sets roughly in half (volume deload). One common approach among several.
    deloadSetFraction: 0.5,
    // Low average feeling (1–5) over recent sessions + a stall triggers an early deload.
    lowFeelingThreshold: 2.5,
    feelingWindowSessions: 3,
    // Starting working load ≈ 75% of estimated 1RM ≈ a ~10RM, i.e. 5–8 reps with 2–3 RIR.
    // Uncertain: individual rep-max curves vary a lot; adjust after the first sessions.
    startingLoadFractionOfE1rm: 0.75,
    // Projection rate for milestone dates. Conservative guess for an intermediate lifter;
    // real rates vary widely with training age, sleep and nutrition.
    conservativeGainKgPerWeek: { upper: 0.5, lower: 1 },
    // Largest load jump taken in one step, relative to the mass moved. Bigger jumps (e.g. a
    // 12 → 16 kg kettlebell = +33%) go through the ladder first. Practical heuristic, not a study value.
    maxRelativeLoadJump: 0.2,
    // Standard kettlebell sizes step in 4 kg (8, 12, 16, 20, 24…); used to round milestones.
    kettlebellStepKg: 4,
  },

  // When the next load is missing or too big a jump (fixed-weight home equipment), difficulty
  // rises one lever at a time: more sets → slower eccentric → pause → bigger range → next load.
  // Order follows common coaching practice for limited equipment; evidence comparing these
  // levers directly is thin.
  ladder: {
    maxSets: 4,
    techniques: ['tempo', 'pause', 'range'] as const,
  },

  timed: {
    // Holds and carries: add a few seconds per session at the same load, then move up the ladder.
    holdIncrementSec: 5,
    maxHoldSec: 60,
    startHoldSec: 20,
    sets: 3,
    // Conservative projection for duration goals on holds/carries.
    conservativeGainSecPerWeek: 5,
  },

  running: {
    // Nielsen et al. 2025 (BJSM, ~5,200 runners): injury risk rose when a single run was >10%
    // longer than the longest run of the previous 30 days; the authors suggest ~5% as a safer step.
    lookbackDays: 30,
    runIncrease: 0.05,
    maxSingleRunIncrease: 0.1,
    // Second weekly run is shorter than the long run.
    shortRunFraction: 0.8,
    defaultLongRunSec: 20 * 60,
    // Easy runs only: talk-test pace. No intervals until a speed goal exists.
    conservativeGainSecPerWeek: 60,
  },

  repsEndurance: {
    // One max-effort test every 3–4 weeks; the rest is submaximal work.
    maxTestEveryWeeks: 4,
    // Submax sets at ~50–80% of current max, ramping through the test cycle.
    submaxFractionStart: 0.5,
    submaxFractionStep: 0.1,
    submaxFractionMax: 0.8,
    submaxSets: 5,
    // Weighted strength work in low rep ranges.
    weightedRepRange: [3, 5] as [number, number],
    weightedSets: 4,
    // Conservative projection: ~0.5 extra max reps per week. Uncertain; depends heavily on bodyweight and history.
    conservativeGainRepsPerWeek: 0.5,
  },

  cycling: {
    // Polarized distribution: ~80% of time easy (Z1–Z2 / RPE 3–4), ~20% hard (RPE 7–8).
    easyShare: 0.8,
    // "10% per week" is a conservative heuristic, used as a cap rather than a target.
    maxWeeklyVolumeIncrease: 0.1,
    // Every 4th week reduce volume to absorb training.
    recoveryEveryWeeks: 4,
    recoveryVolumeFraction: 0.7,
    defaultWeeklyMinutes: 120,
    defaultLongRideM: 20000,
    // Weeks of history averaged to set the current weekly volume.
    volumeLookbackWeeks: 3,
    // Conservative projection for the longest ride: +2 km per week. Uncertain heuristic.
    conservativeGainMetresPerWeek: 2000,
  },

  // Expected progress per exercise ("priors"), used for goal suggestions and milestone dates.
  naturalProgress: {
    // Strength relative to bodyweight (e1RM ÷ bodyweight) at which a male lifter counts as
    // intermediate / advanced, used ONLY to pick the training level. Community tables
    // (StrengthLevel, StrengthLog…) built from user-logged lifts; they disagree by ~0.25× bodyweight.
    standards: {
      squat: { intermediate: 1.5, advanced: 2.0 },
      hinge: { intermediate: 2.0, advanced: 2.5 },
      horizontalPush: { intermediate: 1.0, advanced: 1.5 },
      verticalPush: { intermediate: 0.65, advanced: 1.0 },
    },
    // e1RM gain per year for an intermediate, per lift. Squat, deadlift and bench: Latella et al.
    // 2022 (Med Sci Sports Exerc), 1,896 powerlifters' competition records 2003–2018: squat
    // ~20–25, deadlift ~18–21, bench ~10.5–13 kg/year (midpoints used). Overhead press: no data
    // found; EXTRAPOLATED as about half of bench.
    liftKgPerYear: { squat: 22, hinge: 20, horizontalPush: 11.5, verticalPush: 6 },
    // Untrained lifters gain faster and the strongest gain least (direction supported by
    // meta-analyses and by Latella's top quartile); the exact factors are HEURISTICS.
    levelMultiplier: { novice: 2, intermediate: 1, advanced: 0.5 },
    // Level assumed when bodyweight or lift class is unknown: the middle one.
    defaultLevel: 'intermediate',
    weeksPerYear: 52.18,
    // Goal suggestions aim this many weeks ahead (about one training block).
    horizonWeeks: 12,
    // Milestone dates use the prior slowed by this factor, so dates are reachable.
    projectionConservatism: 0.8,
  },

  // Learning each person's own pace from their logs.
  personalPace: {
    // Only recent sessions describe current pace.
    lookbackWeeks: 8,
    // A trend needs enough data: at least this many sessions spread over at least this many weeks.
    minPoints: 4,
    minWeeks: 3,
    // How many sessions' worth of trust the research prior gets when blending with your own data.
    priorWeight: 6,
    // "Faster than expected" = observed pace ≥ this × the prior, AND the goal would be reached
    // at least `aheadWeeks` before its date.
    fastFactor: 1.5,
    aheadWeeks: 2,
    // A raised goal (and dates planned from your pace) never assumes more than this × the prior
    // pace, which protects against noisy logs while still letting fast beginners aim higher.
    maxRaiseFactor: 3,
  },

  milestones: {
    // Share of the baseline→goal gap for each milestone.
    fractions: [0.25, 0.5, 0.75, 0.9, 1],
    // Re-plan when actual progress is this many weeks ahead or behind the projection.
    replanThresholdWeeks: 2,
  },

  painFlag: {
    // A pain flag pauses progression for the window until a pain-free session is logged.
    // Suggested regression load as a share of the last working load.
    regressionLoadFraction: 0.8,
  },

  checkIn: {
    // "Too hard" → repeat the week at a lighter load.
    tooHardLoadFraction: 0.9,
  },
} as const

export type ProgressionConfig = typeof progressionConfig

export const gamificationConfig = {
  xp: {
    completedSession: 50,
    // Rewarding process: logging RIR on every set, tests and deloads earn extra.
    rirLogged: 10,
    testSession: 30,
    deloadSession: 20,
    checkIn: 10,
    // Capped per day so doing more is never rewarded beyond the plan.
    dailyCap: 100,
  },
  levels: {
    // XP needed for level n → n+1 = base × n^growth.
    baseXp: 150,
    growth: 1.3,
  },
  streak: {
    freezesPerMonth: 1,
  },
} as const

export type GamificationConfig = typeof gamificationConfig
