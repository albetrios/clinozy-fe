# Incremental iteration

**Run for every iteration after the launch** — a `feat`, `change` or `fix`.
Assumes [Adoption](adoption.md) and a launch that was built and frozen
([Initial iteration](initial-iteration.md) step 5c).

The whole goal: **touch only what changed.** If you find yourself re-reading a
screen the change doesn't alter, you've fallen back to the initial process.

## The iteration rule

The rules are in [`iterations/README.md`](../../../iterations/README.md). For
this process:

- An incremental iteration is **one person, one branch, changes only**:
  `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/`, opened with
  `pnpm iteration:new <feat|change|fix> <topic>`.
- It holds a feature PRD, a `schema-routes.md` with SCOPE limited to the
  changed screens, the changed screens' specs and its own `KICKOFF.md`. **The
  folder is the delta** — two snapshots are never diffed.
- Its `README.md` names its Baseline: the latest iteration on `main` when it was
  opened. The current state it changes is the launch plus every merged
  iteration, in merge order.
- Parallel iterations on other branches are fine. Before merging, if newer
  iterations reached `main`, update the Baseline and check for overlap (step
  5c).
- Merged means frozen. Never edit a merged iteration; a correction is a new
  `fix` iteration.
- The folder exists only in the repo(s) the change touches — the same name in
  clinozy-fe and clinozy-be when it touches both.

---

## Prerequisites — have these before starting

| Prerequisite                                                                           | Source                                                                                      | Required?                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| The launch, built and merged — plus any iterations merged since                        | earlier runs                                                                                | **Yes** — the current state the change applies to    |
| The iteration folder, opened with `pnpm iteration:new` (its README names the Baseline) | you                                                                                         | **Yes**                                              |
| A feature `PRD.md` — only what changes                                                 | Product                                                                                     | **Yes** — what changes and why                       |
| `schema-routes.md` with SCOPE = the changed screens                                    | Claude Design — [`schema-routes-prompt.md`](../prompts/schema-routes-prompt.md)             | **Yes** — the entities and routes the change touches |
| Specs for the changed screens, each opening with "What changed"                        | Claude Design — [`extract-screens-prompt.md`](../prompts/extract-screens-prompt.md), scoped | **Yes** — what the changed screens become            |
| A prototype of the changed screens (`*.html` / `*.js`)                                 | Claude Design                                                                               | If one is used — it outranks the md                  |
| Visual-regression baselines from earlier iterations                                    | an earlier run, step 5b                                                                     | Recommended — catches ripple                         |

The **preset never re-enters** here — it's a once-ever file (initial process,
Step 2). An incremental run touches it only if the change explicitly moves
tokens; then a `preset.md` with the new values is part of the folder.

Quick check:

```bash
pnpm iteration:list                                                                         # Type, Baseline, Status
git log main --reverse --diff-filter=A --name-only --format= -- 'iterations/*/README.md'   # merged iterations, in merge order
```

---

## Precondition — is this incremental?

Read the iteration's `README.md`. Type `launch` → not this process; run the
[initial process](initial-iteration.md). Any other type must name a Baseline —
`pnpm iteration:new` refuses to open one before a launch exists. A non-launch
iteration with Baseline `none` is a mistake: **stop** and fix the README first.

## The "start button"

**Paste [`kickoff-prompt.md`](../prompts/kickoff-prompt.md) to Claude Code** with:

```text
MODE: incremental
ITERATION: feat-pharmacy-returns-2026-10-06-kqzx
Build: just the delta
```

That drives the steps below — it reads the iteration folder, finds the current
state of the screens it changes, and classifies the changes. The steps here are
what it does; you don't run them by hand.

---

## ==== STEP 1 — Open the iteration and get the change from Claude Design ====

Open the iteration on its own branch:

```bash
pnpm iteration:new feat pharmacy-returns          # or change / fix; --both when clinozy-be changes too
```

It writes the folder with its `README.md` (Owner, Opened, Branch, Baseline,
Status `planning`), a feature-PRD skeleton and a `schema-routes.md`
placeholder. Write the PRD — only what changes — then ask Claude Design for the
**changed screens only**: their specs (and a prototype, if one helps), each
opening with a **"What changed"** section that notes `Preset: unchanged` when it
is. Generate `schema-routes.md` with SCOPE = the changed screens; when the
change touches the backend, copy it byte-for-byte into the same-named
clinozy-be iteration.

```text
iterations/
├── launch-2026-09-30-jxmr/                    ← frozen — the full launch snapshot
│   ├── PRD.md · schema-routes.md · <screen>.md …
│   └── Clinozy ….html · support.js
└── feat-pharmacy-returns-2026-10-06-kqzx/     ← NEW — only the change
    ├── README.md            ← Baseline: launch-2026-09-30-jxmr
    ├── PRD.md               ← the feature PRD
    ├── schema-routes.md     ← SCOPE = the changed screens
    ├── medical.md           ← a changed screen, opening with "What changed"
    └── KICKOFF.md           ← the delta plan (fe-kickoff-planning)
```

## ==== STEP 2 — Establish the delta from two signals ====

The kickoff reads **both**, because they catch different things:

1. **The feature PRD and the "What changed" sections** — what the change is
   _meant_ to do.
2. **Each changed screen's new spec against its current one** — the latest spec
   for that screen among the launch and the merged iterations, plus its current
   code — for what actually moves, including anything the PRD forgot.

If a changed spec moves something the PRD doesn't state, **that is a finding** —
surface it, don't silently build it. A PRD is someone's account of the change;
the specs are the truth. (Same rule as prototype-outranks-spec, one level up.)

**The reconciled delta is the work list.** Nothing outside it gets re-read.

## ==== STEP 3 — Classify every change before touching code ====

| Change                                                  | Cost     | Blast radius                         | Gate                 |
| ------------------------------------------------------- | -------- | ------------------------------------ | -------------------- |
| Token values                                            | Trivial  | **Every screen** — re-screenshot all | Contrast recheck     |
| Copy                                                    | Trivial  | Locale files only                    | —                    |
| Component styling                                       | Low      | Contained                            | —                    |
| **Structural** (popup shape, step sequence, table↔card) | **High** | Rebuild                              | **Full RED gate**    |
| **New screen / surface**                                | High     | New island + registrations           | **Full RED gate**    |
| **Preset change** (tokens/type/radius/motion)           | **High** | **Every screen + all presets**       | **Sub-kickoff (3b)** |
| **Layout / shell change** (auth, public, app shell)     | **High** | **Every route the shell owns**       | **Sub-kickoff (3b)** |

- **First three rows batch safely** — apply directly.
- **Structural / new-screen** run the full `fe-design-ditto` gate as if new
  (the initial process, steps 3–4, scoped to those screens).
- **Preset / layout change** are cross-cutting — they don't touch one screen,
  they re-tone or re-frame all of them. Route them through **Step 3b**.

**The token-change trap:** trivial to make, touches _every_ screen. This is
exactly what step 5b's baselines exist to catch — a value tweak that silently
shifts a screen you weren't editing.

## ==== STEP 3b — Preset or layout changed? Spin a scoped kickoff ====

A preset or layout change is not a screen edit — it re-tones or re-frames the
whole app. Treat it like a mini-build with its own plan, the same way an initial
build does. **Before touching code, write a short scoped kickoff** (in the
iteration's `iterations/<iteration>/KICKOFF.md`) covering just this change:

**If the PRESET changed:**

- Which tokens moved (old → new), light **and** dark.
- Recompute every contrast pair locally; brand colours failing AA keep their
  value only on non-text tokens.
- The four registration points (`index.css` block, `.theme-dot`, `THEME_PRESETS`,
  `theme-init.js`) — confirm all four.
- Blast radius: **every screen re-screenshots** (step 5b full baseline).

**If a LAYOUT / SHELL changed:**

- Which shell (auth / public / app) and which routes it owns — list them.
- Exact values to port (type, spacing, colour, bg, radius, shadow) — read from
  the prototype CSS, not memory.
- **Make it live** (Adoption → _Making a variant live_): set it as the default
  **and** pin it (`SHUFFLE_TEMP.<axis> = false`); confirm the default isn't
  overridden by a persisted value.
- Platform-surface check: relocate-never-delete — every surface still has a home.
- Blast radius: **every route the shell owns** re-verifies, not one.

Show me the scoped kickoff and **stop** before building. This is the step whose
absence once caused "the new layout isn't the default" and "you didn't take the
exact design values" — it forces both to the front.

## ==== STEP 4 — Apply only the delta ====

Work the classified list. **Do not re-read screens the change doesn't touch** —
that re-reading is the cost the incremental process exists to avoid.

For structural or new-screen rows, the build order from Adoption still applies
(interaction shell → skeleton → regions → content → states → motion), just
scoped to the changed screen.

## ==== STEP 5 — Verify · Pin · Freeze ====

Same as the initial process's step 5, with two differences:

- **5a. Verify** the changed screens by comparison, and **close the delta
  ledger** — every row `done` or `deferred` with recorded OK (Adoption → _The
  delta ledger_). An open row = not done; keep going, don't report success.
- **5b. Re-run the _full_ baseline set** — not just changed screens. The point is
  to catch ripple. Update baselines only where the change was intended; an
  unexpected diff is a finding, not a baseline to bless.
- **5c. Check the Baseline, then freeze.** If other iterations merged to `main`
  after this one's Baseline, set Baseline to the newest of them and check for
  overlap — the same screen, entity or route changed by both — and resolve it
  in review. Then, in the last commit before the merge, set `Status: frozen` in
  the iteration's `README.md`:

```bash
git log main --reverse --diff-filter=A --name-only --format= -- 'iterations/*/README.md'   # merged since the Baseline?
git add iterations/<iteration>/ && git commit -m "chore: freeze <iteration> (as built)"
```

After the merge the folder is never edited. The next change is a new iteration
whose Baseline is the latest one on `main`. The loop sustains itself.

---

## Why this is cheaper than the initial process

|             | Initial             | Incremental                                       |
| ----------- | ------------------- | ------------------------------------------------- |
| Read        | Every spec, in full | The iteration folder + the changed screens' state |
| Build       | Every screen        | Only changed screens                              |
| Verify      | Every screen        | Changed screens + full ripple check               |
| Cost driver | Screen count        | Change count                                      |

The initial process's cost scales with how big the design is. The incremental
process's scales with how much _changed_ — which for a later iteration is
usually small.

---

## Known gap

`fe-design-ditto` has **no delta mode** — the build side of the incremental
process is a documented procedure, not an automated one (`fe-kickoff-planning`
plans the delta in its Step 4-inc). The highest-leverage improvement is a Step 0
in the build skill that reads the iteration folder, classifies each change
against the Step 3 table, and runs the full gate only on structural changes.
Until then, the classification is yours to make.
