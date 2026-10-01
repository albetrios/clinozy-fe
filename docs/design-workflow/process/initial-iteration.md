# Initial iteration

**Run when the Baseline is `none` — the first iteration in this repo (the
launch).** Everything is new; nothing exists to diff against. Assumes
[Adoption](adoption.md).

Six steps. The first two are design work and stay yours. Planning ends in your
approval; the kickoff then builds the plan one ledger row at a time.

## The iteration rule

The rules and commands are in [`iterations/README.md`](../../../iterations/README.md).
For this process:

- The first iteration in this repo is the **launch**,
  `iterations/launch-<YYYY-MM-DD>-<id>/` — this repo's is
  `launch-2026-09-30-jxmr`. It is opened with `pnpm iteration:new launch`, and
  its Baseline is `none`: MODE `initial`.
- Its `intake-files/` hold the full drop, exactly as delivered — the same as
  every later iteration.
- Every later iteration runs [Incremental iteration](incremental-iteration.md)
  against a Baseline you confirm.

---

## Prerequisites — the drop

`pnpm iteration:intake` places the drop and refuses it while anything required
is missing. Steps 1–2 produce these; put them all, flat, in one folder.

| File                                                           | Source                                                                                                                                                       | Required?                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `PRD.md`                                                       | Product — the brief the design is built from                                                                                                                 | **Yes** — what the product is                         |
| `<prototype>.html` + every `*.js` it loads                     | Claude Design — the prototype export                                                                                                                         | **Yes** — it **outranks the md** for behaviour        |
| `preset.md`                                                    | Claude Design — [`design-brief-prompt.md`](../prompts/design-brief-prompt.md)                                                                                | **Yes** — theme first                                 |
| `shell.md`, `_index.md`, one `<slug>.md` per Slug in the index | Claude Design — [`extract-screens-prompt.md`](../prompts/extract-screens-prompt.md)                                                                          | **Yes** — the frame and the screens to build          |
| `schema-routes.md`                                             | Claude Design — [`schema-routes-prompt.md`](../prompts/schema-routes-prompt.md)                                                                              | **Yes** — entities and routes; shared with clinozy-be |
| `_patterns.md`, `_report.md` (`_`-prefixed shared files)       | Claude Design                                                                                                                                                | Optional                                              |
| `design-brief*.md`, auth and system-surface `.md`              | [`auth-public-routes-brief.md`](../prompts/auth-public-routes-brief.md), [`extract-system-surfaces-prompt.md`](../prompts/extract-system-surfaces-prompt.md) | Optional                                              |
| `preset.json`, `design-overview.md`                            | [`design-overview-prompt.md`](../prompts/design-overview-prompt.md)                                                                                          | Optional                                              |

Any other file is reported as an extra, and a `<slug>.md` that `_index.md`
doesn't list is a warning — both are findings for planning. Quick check:

```bash
pnpm iteration:intake <iteration> <drop-folder> --dry-run
```

---

## ==== STEP 1 — Design ====

In Claude Design, build the requirement. It generates the prototype:

```text
<name>.html   +   support.js
```

Nothing to do in clinozy-fe yet. This is design work, and it should stay yours.

## ==== STEP 2 — Extract ====

Paste these prompts into Claude Design, in this order. Save every returned file
**flat in one drop folder**, beside the prototype export and `PRD.md`.

| #   | Prompt                                                                              | Gives you                                           |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | [`design-brief-prompt.md`](../prompts/design-brief-prompt.md)                       | `preset.md` — the theme                             |
| 2   | [`extract-screens-prompt.md`](../prompts/extract-screens-prompt.md)                 | `shell.md`, `_index.md`, one `<slug>.md` per screen |
| 3   | [`schema-routes-prompt.md`](../prompts/schema-routes-prompt.md)                     | `schema-routes.md` — entities and routes            |
| 4   | [`auth-public-routes-brief.md`](../prompts/auth-public-routes-brief.md)             | auth/public layouts and routes, if in scope         |
| 5   | [`extract-system-surfaces-prompt.md`](../prompts/extract-system-surfaces-prompt.md) | overlays and loading, if in scope                   |

## ==== STEP 3 — Open the iteration and place the drop ====

```bash
pnpm iteration:new launch                                  # --both opens it in clinozy-be too
pnpm iteration:intake <iteration> <drop-folder>            # --both copies PRD.md + schema-routes.md there
```

The intake copies the drop into `iterations/<iteration>/intake-files/` exactly
as delivered and fills the README's Drop placed, Drop source and Schema-routes
rows. Status stays `planning`.

## ==== STEP 4 — Plan (no code), then approve ====

Say **"plan iteration <iteration>"** (or paste
[`iteration-planning-prompt.md`](../prompts/iteration-planning-prompt.md)).
`fe-iteration-planning` stops after every step:

0. Confirms the iteration (`pnpm iteration:list`, eligibility table, your answer).
1. Re-checks the intake, reads every file in full, builds the coverage matrix.
2. Delta — `n/a` for an initial iteration.
3. Reconciles the markdown against the prototype (prototype wins), with evidence.
4. Asks the blocking (RED) questions; answers go to `plans/decisions.md`.
5. Writes `KICKOFF.md` — every required section, and the ledger in route order:
   foundation (preset, shell made live, stores, icons) → screens.
6. Self-checks, sets `ready-for-approval` and stops.

Read the plan. When it is right, approve it: planning runs
`pnpm iteration:status <iteration> approved`, which locks `intake-files/`.

**Do not skip the stops.** They exist because building on a summary — rather
than the source — is what produced every rebuild in this repo.

## ==== STEP 5 — Kickoff — build row by row ====

Say **"kickoff iteration <iteration>"** (or paste
[`kickoff-iteration-prompt.md`](../prompts/kickoff-iteration-prompt.md)).
`fe-kickoff-iteration` moves the iteration to `implementing`, starts
`AS-BUILT.md`, and follows the ledger in the order from Adoption — **preset →
shell → screens**:

- Preset: recompute every contrast ratio locally; register in all four places.
- Shell: new variant, relocate-never-delete, made live (default, pinned, not
  persisted).
- Screens: through `fe-design-ditto`, one at a time, desktop and mobile together.

After each row: verify it, write its `AS-BUILT.md` entry, check its impact on
the rows still to come (a scope change stops for you), and wait for your review.

## ==== STEP 6 — Verify · Pin · Close ====

### 6a. Verify by comparison

Side-by-side, source vs implementation, 375px and 1440px, per screen, per state.
Then the static gates (Adoption, DONE definition).

### 6b. Pin the result

Capture visual-regression baselines
([`fe-visual-regression`](../../../agent-os/skills/fe-visual-regression/SKILL.md)).

This is the safety net for the _next_ iteration: when a later iteration changes
a token, the diff shows every screen it touched — including the ones you weren't
editing.

### 6c. Close and freeze

When every ledger row is `done` (or `deferred` with your OK) and `AS-BUILT.md`
has its summary — planned but not built, built but not planned, follow-ups —
the kickoff runs `pnpm iteration:status <iteration> done`. In the last commit
before the branch merges:

```bash
pnpm iteration:status <iteration> frozen
git add iterations/<iteration>/ && git commit -m "chore: freeze <iteration> (as built)"
```

After the merge the folder is never edited. The next design change is a new
iteration with the full drop, and this one is its Baseline.

---

**Result:** a ditto Claude Design implementation across all screens, pinned, with
its plan, its as-built record and its frozen iteration. **Next iteration →**
[Incremental iteration](incremental-iteration.md).
