# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Personal Gamified Training App

## Status
v0.2 (Stage 1 of the "customizable app + profile links" plan). Windows/exercises are editable in the app (catalog in Dexie v2, merged over built-ins), equipment-aware progression (kettlebells, added load, pair loads) with a difficulty ladder (sets → tempo → pause → range → next load), timed holds/carries, easy-run model (single-run cap vs. longest of last 30 days), goal metrics `workingLoadKg` and `maxDurationSec`, and profile links (`#/join?p=…`) that set up another person's app. Demo data (`src/data/demo.ts`, flagged `demo: true`) can be loaded/cleared. Deployed via GitHub Pages (`.github/workflows/deploy.yml`).
Goals adapt: expected pace per lift comes from research priors (`naturalProgress.liftKgPerYear`: Latella et al. 2022 for squat/deadlift/bench; overhead press extrapolated; level multipliers heuristic). Once ≥4 sessions over ≥3 weeks exist, the logged trend is blended in (`personalPace`). Faster than 1.5× expected → a one-tap "Raise goal" suggestion (never automatic; "Not now" until the next session). Goals can be changed any time ("Change goal" → new `manual` milestone plan; old plans kept; earned milestones still count). When a goal is reached, a next goal ~12 weeks ahead is suggested; accepting marks the old goal `completedOn`.
Stage 2 (not built yet): workout templates (A/B sessions), activity log for climbing/surfing/skiing/yoga, readiness rules after sports, cross-domain "one progression lever per week" rule, habit XP.
Profiles for other people live in git-ignored `profiles/*.json` (same format as a profile link) and are turned into links via Settings → Share a profile → From a profile file.

Node is installed per-user via winget; in a fresh shell, reload PATH first if `node` isn't found.

## What this project is
A single-user, local-first training app that turns my training into a game.
Each **window** (tab) is one training area — e.g. Push, Pull, Legs, Hinge, Core, Running, Cycling.
Each window shows: current level, a **timeline**, **milestones** toward a **final objective**, and **achievements**.
Progression rules are based on established training science and live in config, never hard-coded in UI.

Audience: just me. Optimise for clarity, correctness of progression logic, and fun — not for scale.

## Tech stack (default — change here if we decide otherwise)
- TypeScript (strict mode), React, Vite
- Local storage: IndexedDB via Dexie (no backend, no accounts)
- Installable PWA so it works on my phone at the gym, offline
- Charts: Recharts
- Tests: Vitest (+ React Testing Library for components); `fake-indexeddb` for Dexie tests
- Lint/format: oxlint (the current Vite template's linter, instead of ESLint) + Prettier
- PWA: vite-plugin-pwa. No router library: hash routes (`#/`, `#/w/<window>/<exercise>`, `#/settings`) in `App.tsx`

## Commands
```bash
npm install          # setup
npm run dev          # local dev server
npm run test         # unit tests (must pass before any task is "done")
npm run lint         # oxlint + tsc -b (typecheck)
npm run build        # production build; BASE_PATH=/repo/ for sub-path hosting (GitHub Pages)
npx vitest run src/domain/progression/strength.test.ts   # single test file
npx vitest run -t "stall"                                # tests matching a name
```
Tests are co-located as `*.test.ts` next to sources.

## Architecture
Three layers. Dependencies point inward only: `ui → data → domain`.

```
src/
  domain/            # PURE TypeScript. No React, no Dexie, no Date.now() inside logic.
    models.ts        # types: TrainingWindow, Exercise, SetLog, Session, Goal, Milestone, CheckIn, Achievement
    progression/     # strength.ts (+ ladder.ts), endurance-reps.ts, timed.ts, running.ts, cycling.ts
    milestones.ts    # builds milestones from baseline + goal; re-plans when progress diverges
    goals.ts         # goal creation, projection rate per metric, maybeReplan
    metrics.ts       # per-session goal value (e1RM / best set / distance), current value, progress
    program.ts       # composes this week's program for a goal (picks the progression model)
    checkIn.ts       # check-ins + pain flags → ProgressionModifier consumed by progression models
    catalog.ts       # merges built-in windows/exercises with stored ones (overrides by id, hidden flags)
    loads.ts         # loads available from equipment (kettlebells, pairs, added load, plates)
    priors.ts        # expected pace per exercise ("prior"): per-lift research numbers × training level
    personalPace.ts  # your own trend from logs, blended with the prior; "faster than expected" raise
    naturalPace.ts   # goal suggestions one training block ahead (prior + personal pace)
    profileLink.ts   # encode/decode/validate profile links (untrusted input: narrowed + bounded)
    gamification.ts  # XP, levels, streaks, PRs, achievement checks
    oneRepMax.ts     # e1RM estimators
    dates.ts         # pure ISO-date helpers (UTC math)
  config/
    progression.config.ts   # all science-derived numbers (increments, rep ranges, deload rules)
    windows.config.ts       # which windows exist, which exercises belong to each
    achievements.config.ts  # achievement definitions (data, not code)
    profile.seed.ts         # types + loader for the optional git-ignored profile.local.ts (my baselines/goals)
  data/
    db.ts            # Dexie schema + versioned migrations
    repositories/    # read/write functions; the only place that touches the DB
    seed.ts          # first-launch goals from profile.local.ts, if present (once per device)
    demo.ts          # fake demo data, flagged demo: true
  ui/
    windows/         # WindowView + ExercisePanel: ONE generic screen driven by windows.config.ts
    components/      # MilestoneTimeline, ProgressRing, ProgramCard, SetLogger, ProgressCharts, CheckInSheet, GoalEditor, Celebrations...
    hooks/           # useLiveQuery (Dexie liveQuery), useAppState, useToday (the only clock read)
    state/derive.ts  # all domain calls for the screens: data → AppState (XP, streak, programs, achievements)
    format.ts        # display formatting + user-facing text for domain codes
  App.tsx
```

Data flow: repositories → `useAppState` (live queries) → `deriveAppState` (pure, calls domain) → screens. UI code gets exercises/windows from `state.catalog`, never from `windows.config.ts` directly; edits start from `catalog.windowsForEditing` (unfiltered) so hidden exercises are never dropped. Writes go through repositories; `addSession` / `addCheckIn` also run `maybeReplan` for the window's goals. Celebrations diff successive AppStates (bulk changes such as a demo load are ignored).

Rules:
- `domain/` functions take inputs and return outputs. Pass `today` in as a parameter so everything is testable.
- No magic numbers in logic. Every threshold comes from `config/`, with a comment explaining the source principle.
- Adding a new window or exercise should require editing config only, not core logic.

## Domain model (keep these names consistent)
- **Window**: a training area (`pull`, `push`, `legs`, `hinge`, `core`, `running`, `cycling`, or user-created `custom-*`).
- **Exercise**: belongs to one or more windows; has a `progressionModel`: `strength` | `repsEndurance` | `running` | `cycling` | `custom`.
- **SetLog**: `{ exerciseId, reps?, loadKg?, durationSec?, distanceM?, rir?, notes? }`.
- **Session**: a dated list of SetLogs plus optional `painFlag` and `feeling (1–5)`.
- **Goal**: the final objective of a window, e.g. `25 unbroken pull-ups`, `squat 1.5× bodyweight`, `10 km under X min`.
- **Milestone**: an intermediate checkpoint between baseline and goal, with a target date.
- **Achievement**: a badge unlocked by a rule (first PR, 4-week consistency, milestone hit...).

Units: store kg, metres, seconds. Format for display only in the UI layer. Dates as ISO strings (`YYYY-MM-DD`).

## Progression science (encode as configurable rules)
These are well-supported defaults, not absolutes. Keep them editable in `progression.config.ts`.

**Strength (squat, deadlift, bench, rows, presses…)**
- Progressive overload via **double progression**: work in a rep range (e.g. 5–8); when all sets hit the top of the range at the target effort, increase load.
- Default load jumps: ~2.5 kg upper body, ~5 kg lower body (or ~2–5% of working weight, whichever is smaller for advanced lifts).
- Autoregulate with **RIR** (reps in reserve): most working sets at 1–3 RIR; avoid logging failure as the default.
- Estimate 1RM with Epley/Brzycki only from sets of ≤10 reps; label it "estimated".
- Weekly volume guideline: ~10–20 hard sets per muscle group, each muscle trained ~2×/week.
- **Stall rule**: if load/reps don't improve for 2–3 sessions → reduce load ~10% and build back, or swap variation.
- **Deload**: planned every 4–8 weeks, or triggered by stalls + low `feeling` scores. Deload weeks never break streaks.

**Reps-for-endurance goals (e.g. max pull-ups)**
- Mix: one max-effort test every 3–4 weeks, otherwise submaximal volume (sets at ~50–80% of current max), density work (same reps in less time), and weighted strength work in low rep ranges.
- Track total weekly reps and best single set separately.

**Running**
- Mostly easy volume: ~80% of training time at easy/conversational intensity, ~20% harder (intervals/tempo).
- Increase weekly volume gradually; the "10% per week" rule is a conservative heuristic, not hard science — use it as a cap.
- Milestones on distance, time-at-pace, or race time.

**Cycling**
- Zones based on FTP or heart rate if available, otherwise RPE.
- Same polarized-style distribution as running by default.

**Safety rules (non-negotiable in logic)**
- A `painFlag` on a session pauses progression suggestions for that window and suggests a regression; it never costs XP or streak.
- The app never suggests increasing load and volume in the same week for the same exercise.
- Legs window defaults to knee-friendly variations (e.g. box squat, split squat to a box, hip-dominant hinges) with depth/ROM progressions before load progressions.

## Milestones & timeline
- Inputs: baseline (from a test), goal, sessions per week, progression model.
- Generate 4–6 milestones (e.g. 25%, 50%, 75%, 90%, 100% of the gap) with projected dates using a **conservative** rate.
- Re-plan automatically when actual progress is ≥2 weeks ahead or behind the projection; keep history of old plans.
- Every new baseline must come from a logged test session, not from manual edits — but manual override is allowed and marked as such.

## Gamification rules
- Reward **consistency and good process**, not just PRs: XP for completed planned sessions, logged RIR, rest days, deloads, tests.
- XP is capped per day. Doing more than the plan earns no extra XP (no incentive to overtrain).
- Streaks are weekly (hit X of planned sessions this week), not daily, with one freeze per month.
- Levels per window plus a global level.
- Celebrations: milestone hit → full-screen moment with the stat that improved; achievement → toast; PR → small confetti. Keep animations short and skippable.
- Achievement definitions live in `achievements.config.ts` as data (`id, title, description, icon, rule`).

## Customization
- I can add/remove windows, exercises, goals, and achievements from the UI.
- Every config value (increments, rep ranges, deload interval) can be overridden per exercise.
- Export / import all data as JSON (manual backup). Never lose data on schema changes.

## My profile
Personal baselines and goals are kept out of the public repo: see `CLAUDE.local.md` (git-ignored, loaded automatically) and `src/config/profile.local.ts` (git-ignored; `profile.seed.ts` loads it if present and otherwise the app starts empty). Never commit personal values to tracked files, and never invent baselines or final objectives: leave them as `TODO` in `profile.local.ts`.

## Coding conventions
- TypeScript `strict: true`; no `any` (use `unknown` + narrowing).
- Small, pure functions; files under ~300 lines; components focused on display.
- Name things in English, in the domain vocabulary above.
- Every function in `domain/` gets unit tests, including edge cases: zero baseline, goal already reached, stall, deload, pain flag, missing RIR.
- Dexie schema changes always go through a new `version()` with a migration, plus a test.
- Accessibility: keyboard navigable, sufficient contrast, large tap targets for gym use (min 44px).
- Commits: small, conventional (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

## How Claude should work in this repo
- For anything bigger than a small fix: propose a short plan first, then implement.
- Run `npm run test` and `npm run lint` before saying a task is done; report failures honestly.
- Don't add dependencies without asking.
- Don't change numbers in `progression.config.ts` without stating the reasoning.
- If a training-science assumption is uncertain, say so in a code comment rather than presenting it as fact.
- Keep this file up to date when architecture or decisions change.
