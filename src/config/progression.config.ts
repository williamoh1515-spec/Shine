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
