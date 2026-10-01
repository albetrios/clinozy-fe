---
name: fe-kickoff-planning
description: Turn an iterations/<iteration>/ spec drop (markdown specs + optional prototype HTML/JS) into a complete, gated KICKOFF plan and delta ledger BEFORE any code — full read with a coverage matrix, evidence-backed md↔prototype reconciliation, RED gate, then a plan whose required sections make omissions impossible. Use when the user says "kickoff", "set up a kickoff", "plan the next iteration", "make a plan from legacy", "plan from legacy", or asks to review an iteration (or a legacy design drop) and plan the build. Planning half of fe-design-ditto — this skill plans, fe-design-ditto builds.
---

# Kickoff planning (perfect plan from `iterations/<iteration>/`)

The planning half of a ditto build. **This skill produces the plan; the
`fe-design-ditto` skill executes it.** Its output is two artifacts inside the
iteration folder, and a stop:

1. `iterations/<iteration>/KICKOFF.md` — the plan, with every required section filled
2. The **delta ledger** — one numbered row per work item, each with a status

**Nothing is built until the user confirms the plan.** A kickoff that slides
into implementation has failed.

## Inputs and modes

```text
iterations/
├── README.md                                ← the rules (no index — `pnpm iteration:list`)
├── launch-2026-09-30-jxmr/                  ← the launch: a full snapshot → MODE initial
│   ├── README.md                            ← Type, Topic, Owner, Opened, Branch, Baseline, Status, Summary
│   ├── PRD.md                               ← the full product brief
│   ├── schema-routes.md                     ← every entity and route (the same file is in clinozy-be)
│   ├── *.md                                 ← specs: preset, shell, every screen
│   ├── *.html, *.js                         ← the prototype — outranks the md for behaviour
│   └── KICKOFF.md                           ← this skill's output
└── feat-pharmacy-returns-2026-10-06-kqzx/   ← a later iteration: changes only → MODE incremental
    ├── README.md                            ← Baseline = the latest iteration on main when it was opened
    ├── PRD.md                               ← a feature PRD for the change
    ├── schema-routes.md                     ← SCOPE = the changed screens
    ├── *.md                                 ← specs for the changed screens (+ their prototype, if any)
    └── KICKOFF.md                           ← the delta plan
```

The iteration rule (in full: `iterations/README.md`):

- Folders are `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/`, opened with
  `pnpm iteration:new <type> [topic]`. The type is `launch`, `feat`, `change`
  or `fix`; the topic is kebab-case with no digits; the date is the day it was
  opened; the id is four random letters. There is only one launch, and it has
  no topic.
- The mode comes from the type. The **launch** is **MODE initial**: a full
  snapshot, Baseline `none`; everything is new; read everything.
- Every other iteration is **MODE incremental**: one person, one branch,
  changes only. The folder **is** the delta — its own PRD, `schema-routes.md`
  scoped to the changed screens, and those screens' specs. Its README names its
  Baseline: the latest iteration on `main` when it was opened. The current state
  it changes is the launch plus every merged iteration, in merge order. A
  non-launch iteration with no Baseline → **stop and tell the user.**
- Status moves `planning` → `building` → `frozen`. An iteration is frozen in
  the last commit before it merges and never edited after; a correction is a
  new `fix` iteration.

## Procedure

### Step 1 — Inventory, read everything, build the coverage matrix. Stop.

`ls -R iterations/<iteration>/`, then read **every** file **in full** — every `.md`, the
prototype HTML including any state machine embedded at the bottom, and every
`.js` (classify each JS file: app logic to honour, or generic runtime engine to
ignore — say which and why).

**The completeness contract is a coverage matrix.** The plan is only "perfect"
if nothing in the drop escaped it, and the matrix is the proof. Build it before
planning:

| File | Read fully? | Kind | Screens/facts it owns | In plan at |
| ---- | ----------- | ---- | --------------------- | ---------- |

Then cross-check, and treat every mismatch as a finding to surface:

- Every screen in the index/`_index.md` has a spec file **and** a plan section.
- Every spec section (regions, data display, forms, popups, flows, icons,
  motion, states, copy) is either extracted into the plan or explicitly
  inherited from a template default — never silently dropped.
- Every prototype screen/state appears in some spec; a prototype surface with no
  md is a finding, not a skip.

Report the matrix and what you found — tokens, shell, screens, interaction
shapes, step sequences, exact timings, states — **then stop for confirmation.**

### Step 2 — Reconcile md ↔ prototype (evidence or it didn't happen)

When a prototype exists it **outranks the md for behaviour** — a spec is
someone's reading of it. The comparison output is only "perfect" when every row
carries evidence; a verdict without a line number is an opinion:

| # | Fact | md says (file:line) | Prototype says (selector/line) | Winner | Action |
| - | ---- | ------------------- | ------------------------------ | ------ | ------ |

Probe the prototype systematically (grep, then **read the hits in context**):

```bash
grep -nE "sheet|drawer|modal|dialog|popup|overlay" iterations/<iteration>/*.html iterations/<iteration>/*.js   # shapes
grep -nE "step|stage|wizard|sequence|switch *\(" iterations/<iteration>/*.js                                   # conditional sequences
grep -nE "[0-9]{3,4} *(ms)?[,)]|setTimeout|duration|transition:" iterations/<iteration>/*.{js,html}              # timings
grep -nE "@media|max-width|min-width" iterations/<iteration>/*.html                                            # responsive
grep -nE "data-[a-z-]+" iterations/<iteration>/*.html | sort -u                                                # dead CSS check
```

Mandatory reconciliation coverage — each is a row, never a blank:

- The **four rebuild-forcing facts** per screen (popup shape, mobile behaviour,
  conditional step sequence, table-vs-card) verified against the prototype.
- Every **timing** an md states, matched to a number in the source.
- **Dead CSS**: a selector with no matching markup is flagged, not planned.
- **md-only additions** (states, mobile behaviours, banners the happy-path mock
  omits): recorded in the plan's *Deviations* section as "build to the md".
- No prototype? Reconcile the md against itself — cross-screen contradictions
  become questions, not guesses.

### Step 3 — RED gate

Score every screen on the intake checklist's Part B scoreboard — A1–A12 per
screen (`docs/design-workflow/prompts/design-intake-checklist.md`), with the
clinozy-fe rules layered on top (`docs/design-workflow/prompts/ditto-intake-checklist.md`).
Any RED — unknown popup
shape, unknown mobile behaviour, unknown conditional sequence, unknown
table-vs-card — resolves from the prototype first; if the source is genuinely
silent, **stop and ask**. A wrong guess here is a rebuild. AMBER (missing copy,
icon names, exact ms) goes into the ledger as a row to resolve before done.

### Step 4 — Write `iterations/<iteration>/KICKOFF.md` (required sections — all of them)

A section may say `n/a — <reason>`; it may not be absent. Missing section =
incomplete plan.

1. **Header** — iteration, mode, Baseline (from its README), source files,
   date, which skill drives the build.
2. **Locked decisions** — routing scope, data strategy (fixtures-first vs real
   API), build scope and order. Each decision one line, numbered, dated.
3. **Foundation (before any screen)**
   - **Theme preset** — id, token values (OKLCH), and the **four registration
     points**: `[data-theme]` blocks in `src/index.css`, the `.theme-dot-<id>`
     swatch, `THEME_PRESETS` in `src/shared/theme/presets.ts`, `PRESET_PRIMARY`
     in `public/theme-init.js`. Note: **recompute every contrast ratio locally**
     — never trust ratios stated in a spec; AA-failing brand colours keep their
     true value only on non-text tokens. Fonts self-hosted (CSP `font-src 'self'`).
   - **Shell** — a **new** `AppLayout` variant (`resolve-app-shell.ts`), never an
     overwrite; the platform-surface relocation table (relocate, never delete —
     org switcher, ⌘K, notifications, mode toggle, user menu + sign-out,
     settings hash-modal entry, account shortcuts, verification banner, mobile
     nav + trigger); and the **make-it-live** contract: default variant + shuffle
     pinned off + not overridden by a persisted value.
   - **Stores** — any new global store (see State management below) with its
     exact scope and default.
   - **Icons** — the preset's library via `@/shared/icons/index.ts` only; list
     the exports to add.
4. **Route / island map** — every screen → its `src/pages/` path, following the
   conventions below. Mark access (public / auth / org-scoped / permission) and
   kind (page / URL-driven dialog / layout).
5. **State management map** — for each screen: server state (Query hooks),
   client state (which store, or none), URL state (`<page>.search.ts`), form
   state (RHF + Zod). Call out anything tempted to violate the rules table.
6. **Per-screen build notes** — one block per screen: interaction shapes, flow
   sequences with the per-input mapping, **exact timings in ms**, states, and
   anything the reconciliation locked. Each block names the **skill(s)** that
   drive its build (routing table below).
7. **Deviations** — where the plan builds to the md over the prototype (states,
   mobile, gating) and where project rules override the source (tokens, shadcn,
   i18n, icons, settings-stays-a-hash-modal).
8. **Verification plan** — side-by-side vs the source at **375px and 1440px**,
   per screen, per state; the static gates
   (`pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure
   && pnpm validate:testids && pnpm type-check && pnpm lint`); colocated Vitest
   per unit; and the freeze step — set `Status: frozen` in
   `iterations/<iteration>/README.md` in the last commit before the branch
   merges to `main`. After the merge the folder is never edited; a correction is
   a new `fix` iteration.
9. **Delta ledger** — numbered rows, one per work item, with an **Assignee**
   (`—` until someone takes the row) and a status
   `open | in progress | done | deferred(user-OK)`. **Success may not be
   reported while any row is open.**

### Step 4-inc — MODE incremental only

The iteration folder **is** the delta — never diff two snapshots. Step 1 read
it in full; outside it, read only what the change touches:

1. **The change** — the iteration's own `PRD.md` (what changes and why), its
   `schema-routes.md` (the entities and routes of the changed screens) and the
   changed screens' specs.
2. **The current state it changes** — the launch plus every merged iteration,
   in merge order. For each changed screen, read its latest spec among them and
   its current code in `src/pages/`:

   ```bash
   git log main --reverse --diff-filter=A --name-only --format= -- 'iterations/*/README.md'   # merged iterations, in merge order
   ```

Compare each changed screen's new spec with its current one. A difference the
PRD doesn't state is a **finding** — surface it, don't silently build it. The
reconciled change is the work list; screens outside it are not re-read.
Classify every change before building:

| Change | Cost | Blast radius |
| ------ | ---- | ------------ |
| Token values | Trivial | **Every screen** — re-screenshot all |
| Copy | Trivial | Locale files only |
| Component styling | Low | Contained |
| Structural (popup shape, step sequence, table↔card) | High | Rebuild — full RED gate, scoped |
| New screen / surface | High | New island + registrations — full RED gate |

Preset or layout changed → that is a whole-app re-tone/re-frame: write a scoped
kickoff (exact value moves read from the prototype CSS; layout must be made
live) and **stop for confirmation**. Apply only the delta; verify changed
screens **plus the full baseline set** — an unexpected diff on an untouched
screen is a finding, not a baseline to bless.

Other iterations may merge while this one is open; parallel branches are fine.
Before this one merges, if newer iterations reached `main`, update its
Baseline and check for overlap — the same screen, entity or route changed by
both — and resolve it in review. With the BE touched, the same-named
clinozy-be iteration carries the same `schema-routes.md`.

### Step 5 — Plan self-check, then stop

Before presenting, confirm every box; fix before showing, never after:

- [ ] Coverage matrix: every file in `iterations/<iteration>/` read fully and owned by a plan section
- [ ] Mode and Baseline match the iteration's README: `launch` = initial with Baseline `none`; anything else = incremental against its Baseline, its folder holding only the change (PRD, `schema-routes.md` scoped to the changed screens, their specs)
- [ ] Every screen in the index has spec + reconciliation rows + plan block + ledger rows
- [ ] All four rebuild-forcing facts resolved (or RED question raised) per screen
- [ ] Every reconciliation verdict carries file:line / selector evidence
- [ ] Theme lists all four registration points; contrast marked "recompute locally"
- [ ] Shell is a new variant + full surface-relocation table + make-it-live contract
- [ ] Every route follows the island conventions; registrations listed
- [ ] State management mapped per screen with no rule violations
- [ ] Every timing is a number in ms; every icon a named export; every string an i18n key
- [ ] Deviations section names md-over-prototype and project-rules-over-source items
- [ ] Ledger rows cover 100% of the work — nothing exists outside the ledger — and each has an Assignee column

Present: the coverage matrix, the reconciliation table, the RED/AMBER verdicts,
the full KICKOFF.md, and the ledger. **Stop. Build only after the user confirms
— then hand off to `fe-design-ditto` and the routing table below.**

## Project conventions the plan must encode (non-negotiable)

The plan is written for this repo. CLAUDE.md is the source of truth; these are
the rules a kickoff most often gets wrong:

- **Folder structure — route islands** (full contract:
  `agent-os/skills/fe-route-island/SKILL.md` + `agent-os/rules/fe-file-structure.mdc`).
  `src/pages/` mirrors the URL 1:1;
  children nest directly (no `sub-pages/`); dynamic segments are `$param`
  folders (strip-`$` kebab file prefix: `$organizationSlug/` →
  `organization-slug.route.tsx`). Every page folder = 4 files
  (`<page>.route.tsx` exporting `Component` only, `<page>.manifest.ts`,
  `<Page>Page.tsx` or Layout, `<PAGE>.OVERVIEW.md`) + 2 registrations
  (`src/app/routes/routeTree.tsx`, `docs/reference/routes-and-ui.md`). RBAC via `gatewayFromManifest` in
  routeTree `beforeLoad`, never a route-file loader. Promotion ladder: page →
  family `shared/` → `src/shared/` → `core`/`lib`; sibling families never
  import each other.
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

## Skill routing — the plan names the skill per work item

| Work item in the plan | Skill(s) |
| --------------------- | -------- |
| Executing the build faithfully | **fe-design-ditto** (this skill's other half) |
| New page/route scaffold | **fe-page-scaffolding** → **fe-route-island** |
| Org-scoped routes, guards, gateway, session | **fe-routing-tenancy** |
| Backend-resource CRUD island | **fe-resource-crud** |
| Choosing/adding shadcn primitives | **shadcn** |
| Theme preset registration + axis audit | **fe-theme-axis-audit** (+ `docs/reference/theming.md`) |
| Form mutations, error mapping | **fe-http-forms-errors** |
| Strings → i18n keys, constants | **fe-i18n-constants** |
| data-testids for E2E | **fe-e2e-testids** |
| Colocated unit tests | **fe-test-generation** (auto) |
| Visual polish after fidelity | **frontend-design** (never before fidelity) |
| Pinning the result | **fe-visual-regression** |

## Failure modes this skill exists to prevent

| Failure | Prevention here |
| ------- | --------------- |
| Plan built from a summary; a screen or state silently missing | Step 1 coverage matrix |
| md↔prototype verdicts asserted without evidence | Step 2 evidence columns |
| Guessed popup shape / step sequence → rebuild | Step 3 RED gate |
| Theme registered in 3 of 4 places → FOUC / unreachable | Step 4.3 checklist |
| Shell overwrote a variant / dropped the org switcher or settings entry | Step 4.3 relocation table |
| Work done outside the ledger; "done" claimed with open rows | Step 4.9 + self-check |
| Incremental build silently rebuilt unchanged screens | Step 4-inc delta discipline |

## Related

- `fe-design-ditto` — the build half; its Steps 4–6 execute this plan
- [`kickoff-prompt.md`](../../../docs/design-workflow/prompts/kickoff-prompt.md) — the paste-prompt this skill supersedes (kept as the user-facing entry point)
- [`design-intake-checklist.md`](../../../docs/design-workflow/prompts/design-intake-checklist.md) — the portable checklist (Part B = the scoreboard)
- [`ditto-intake-checklist.md`](../../../docs/design-workflow/prompts/ditto-intake-checklist.md) — the RED/AMBER gate's clinozy-fe rules
- [`initial-iteration.md`](../../../docs/design-workflow/process/initial-iteration.md) · [`incremental-iteration.md`](../../../docs/design-workflow/process/incremental-iteration.md) — the process docs
- [`iterations/README.md`](../../../iterations/README.md) — the iteration rules (`pnpm iteration:new` opens one, `pnpm iteration:list` lists them); `iterations/launch-2026-09-30-jxmr/KICKOFF.md` is the reference example of a complete plan
