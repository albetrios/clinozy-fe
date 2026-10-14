# Incremental iteration

**Run for every iteration with a Baseline** — any `feat`, `change` or `fix`
after the first. Assumes [Adoption](adoption.md) and a Baseline that was built
([Initial iteration](initial-iteration.md), or an earlier incremental run).

The whole goal: **touch only what changed.** If you find yourself re-building a
screen the diff didn't touch, you've fallen back to the initial process.

## The iteration rule

The rules and commands are in [`iterations/README.md`](../../../iterations/README.md).
For this process:

- **Every intake resolves to a full snapshot** — every screen, the full PRD and
  the full `schema-routes.md` — however little arrived. `intake-files/` stores
  only what arrived; the Intake mode says how the snapshot is resolved:

  | Mode      | What arrived                                                                | `intake-files/` stores | The snapshot                                    |
  | --------- | --------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------- |
  | `full`    | the whole drop                                                              | the drop as received   | what it stores                                  |
  | `overlay` | only the changed files                                                      | the changed files      | the Baseline's snapshot, with them laid over it |
  | `brief`   | no design files — a written change, e.g. "implement these kinds of screens" | `BRIEF.md`             | the Baseline's snapshot plus `BRIEF.md`         |

- **The Baseline is yours to confirm.** At planning Step 0 the suggestion is the
  latest `done` or `frozen` iteration in this repo; confirm it or pick another,
  and it is saved with `pnpm iteration:baseline <iteration> <baseline>`. Then the
  gate, `pnpm iteration:intake <iteration> --check --baseline <baseline>`, proves
  both snapshots are complete and unedited — when it fails, planning stops at
  once.
- **The delta follows the mode.** `full` / `overlay`: two signals — the
  designer's "What changed" notes and
  `pnpm iteration:diff <baseline> <iteration>`, which compares the two
  resolved intakes and nothing else; anything the diff shows that the
  notes omit is a **finding**. `brief`: `BRIEF.md` is the change list, and the
  diff must show nothing else changed. The Baseline's `intake-files/` are
  mandatory either way.
- **What was built beats what was drawn.** Planning reads the Baseline's
  `AS-BUILT.md` › Standing deviations and the current code of the affected
  parts; where the build differs from the design, the plan starts from the build.
- Planning can start while the Baseline is still being built; the **kickoff
  waits** until the Baseline is `done` or `frozen`.

---

## Prerequisites — have these before starting

| Prerequisite                                                                    | Source                  | Required?                                                    |
| ------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| The Baseline iteration, with its `intake-files/` (and `done`/`frozen` to build) | an earlier run          | **Yes** — the other side of the diff                         |
| The new drop — the whole drop, only the changed files, or a `BRIEF.md`          | Claude Design + Product | **Yes** — `iteration:intake` checks the resulting snapshot   |
| "What changed" notes in the changed specs (and `Preset: unchanged` when so)     | Claude Design           | **Yes** for `full` / `overlay` — the designer's stated delta |
| A `BRIEF.md` from `tooling/iterations/templates/BRIEF.md`                       | you / Product           | **Yes** for `brief` — what changes, why, acceptance criteria |
| The Baseline's `AS-BUILT.md` › Standing deviations                              | an earlier run          | **Yes** — where the build already differs from the design    |
| The existing clinozy-fe implementation of the Baseline                          | an earlier run          | **Yes** — there must be something to update                  |
| Visual-regression baselines from earlier iterations                             | an earlier run, step 6b | Recommended — catches ripple                                 |

The **preset never re-enters** unless the drop changes it — the diff says so.

---

## ==== STEP 1 — Open, place the drop, confirm the Baseline ====

```bash
pnpm iteration:new feat pharmacy-returns                          # or change / fix; --both when clinozy-be changes too
pnpm iteration:intake <iteration> <drop-folder>                   # the whole drop (--mode full)
pnpm iteration:intake <iteration> <drop-folder> --mode overlay    # only the changed files
pnpm iteration:intake <iteration> <brief-folder> --mode brief     # only BRIEF.md
```

`overlay` and `brief` build on the README's Baseline, so check it before the
intake: `iteration:new` writes the suggestion there, and another one is set with
`pnpm iteration:baseline <iteration> <baseline>` first. The Baseline's own gate
must pass. A single file works as the source, such as the `BRIEF.md` itself.

`--both` sends `PRD.md` and `schema-routes.md` (and `BRIEF.md` in brief mode) to
the same-named clinozy-be iteration, which builds its snapshot on its own
Baseline.

Planning Step 0 confirms the Baseline with you (or saves another with
`pnpm iteration:baseline`). After an `overlay` or `brief` intake, another
Baseline means rebuilding the snapshot — the gate fails until the intake is
re-run with `--replace`.

## ==== STEP 2 — Establish the delta ====

Say **"plan iteration <iteration>"**. After the gate, planning Step 2 builds the
delta by the Intake mode.

**`full` / `overlay` — two signals**, because they catch different things:

1. **The "What changed" notes** — what the designer _meant_ to change.
2. **The diff** — what actually changed between the two snapshots:

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
up.)

**`brief` — the brief is the change.** `BRIEF.md` lists what changes, why, the
affected screens, entities and routes, the rules, the acceptance criteria and
what is out of scope. `pnpm iteration:diff` must show only `BRIEF.md` added;
anything else is a finding. With no new design source, planning reconciles the
brief against the current screens' specs and the current code.

**Always — the Standing deviations.** The Baseline's `AS-BUILT.md` lists every
place the build differs from the design. Where the change touches one, the plan
starts from what was built, and KICKOFF.md lists it.

**The reconciled delta is the work list.**

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
- **`brief` mode** has no new design source to reconcile, so planning Step 3
  reconciles `BRIEF.md` against the current screens' specs and the current code
  instead: every affected screen, entity and route the brief names is checked
  against what exists, and a brief that contradicts a spec or the build is a
  question for you, not a guess.
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
- **Replace, don't fork** (Adoption → _One design per surface_): the changed
  shell replaces the old design in the same change — no preview variant kept
  beside it, nothing left that could load the old one.
- Platform-surface check: relocate-never-delete — every surface still has a home.
- Blast radius: **every route the shell owns** re-verifies, not one.

## ==== STEP 4 — Approve, then kick off — apply only the delta ====

The plan's ledger holds only the delta, in route order: **global changes**
(tokens, preset, layout) → **copy** → **styling** → **structural** → **new
screens**, then verification. Approve it, then say **"kickoff iteration
<iteration>"** — the kickoff starts only once the Baseline is `done` or
`frozen`, and only after the gate passes again:

```bash
pnpm iteration:intake <iteration> --check   # non-zero → the kickoff stops at once
```

Then the Status moves to `implementing` and `AS-BUILT.md` starts with the
Baseline's Standing deviations copied in. Each structural or new-screen row
follows the build order from Adoption (interaction shell → skeleton → regions →
content → states → motion), scoped to its screen; nothing outside the ledger is
touched.

## ==== STEP 5 — Record as you go ====

Every row gets its `AS-BUILT.md` entry. A row that changes rows still to come
records the revision; a scope change (a row added or removed, an Acceptance or
the order changed) **stops for you**, and the decision goes into
`plans/decisions.md`. A row that knowingly builds something other than the design
adds a Standing deviation; a row that brings the build back in line with the
design removes one.

## ==== STEP 6 — Verify · Pin · Close ====

Same as the initial process's step 6, by the Intake mode:

- **6a. Verify** — `full` / `overlay`: the changed screens by side-by-side
  comparison with the snapshot, at 375px and 1440px per state. `brief`: every
  `BRIEF.md` acceptance criterion, with the touched screens still matching their
  carried-forward specs.
- **6b. Re-run the _full_ baseline set**, in every mode — not just changed
  screens. The point is to catch ripple. Update baselines only where the change
  was intended; an unexpected diff is a finding, not a baseline to bless.
- **6c. Close:** every row `done` or `deferred` with your OK, the AS-BUILT
  summary and its Standing deviations (the Baseline's list, minus what this
  iteration resolved, plus its new ones), then
  `pnpm iteration:status <iteration> done`; `frozen` in the last commit before
  the merge.

---

## Why this is cheaper than the initial process

|             | Initial             | Incremental                                                                                                            |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Read        | Every spec, in full | The diff summary and the changed files in full — or `BRIEF.md` and the screens it names — plus the Standing deviations |
| Build       | Every screen        | Only changed screens                                                                                                   |
| Verify      | Every screen        | Changed screens + full ripple check                                                                                    |
| Cost driver | Screen count        | Change count                                                                                                           |

The initial process's cost scales with how big the design is. The incremental
process's scales with how much _changed_ — which for a later iteration is
usually small.

---

## Known gap

`pnpm iteration:diff` finds what changed mechanically — files, screens, PRD,
prototype, and the schema-routes entities, fields, enums, routes and operations
— but classifying each change (token / copy / styling / structural / new
screen) is still the planner's judgement in Step 3, and in `brief` mode the
diff has nothing to find beyond `BRIEF.md` itself. A classifier over the diff's
JSON is the next improvement.
