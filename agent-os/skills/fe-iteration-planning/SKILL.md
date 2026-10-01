---
name: fe-iteration-planning
description: Plan a design iteration under iterations/<iteration>/ — NO CODE. Confirm the iteration and its Baseline, pass the intake gate (iteration:intake --check — stop on failure), read the full snapshot (coverage matrix), establish the delta by Intake mode (full/overlay: iteration:diff + the designer's "What changed"; brief: BRIEF.md) and the Baseline's Standing deviations, reconcile md ↔ prototype with file:line evidence, gate on blocking questions, then write KICKOFF.md with an ordered ledger and stop for approval. Use when the user says "plan iteration <name>", "iteration planning", "plan the next iteration", "plan from legacy", or asks to plan the build of a design drop. Next step after approval: fe-kickoff-iteration.
---

# Iteration planning (plan from `iterations/<iteration>/intake-files/`)

The planning half of the iteration workflow. **This skill writes the plan;
`fe-kickoff-iteration` builds it after the user approves.** Nothing is
implemented here — no component, token, route or test. It stops after every
step and leaves three things in the iteration folder:

1. `KICKOFF.md` — the plan, every required section present, ending in the ordered ledger (the route)
2. `plans/decisions.md` — every blocking-question answer
3. README Status `ready-for-approval`, then `approved` on the user's go-ahead

The flow on one page: [`docs/design-workflow/process/README.md`](../../../docs/design-workflow/process/README.md).
The rules: [`iterations/README.md`](../../../iterations/README.md).

## The iteration folder

```text
iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/
├── README.md            ← field table (Status, Baseline, Drop placed, Schema-routes, …) + ## History
├── intake-files/        ← the FULL snapshot (Intake mode full, overlay or brief), flat; locked from approved
│   ├── PRD.md · schema-routes.md · _index.md · preset.md · shell.md · <slug>.md per screen
│   ├── <prototype>.html · the *.js it loads (optional: _patterns.md, _report.md, …)
│   └── BRIEF.md         ← brief mode only: the written change
├── plans/decisions.md   ← blocking-question answers + every scope decision
├── KICKOFF.md           ← this skill's output: the plan + ordered ledger; frozen at approval
└── AS-BUILT.md          ← written by fe-kickoff-iteration; ends with the Standing deviations
```

- **Mode.** Baseline `none` → **MODE initial** (the first iteration in this
  repo): everything is new; read everything. Otherwise **MODE incremental**
  against the Baseline the user confirms in Step 0 — the suggestion is the
  latest `done` or `frozen` iteration in this repo.
- **Intake modes.** `intake-files/` is always a full snapshot. `full` — the drop as received (the
  launch is always full). `overlay` — only the changed files arrived: the Baseline's snapshot with
  them laid over it. `brief` — no design files, only a written change such as "implement these
  kinds of screens": the Baseline's snapshot plus `BRIEF.md`. The README records the Intake mode,
  an Intake note (received versus carried forward) and an Intake hash.
- **The delta by mode.** `full` / `overlay`: the designer's "What changed" notes plus
  `pnpm iteration:diff <baseline> <iteration>`, which compares the two `intake-files/` folders and
  nothing else — anything the diff shows that the notes omit is a finding. `brief`: `BRIEF.md` is
  the change list, and the diff must show nothing else changed. Always: the Baseline's Standing
  deviations — where the build differs from the drop, plan against what was actually built.
- **The gate.** `pnpm iteration:intake <iteration> --check [--baseline <baseline>]` proves every
  mandatory file is in the snapshot (and the Baseline's) and that no file changed since the intake.
  **Gate rule:** when it exits non-zero, stop now — write nothing, change no status, ask nothing
  else; print the command's output and end the turn.
- The README's Status and Baseline change only through `pnpm iteration:status`
  and `pnpm iteration:baseline`, which also append its History line.

## Procedure — stop after every step and wait

### Step 0 — Confirm the iteration. Stop until confirmed.

Run `pnpm iteration:list` and show:

| Iteration | Type | Baseline | Status | Eligible | Why |
| --------- | ---- | -------- | ------ | -------- | --- |

Eligible = Status `planning`. Recommend the earliest-opened eligible iteration
(the launch always comes first). If the user named one, check it against the
rule. For an incremental iteration, suggest the Baseline — the latest `done` or
`frozen` iteration in this repo — and let the user confirm it or pick another;
save it with `pnpm iteration:baseline <iteration> <baseline>`. Always ask with
**AskUserQuestion** — never pick silently. An `overlay` or `brief` snapshot was built on the
Baseline recorded at intake; picking another means rebuilding it (the gate fails until
`pnpm iteration:intake <iteration> <source> --mode <mode> --replace` has run).

Then **the gate**:

```bash
pnpm iteration:intake <iteration> --check                         # MODE initial
pnpm iteration:intake <iteration> --check --baseline <baseline>   # MODE incremental
```

**Gate rule:** if it exits non-zero, stop now — write nothing, change no status, ask nothing
else; print the command's output and end the turn. A failing gate goes back to whoever placed the
drop; the plan never works around a missing or edited file.

### Step 1 — Read everything, coverage matrix. Stop.

The gate passed, so the snapshot is complete and unedited. The intake warnings (extras, screen
files not in `_index.md`) are findings.

Read **every** file in `intake-files/` **in full** — every `.md` (with `BRIEF.md` first in brief
mode), the prototype HTML including any state machine embedded at the bottom, and every `.js`
(classify each JS file: app logic to honour, or generic runtime engine to ignore — say which and
why).

**The completeness contract is a coverage matrix.** The plan is only "perfect"
if nothing in the drop escaped it, and the matrix is the proof:

| File | Read fully? | Kind | Screens/facts it owns | In plan at |
| ---- | ----------- | ---- | --------------------- | ---------- |

Cross-check, and treat every mismatch as a finding:

- Every screen in `_index.md` has a spec file **and** a plan section.
- Every spec section (regions, data display, forms, popups, flows, icons,
  motion, states, copy) is either extracted into the plan or explicitly
  inherited from a template default — never silently dropped.
- Every prototype screen/state appears in some spec; a prototype surface with no
  md is a finding, not a skip.

Report the matrix and what you found — tokens, shell, screens, interaction
shapes, step sequences, exact timings, states. **Stop.**

### Step 2 — Delta (MODE incremental only). Stop.

MODE initial: write `n/a — initial` and go on. MODE incremental: establish the delta by the
README's Intake mode, then read what the Baseline actually built.

- **`full` / `overlay`** — two signals, reconciled:
  1. **The designer's "What changed"** — the notes in the changed specs and the PRD.
  2. **The diff** — files and screens added, removed or changed; whether the PRD,
     `schema-routes.md` or the prototype changed; the entities, fields, enums, routes and
     operations added, removed or changed.

  ```bash
  pnpm iteration:diff <baseline> <iteration>          # summary, then the raw diff of the two intake-files/ folders
  pnpm iteration:diff <baseline> <iteration> --json   # the summary for this step
  ```

- **`brief`** — `BRIEF.md` is the change list: what changes, why, the affected screens, entities
  and routes, the rules, the acceptance criteria, and what is out of scope.
  `pnpm iteration:diff <baseline> <iteration>` must show only `BRIEF.md` added; anything else is a
  finding to resolve before planning.
- **Always** — the Baseline's `AS-BUILT.md` › Standing deviations (wherever the build differs from
  the drop, plan against what was actually built) and the current code of the affected parts. List
  the relevant standing deviations in KICKOFF.md §7.

A diff hit the notes omit is a **finding** — surface it, never build it
silently. The reconciled delta (or the brief) is the work list; classify every change:

| Change                                              | Cost    | Blast radius                               |
| --------------------------------------------------- | ------- | ------------------------------------------ |
| Token values                                        | Trivial | **Every screen** — re-screenshot all       |
| Copy                                                | Trivial | Locale files only                          |
| Component styling                                   | Low     | Contained                                  |
| Structural (popup shape, step sequence, table↔card) | High    | Rebuild — full RED gate, scoped            |
| New screen / surface                                | High    | New island + registrations — full RED gate |

**Preset or layout changed?** That re-tones or re-frames the whole app. Write a
scoped section for KICKOFF.md first — the exact value moves (type, colour, bg,
spacing, radius) read from the prototype CSS, light and dark; for a layout, the
routes the shell owns and the make-it-live contract — and **stop**. Screens
outside the delta are not re-read. **Stop.**

### Step 3 — Reconcile md ↔ prototype (evidence or it didn't happen). Stop.

When a prototype exists it **outranks the md for behaviour** — a spec is
someone's reading of it. Every verdict carries evidence; a verdict without a
line number is an opinion:

| #   | Fact | md says (file:line) | Prototype says (selector/line) | Winner | Action |
| --- | ---- | ------------------- | ------------------------------ | ------ | ------ |

Probe the prototype systematically (grep, then **read the hits in context**):

```bash
cd iterations/<iteration>/intake-files
grep -nE "sheet|drawer|modal|dialog|popup|overlay" *.html *.js   # shapes
grep -nE "step|stage|wizard|sequence|switch *\(" *.js             # conditional sequences
grep -nE "[0-9]{3,4} *(ms)?[,)]|setTimeout|duration|transition:" *.js *.html   # timings
grep -nE "@media|max-width|min-width" *.html                      # responsive
grep -nE "data-[a-z-]+" *.html | sort -u                          # dead CSS check
```

Mandatory coverage — each is a row, never a blank:

- The **four rebuild-forcing facts** per screen (popup shape, mobile behaviour,
  conditional step sequence, table-vs-card) verified against the prototype.
- Every **timing** an md states, matched to a number in the source.
- **Dead CSS**: a selector with no matching markup is flagged, not planned.
- **md-only additions** (states, mobile behaviours, banners the happy-path mock
  omits): recorded in the plan's _Deviations_ section as "build to the md".
- No prototype? Reconcile the md against itself — cross-screen contradictions
  become questions, not guesses.

MODE incremental: reconcile the changed screens and whatever they touch.
**Brief mode:** there is no new design source — reconcile `BRIEF.md` against the current screens'
specs (the carried-forward intake) and the current code, every verdict with file:line evidence.
**Stop.**

### Step 4 — Blocking questions (the RED gate). Stop.

Score every screen in scope on the intake checklist's Part B scoreboard — A1–A12
per screen ([`design-intake-checklist.md`](../../../docs/design-workflow/prompts/design-intake-checklist.md)),
with the clinozy-fe rules layered on top
([`ditto-intake-checklist.md`](../../../docs/design-workflow/prompts/ditto-intake-checklist.md)).

- **RED** — unknown popup shape, unknown mobile behaviour, unknown conditional
  sequence, unknown table-vs-card, a platform surface with no home. Resolve from
  the prototype first. If the source is genuinely silent, **never guess**: ask
  with **AskUserQuestion** — at most 4 per call, one recommended option each,
  quoting the evidence — and record every answer in `plans/decisions.md` (Kind
  `RED`). A wrong guess here is a rebuild.
- **AMBER** — missing copy, icon names, exact ms. Take a safe default, log it in
  `plans/decisions.md` as open (Kind `AMBER`), and give it a ledger row to
  resolve before done.

`plans/decisions.md` rows: `| # | Date | Kind | Question or change | Decision |
Evidence | By |`, numbered D1, D2, … in order (Kind `RED`, `AMBER` or `SCOPE`).
**Stop.**

### Step 5 — Write `iterations/<iteration>/KICKOFF.md`. Stop.

A section may say `n/a — <reason>`; it may never be absent.

1. **Header** — iteration, mode, Baseline, sources (`intake-files/`), date,
   evidence notation, and the skills that plan and build it.
2. **Locked decisions** — numbered, dated, one line each; RED answers link to
   their `plans/decisions.md` row.
3. **Foundation (before any screen)**
   - **Theme preset** — id, token values (OKLCH), and the **four registration
     points**: `[data-theme]` blocks in `src/index.css`, the `.theme-dot-<id>`
     swatch, `THEME_PRESETS` in `src/shared/theme/presets.ts`, `PRESET_PRIMARY`
     in `public/theme-init.js`. **Recompute every contrast ratio locally** —
     never trust ratios stated in a spec; AA-failing brand colours keep their
     true value only on non-text tokens. Fonts self-hosted (CSP `font-src 'self'`).
   - **Shell** — a **new** `AppLayout` variant (`resolve-app-shell.ts`), never an
     overwrite; the platform-surface relocation table (relocate, never delete —
     org switcher, ⌘K, notifications, mode toggle, user menu + sign-out,
     settings hash-modal entry, account shortcuts, verification banner, mobile
     nav + trigger); and the **make-it-live** contract: default variant + shuffle
     pinned off + not overridden by a persisted value.
   - **Stores** — any new global store with its exact scope and default.
   - **Icons** — the preset's library via `@/shared/icons/index.ts` only; list
     the exports to add.
4. **Route / island map** — every screen → its `src/pages/` path, following the
   conventions below. Mark access (public / auth / org-scoped / permission) and
   kind (page / URL-driven dialog / layout).
5. **State management map** — per screen: server state (Query hooks), client
   state (which store, or none), URL state (`<page>.search.ts`), form state (RHF
   + Zod). Call out anything tempted to violate the rules table.
6. **Per-screen build notes** — interaction shapes, flow sequences with the
   per-input mapping, **exact timings in ms**, states, and anything the
   reconciliation locked; each block names the **skill(s)** that build it.
7. **Deviations** — where the plan builds to the md over the prototype (states,
   mobile, gating) and where project rules override the source (tokens, shadcn,
   i18n, icons, settings-stays-a-hash-modal); and the Baseline's **Standing
   deviations** that this change touches (item · design says · built as · since ·
   decision), with whether this iteration keeps or resolves each.
8. **Verification** — by Intake mode: `full` / `overlay` → side-by-side against
   the source at **375px and 1440px**, per screen, per state (MODE incremental:
   the changed screens **and** the full baseline set); `brief` → the `BRIEF.md`
   acceptance criteria **and** the full baseline set; the static gates (`pnpm validate:tokens && pnpm
   validate:theme-axis && pnpm validate:structure && pnpm validate:testids &&
   pnpm type-check && pnpm lint`); colocated Vitest per unit; and the close —
   `AS-BUILT.md` summary with the Standing deviations, `pnpm iteration:status
   <iteration> done`, `frozen` in the last commit before the branch merges.
9. **The route — the ordered ledger.** One row per work item, in build order:

   | #   | Work item | Kind | Depends on | Skill/driver | Acceptance | Assignee | Status |
   | --- | --------- | ---- | ---------- | ------------ | ---------- | -------- | ------ |

   Kind is `foundation`, `global`, `copy`, `styling`, `structural`, `screen`,
   `gate` or `verify`. Acceptance is how the row is proved (the comparison, a
   gate, a test). Assignee is `—` until someone takes the row. Status is `open`,
   `in progress`, `done` or `deferred (user-OK)`. **Success may not be reported
   while any row is open.**

   Route order:

   - **MODE initial** — foundation first: the preset (contrast recomputed, all
     four registration points) → the shell as a new variant made live (default,
     pinned, not persisted) → stores → icons; then the screens in order, each
     built interaction shell → flow skeleton → regions (desktop and mobile
     together) → content → states → motion; then verification.
   - **MODE incremental** — global changes (tokens, preset, layout) → copy →
     styling → structural → new screens; then verification, including the full
     baseline set.

KICKOFF.md is **frozen at approval**: afterwards only the ledger's Status column
and `revised → AS-BUILT #n` markers change. **Stop.**

### Step 6 — Self-check, then ready-for-approval. Stop.

Confirm every box; fix before presenting, never after:

- [ ] The gate (`iteration:intake --check`) passed, and every file in `intake-files/` is read fully and owned by a plan section
- [ ] MODE incremental: the delta follows the Intake mode (full/overlay: `iteration:diff` ⟷ "What changed"; brief: `BRIEF.md`, nothing else changed), every change classified, every omission raised as a finding
- [ ] The Baseline's Standing deviations are read, and the ones this change touches are in §7
- [ ] Every screen in `_index.md` has spec + reconciliation rows + plan block + ledger rows
- [ ] All four rebuild-forcing facts resolved (or RED question raised) per screen
- [ ] Every reconciliation verdict carries file:line / selector evidence
- [ ] Every RED answer and AMBER default is in `plans/decisions.md`
- [ ] Theme lists all four registration points; contrast marked "recompute locally"
- [ ] Shell is a new variant + full surface-relocation table + make-it-live contract
- [ ] Every route follows the island conventions; registrations listed
- [ ] State management mapped per screen with no rule violations
- [ ] Every timing is a number in ms; every icon a named export; every string an i18n key
- [ ] Deviations name md-over-prototype and project-rules-over-source items
- [ ] The ledger follows the route order, covers 100% of the work, and every row has Kind, Depends on, Skill/driver, Acceptance and Assignee

Then `pnpm iteration:status <iteration> ready-for-approval` and present the
coverage matrix, the delta (incremental), the reconciliation table, the RED and
AMBER verdicts, KICKOFF.md and the ledger. **Stop.**

On the user's go-ahead: `pnpm iteration:status <iteration> approved` — that
locks `intake-files/` — and hand off to `fe-kickoff-iteration`. A change of
scope after that goes back first:
`pnpm iteration:status <iteration> planning --reason "<why>"`.

## Project conventions the plan must encode (non-negotiable)

The plan is written for this repo. CLAUDE.md is the source of truth; these are
the rules a plan most often gets wrong:

- **Folder structure — route islands** (full contract:
  `agent-os/skills/fe-route-island/SKILL.md` + `agent-os/rules/fe-file-structure.mdc`).
  `src/pages/` mirrors the URL 1:1; children nest directly (no `sub-pages/`);
  dynamic segments are `$param` folders (strip-`$` kebab file prefix:
  `$organizationSlug/` → `organization-slug.route.tsx`). Every page folder = 4
  files (`<page>.route.tsx` exporting `Component` only, `<page>.manifest.ts`,
  `<Page>Page.tsx` or Layout, `<PAGE>.OVERVIEW.md`) + 2 registrations
  (`src/app/routes/routeTree.tsx`, `docs/reference/routes-and-ui.md`). RBAC via
  `gatewayFromManifest` in routeTree `beforeLoad`, never a route-file loader.
  Promotion ladder: page → family `shared/` → `src/shared/` → `core`/`lib`;
  sibling families never import each other.
- **CRUD URLs.** List `/x` · create `/x/create` (dialog over list) · show
  `/x/:id` · edit `/x/:id/edit` (dialog) · delete = inline confirm, no URL.
- **State management.** Server state → TanStack Query only (never in Zustand);
  global client state → `src/shared/store/use<X>Store/`; page-local Zustand is a
  last resort (useState → useReducer → URL search params first); URL state →
  `<page>.search.ts`; forms → react-hook-form + Zod. Data shapes are Zod schemas
  in `contracts.ts`; types inferred, never hand-written.
- **Styling.** Semantic tokens only (`validate:tokens`); shadcn primitives (the
  prototype's markup specifies appearance, not imports); icons via
  `@/shared/icons/index.ts` only; every user-visible string is an i18n key (new
  namespaces need a dev-server restart); settings stays the `#settings/*` hash
  modal — never a route.
- **HTTP.** `apiClient` from `core/http`; org context comes from the URL/token,
  never a header; **never infer an API contract** — read clinozy-be's routes and
  serializers, or plan fixtures-first with `REPLACE_WITH_API` markers.

## Skill routing — the plan names the skill per ledger row

| Work item in the plan                       | Skill(s)                                                |
| ------------------------------------------- | ------------------------------------------------------- |
| Building the approved plan, row by row      | **fe-kickoff-iteration** (the next step)                |
| A screen, built faithfully to the source    | **fe-design-ditto**, driven by fe-kickoff-iteration     |
| New page/route scaffold                     | **fe-page-scaffolding** → **fe-route-island**           |
| Org-scoped routes, guards, gateway, session | **fe-routing-tenancy**                                  |
| Backend-resource CRUD island                | **fe-resource-crud**                                    |
| Choosing/adding shadcn primitives           | **shadcn**                                              |
| Theme preset registration + axis audit      | **fe-theme-axis-audit** (+ `docs/reference/theming.md`) |
| Form mutations, error mapping               | **fe-http-forms-errors**                                |
| Strings → i18n keys, constants              | **fe-i18n-constants**                                   |
| data-testids for E2E                        | **fe-e2e-testids**                                      |
| Colocated unit tests                        | **fe-test-generation** (auto)                           |
| Visual polish after fidelity                | **frontend-design** (never before fidelity)             |
| Pinning the result                          | **fe-visual-regression**                                |

## Failure modes this skill exists to prevent

| Failure                                                                | Prevention here                       |
| ---------------------------------------------------------------------- | ------------------------------------- |
| The wrong iteration planned, or against an unconfirmed Baseline        | Step 0 eligibility table + AskUserQuestion |
| A plan built on an incomplete or edited intake                         | Step 0 gate (`iteration:intake --check`) |
| A plan against the design where the build already differs             | Step 2 Standing deviations            |
| Plan built from a summary; a screen or state silently missing          | Step 1 coverage matrix                |
| A changed screen the designer's notes forgot                           | Step 2 diff ↔ "What changed"          |
| md↔prototype verdicts asserted without evidence                        | Step 3 evidence columns               |
| Guessed popup shape / step sequence → rebuild                          | Step 4 RED gate                       |
| Theme registered in 3 of 4 places → FOUC / unreachable                 | Step 5.3 checklist                    |
| Shell overwrote a variant / dropped the org switcher or settings entry | Step 5.3 relocation table             |
| Work done outside the ledger; "done" claimed with open rows            | Step 5.9 + Step 6 self-check          |
| An incremental build that re-reads or rebuilds unchanged screens       | Step 2 delta + Step 5.9 route order   |

## Related

- `fe-kickoff-iteration` — the build half: implements the approved ledger row by row, writing `AS-BUILT.md`
- `fe-design-ditto` — builds each screen faithfully to the source
- [`iteration-planning-prompt.md`](../../../docs/design-workflow/prompts/iteration-planning-prompt.md) — the paste prompt for this skill
- [`design-intake-checklist.md`](../../../docs/design-workflow/prompts/design-intake-checklist.md) — the portable checklist (Part B = the scoreboard)
- [`ditto-intake-checklist.md`](../../../docs/design-workflow/prompts/ditto-intake-checklist.md) — the RED/AMBER gate's clinozy-fe rules
- [`docs/design-workflow/process/`](../../../docs/design-workflow/process/README.md) — the two-phase flow, initial and incremental pages
- [`iterations/README.md`](../../../iterations/README.md) — the iteration rules and commands; `iterations/launch-2026-09-30-jxmr/KICKOFF.md` is the reference example of a complete plan
