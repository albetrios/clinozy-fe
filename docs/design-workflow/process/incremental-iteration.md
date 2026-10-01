# Incremental iteration

**Run for every iteration with a Baseline** — any `feat`, `change` or `fix`
after the first. Assumes [Adoption](adoption.md) and a Baseline that was built
([Initial iteration](initial-iteration.md), or an earlier incremental run).

The whole goal: **touch only what changed.** If you find yourself re-building a
screen the diff didn't touch, you've fallen back to the initial process.

## The iteration rule

The rules and commands are in [`iterations/README.md`](../../../iterations/README.md).
For this process:

- **Every intake holds the full drop** — every screen, the full PRD and the full
  `schema-routes.md` — never only the changed screens.
- **The Baseline is yours to confirm.** At planning Step 0 the suggestion is the
  latest `done` or `frozen` iteration in this repo; confirm it or pick another,
  and it is saved with `pnpm iteration:baseline <iteration> <baseline>`.
- **The delta has two signals:** the designer's "What changed" notes, and
  `pnpm iteration:diff <baseline> <iteration>`, which compares the two
  `intake-files/` folders and nothing else. The Baseline's `intake-files/` are
  mandatory — without them there is nothing to diff. Anything the diff shows
  that the notes omit is a **finding**.
- Planning can start while the Baseline is still being built; the **kickoff
  waits** until the Baseline is `done` or `frozen`.

---

## Prerequisites — have these before starting

| Prerequisite                                                                    | Source                  | Required?                                   |
| ------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------- |
| The Baseline iteration, with its `intake-files/` (and `done`/`frozen` to build) | an earlier run          | **Yes** — the other side of the diff        |
| The new **full** drop — the required set, as in the initial process             | Claude Design + Product | **Yes** — `iteration:intake` checks it      |
| "What changed" notes in the changed specs (and `Preset: unchanged` when so)     | Claude Design           | **Yes** — the designer's stated delta       |
| The existing clinozy-fe implementation of the Baseline                          | an earlier run          | **Yes** — there must be something to update |
| Visual-regression baselines from earlier iterations                             | an earlier run, step 6b | Recommended — catches ripple                |

The **preset never re-enters** unless the drop changes it — the diff says so.

---

## ==== STEP 1 — Open, place the drop, confirm the Baseline ====

```bash
pnpm iteration:new feat pharmacy-returns              # or change / fix; --both when clinozy-be changes too
pnpm iteration:intake <iteration> <drop-folder>       # the full drop; --both copies PRD.md + schema-routes.md
```

`iteration:new` writes the README with a **suggested** Baseline. Planning Step 0
confirms it with you (or saves another with `pnpm iteration:baseline`).

## ==== STEP 2 — Establish the delta from two signals ====

Say **"plan iteration <iteration>"**. Planning Step 2 reads **both**, because
they catch different things:

1. **The "What changed" notes** — what the designer _meant_ to change.
2. **The diff** — what actually changed between the two drops:

   ```bash
   pnpm iteration:diff <baseline> <iteration>          # summary, then the raw diff of the two intake-files/
   pnpm iteration:diff <baseline> <iteration> --json   # the summary, for the skill
   ```

   The summary names the files and screens added, removed or changed (screens by
   their `_index.md` Slug), whether the PRD, `schema-routes.md` or the
   prototype changed, and the entities, fields, enums, routes and operations
   added, removed or changed.

If the diff shows a change the notes don't mention, **that is a finding** —
surface it, don't silently build it. A changelog is someone's account of the
diff; the diff is the truth. (Same rule as prototype-outranks-spec, one level
up.) **The reconciled delta is the work list.**

## ==== STEP 3 — Classify every change before planning the build ====

| Change                                                  | Cost     | Blast radius                         | Gate                    |
| ------------------------------------------------------- | -------- | ------------------------------------ | ----------------------- |
| Token values                                            | Trivial  | **Every screen** — re-screenshot all | Contrast recheck        |
| Copy                                                    | Trivial  | Locale files only                    | —                       |
| Component styling                                       | Low      | Contained                            | —                       |
| **Structural** (popup shape, step sequence, table↔card) | **High** | Rebuild                              | **Full RED gate**       |
| **New screen / surface**                                | High     | New island + registrations           | **Full RED gate**       |
| **Preset change** (tokens/type/radius/motion)           | **High** | **Every screen + all presets**       | **Scoped section (3b)** |
| **Layout / shell change** (auth, public, app shell)     | **High** | **Every route the shell owns**       | **Scoped section (3b)** |

- **Structural / new-screen** rows get the full RED gate (planning Steps 3–4),
  scoped to those screens.
- **The token-change trap:** trivial to make, touches _every_ screen. This is
  exactly what step 6b's baselines exist to catch.

## ==== STEP 3b — Preset or layout changed? A scoped section first ====

A preset or layout change is not a screen edit — it re-tones or re-frames the
whole app. Planning writes a scoped section into `KICKOFF.md` and **stops**:

**If the PRESET changed:**

- Which tokens moved (old → new), light **and** dark.
- Recompute every contrast pair locally; brand colours failing AA keep their
  value only on non-text tokens.
- The four registration points (`index.css` block, `.theme-dot`, `THEME_PRESETS`,
  `theme-init.js`) — confirm all four.
- Blast radius: **every screen re-screenshots** (step 6b full baseline).

**If a LAYOUT / SHELL changed:**

- Which shell (auth / public / app) and which routes it owns — list them.
- Exact values to port (type, spacing, colour, bg, radius, shadow) — read from
  the prototype CSS, not memory.
- **Make it live** (Adoption → _Making a variant live_): set it as the default
  **and** pin it (`SHUFFLE_TEMP.<axis> = false`); confirm the default isn't
  overridden by a persisted value.
- Platform-surface check: relocate-never-delete — every surface still has a home.
- Blast radius: **every route the shell owns** re-verifies, not one.

## ==== STEP 4 — Approve, then kick off — apply only the delta ====

The plan's ledger holds only the delta, in route order: **global changes**
(tokens, preset, layout) → **copy** → **styling** → **structural** → **new
screens**, then verification. Approve it, then say **"kickoff iteration
<iteration>"** — the kickoff starts only once the Baseline is `done` or
`frozen`. Each structural or new-screen row follows the build order from
Adoption (interaction shell → skeleton → regions → content → states → motion),
scoped to its screen; nothing outside the ledger is touched.

## ==== STEP 5 — Record as you go ====

Every row gets its `AS-BUILT.md` entry. A row that changes rows still to come
records the revision; a scope change (a row added or removed, an Acceptance or
the order changed) **stops for you**, and the decision goes into
`plans/decisions.md`.

## ==== STEP 6 — Verify · Pin · Close ====

Same as the initial process's step 6, with one difference:

- **6a. Verify** the changed screens by comparison, at 375px and 1440px per
  state.
- **6b. Re-run the _full_ baseline set** — not just changed screens. The point is
  to catch ripple. Update baselines only where the change was intended; an
  unexpected diff is a finding, not a baseline to bless.
- **6c. Close:** every row `done` or `deferred` with your OK, the AS-BUILT
  summary, `pnpm iteration:status <iteration> done`; `frozen` in the last commit
  before the merge.

---

## Why this is cheaper than the initial process

|             | Initial             | Incremental                                      |
| ----------- | ------------------- | ------------------------------------------------ |
| Read        | Every spec, in full | The diff summary, then the changed files in full |
| Build       | Every screen        | Only changed screens                             |
| Verify      | Every screen        | Changed screens + full ripple check              |
| Cost driver | Screen count        | Change count                                     |

The initial process's cost scales with how big the design is. The incremental
process's scales with how much _changed_ — which for a later iteration is
usually small.

---

## Known gap

`pnpm iteration:diff` finds what changed mechanically — files, screens, PRD,
prototype, and the schema-routes entities, fields, enums, routes and operations
— but classifying each change (token / copy / styling / structural / new
screen) is still the planner's judgement in Step 3. A classifier over the diff's
JSON is the next improvement.
