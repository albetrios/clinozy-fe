---
name: fe-design-ditto
description: Build faithfully ("ditto") from the markdown specs in an iterations/<iteration>/ folder — a preset/theme spec plus one spec per screen, optionally alongside a prototype HTML/JS. Reads every spec first, reconciles against any prototype (prototype wins), gates on four rebuild-forcing unknowns, then verifies side-by-side at 375px and 1440px. Use when the user says ditto, "same as the html", "like the legacy", "ditto from legacy", "match the design exactly", or drops specs into iterations/. The per-screen build skill fe-kickoff-iteration drives for each row of an approved iterations/<iteration>/KICKOFF.md.
---

# Design ditto (build faithfully from `iterations/<iteration>/intake-files/`)

For when "close enough" is a failure. The designer's drop lands in an
iteration's `intake-files/` and clinozy-fe must match it — not be inspired by it.

**The one-line rule: read every source file before building anything.** Every expensive failure in this repo's ditto work came from building
against a summary of the source instead of the source.

## Where the source lives

Each design iteration is a folder under `iterations/`; the designer's drop is
in its `intake-files/` — flat, exactly as delivered, never edited. This skill
builds **one screen (or one foundation piece) at a time** for
`fe-kickoff-iteration`, which walks the ledger of the approved
`iterations/<iteration>/KICKOFF.md` and names the row being built.

The iteration rule (in full: `iterations/README.md`):

- Baseline `none` → **MODE initial**: every screen is built.
- Otherwise **MODE incremental** against the Baseline: `intake-files/` is still
  a full snapshot (Intake mode `full`, `overlay` or `brief`), and the delta —
  `pnpm iteration:diff <baseline> <iteration>` over the two `intake-files/`
  folders, reconciled with the designer's "What changed", or `BRIEF.md` in brief
  mode — is what the ledger builds. Unchanged screens are not rebuilt.
- **Brief mode has no new design source.** The screen's carried-forward spec and
  the current code are the source; `BRIEF.md` says what changes and how it is
  accepted. Build to those, and record any deliberate difference from the
  design as a Standing deviation in `AS-BUILT.md`.
- `intake-files/` is locked from Status `approved`; what was actually built is
  recorded in `AS-BUILT.md`.

```text
iterations/<iteration>/
├── README.md            ← Type, Baseline, Status, Drop placed, Schema-routes, … + History
├── intake-files/        ← the full snapshot; received files exactly as delivered
│   ├── PRD.md · schema-routes.md · _index.md
│   ├── preset.md        ← theme: tokens, fonts, radius, density, motion
│   ├── shell.md         ← header, sidebar, nav — the frame around every screen
│   ├── <slug>.md        ← one .md per screen in _index.md
│   └── <prototype>.html · *.js   ← the running prototype
├── plans/decisions.md   ← blocking answers and scope decisions
├── KICKOFF.md           ← the approved plan (fe-iteration-planning)
└── AS-BUILT.md          ← what was built, row by row (fe-kickoff-iteration)
```

Filenames vary. **Do not assume** — run `ls iterations/<iteration>/intake-files/`
and read every `.md` there. The preset is whichever file describes
tokens/typography; the screens are the Slugs in `_index.md`.

| Input | Role | Authority |
| ----- | ---- | --------- |
| `intake-files/preset.md` | Theme — tokens, type, radius, density, motion | Theme truth |
| `intake-files/shell.md` | Header, nav chrome | Shell truth — **see Step 4b** |
| `intake-files/<slug>.md` | Per-screen structure, copy, states | Screen truth |
| `intake-files/*.html`, `intake-files/*.js` | Prototype, when present | **Outranks the md for behaviour** |

**Precedence:** when a prototype exists and disagrees with the markdown, the
prototype wins — a spec is someone's reading of it. Say so in the recap. When no
prototype exists, the markdown *is* the source of truth and any gap in it is a
question for the user, never a guess.

## Procedure

### Step 1 — Inventory and read. Report. Stop.

```bash
ls iterations/<iteration>/intake-files/
```

Then read, in full:

1. The preset spec — whichever `.md` describes tokens and typography.
2. Every screen `.md` in scope.
3. Any prototype HTML/JS for those screens — **fully**, not grep-only. An
   interaction you don't see is one you'll invent.

Report what you found: theme tokens, screens, regions, interaction shapes, step
sequences, timings, states. **Then stop for confirmation.**

Skipping this step is the single most expensive mistake available here.

### Step 2 — Reconcile

**If a prototype exists,** verify each markdown claim against it:

```bash
# Interaction shape — sheet or dialog?
grep -nE "sheet|drawer|modal|dialog|popup|overlay" iterations/<iteration>/intake-files/*.html iterations/<iteration>/intake-files/*.js

# Conditional step sequences (the most-missed fact)
grep -nE "step|stage|wizard|sequence|Keys?For|switch *\(" iterations/<iteration>/intake-files/*.js

# Timings — adjectives in a spec must resolve to numbers here
grep -nE "[0-9]{3,4} *(ms)?[,)]|setTimeout|duration|transition:" iterations/<iteration>/intake-files/*.js iterations/<iteration>/intake-files/*.html

# Responsive rules the spec may have flattened
grep -nE "@media|max-width|min-width" iterations/<iteration>/intake-files/*.html

# Dead code — CSS whose markup no longer exists
grep -nE "data-[a-z-]+" iterations/<iteration>/intake-files/*.html | sort -u
```

Record the result:

| Claim (md) | Prototype says | Verdict |
| ---------- | -------------- | ------- |
| "modal opens" | `[data-sheet]` + `translateY` | **sheet** — md was vague |

Check for **dead CSS**: a selector with no matching element is not a missing
feature. Do not build it; state that you checked.

**If no prototype exists,** reconcile the markdown against itself instead —
cross-screen consistency (shared components described differently), and every
`n/a` field. Contradictions become questions, not guesses.

### Step 3 — Gate on the four blockers

Score every screen on the Part B scoreboard of
[the intake checklist](../../../docs/design-workflow/prompts/design-intake-checklist.md),
with [the clinozy-fe rules](../../../docs/design-workflow/prompts/ditto-intake-checklist.md)
layered on top:

| 🔴 RED — do not build | Why it blocks |
| --------------------- | ------------- |
| Popup **shape** unknown | dialog ≠ sheet; wrong guess = rebuild |
| **Mobile** behaviour unknown | retrofitting responsive is a rewrite |
| Conditional **step sequence** unknown | linear ≠ branching |
| **Table vs card** unknown | different primitive, different everything |

Resolve RED from the prototype first. Ask the user only when the source is
genuinely silent. AMBER (missing copy, icon names, exact ms) → build the
structure, resolve before done.

### Step 4 — Theme first, then screens

**Apply `intake-files/preset.md` before building any screen.** Screens built against
the wrong tokens look wrong even when their structure is right, and re-theming
afterwards means re-screenshotting everything.

Map the preset md onto the handoff contract
([`design-handoff.contract.json`](../../../docs/design-workflow/prompts/design-handoff.contract.json)):

- Colour tokens → `[data-theme='<id>']` + `.dark[data-theme='<id>']` in `src/index.css`
- **Recompute every contrast ratio locally** — specs routinely miscalculate WCAG,
  and `validate:tokens` checks class usage, not ratios. A brand colour that fails
  AA keeps its true value only on non-text tokens (`--color-ring`, `--color-chart-1`).
- Register in **four** places or it fails to paint / flashes on load / is
  unreachable: `index.css` block, `.theme-dot-<id>` swatch, `THEME_PRESETS` in
  `src/shared/theme/presets.ts`, `PRESET_PRIMARY` in `public/theme-init.js`.
- Fonts must be **self-hosted** — CSP is `font-src 'self'`; a CDN link is blocked.

Then build each screen in this order — it front-loads the expensive decisions:

1. **Interaction shell** — sheet/dialog/drawer, plus its mobile variant.
2. **Flow skeleton** — including conditional sequences, before field content.
3. **Layout regions** — desktop and mobile together, never desktop-then-retrofit.
4. **Content** — fields, copy, icons.
5. **States** — loading, empty, error. Not optional.
6. **Motion** — exact durations from the spec.

Project rules **override** the source's implementation details. The prototype's
hand-rolled markup specifies *appearance and behaviour*, not what to import:

- shadcn primitives (`agent-os/skills/shadcn/SKILL.md`) — its `<div>` soup
  becomes `Sheet`, `Dialog`, `Table`.
- Semantic tokens only — port raw hexes as **new tokens**, never raw classes.
- Icons from `@/shared/icons/index.ts`, never `lucide-react` directly.
- Every user-visible string is an i18n key; new namespaces need a dev-server
  restart before they resolve.
- Route islands (`agent-os/skills/fe-route-island/SKILL.md`): `src/pages/`
  mirrors the URL; every page folder carries `<page>.route.tsx` (exports
  `Component` only), `<page>.manifest.ts`, `<Page>Page.tsx` or
  `<Page>Layout.tsx`, and `<PAGE>.OVERVIEW.md`, plus two registrations —
  `src/app/routes/routeTree.tsx` (RBAC via `gatewayFromManifest` in
  `beforeLoad`, never a route-file loader) and `docs/reference/routes-and-ui.md`.
  Scaffold new pages with `fe-page-scaffolding`.

### Step 4b — The shell has one design: replace it, never fork it

The header/nav frame is **shared by every page**, including platform surfaces
the design source has never seen. Treat it differently from screens.

**One design per surface — a new design replaces the old one.** clinozy-fe has
exactly one app shell, the section bar
(`src/shared/layouts/AppLayout/AppLayoutSectionBar.tsx`, mounted by
`AppLayout.tsx`). A ditto shell is built in its place: edit it, or write the new
shell and delete the old one in the same change, together with everything only
the old one used (components, i18n keys, tests). Never keep the old design beside
the new one as a "preview variant" behind a store index or a shuffle switch —
nobody sees it, the default drifts away from the design, and dead shells pile up.
Git history is the way back.

**Then slot the platform surfaces. Policy: relocate, never delete.** The design
source specified *its* product's chrome and has never seen this app's platform
surfaces, so `shell.md` will be silent on them — silence is not permission to
drop them. Fold each into the design's nearest equivalent slot (usually an
avatar/user menu). Fill this in **before building**; where the design offers no
natural slot, present options to the user rather than guessing:

Audited against `AppLayoutSectionBar.tsx`, `AppLayout.shared.tsx` and the
shell's components (`AccountMenu`, `NoticeStack`, `BranchPicker`, `PinnedTabs`,
`AllSections`) — this is every surface the shell mounts. Re-run the audit if the
shell changes:

| Platform surface | Where it lives now | Relocate to? |
| ---------------- | ------------------ | ------------ |
| Brand logo / wordmark | header start | ? |
| Primary nav items | All sections + pinned tabs (header, `md`+); section chip, All sections sheet and tab bar (phone) | ? |
| Organization switcher | Account menu › "Switch clinic" (hides with one workspace) | ? |
| Branch picker | header end | ? |
| Global search / ⌘K trigger | header search field; ⌘K | ? |
| Notifications | Account menu row → the inbox under the avatar | ? |
| **Theme mode (light/dark/system)** | Account menu › Appearance pills | ? |
| Profile + **sign-out** | Account menu identity block + Log out | ? |
| Settings entry (`#settings/*` hash modal) | Account menu rows (Settings, Security, Billing, Devices) | ? |
| Keyboard shortcuts | Account menu row; G and 1–9 | ? |
| Email-verification notice, View-as | the notice pills above the tab bar | ? |
| Mobile bottom nav | tab bar, phone only (four pins + More) | ? |

The bolded rows are easy to miss: the **light/dark choice** is a shell control
separate from the appearance picker inside settings, and **sign-out** has no
other one-click home.

A surface with no answer is a **RED blocker** — the same class as an unknown
popup shape. Dropping it silently loses functionality the design never knew
existed; guessing a position means moving it later.

**What is actually load-bearing** (verified against this codebase — re-check if
these move):

| Surface | If removed | Removable? |
| ------- | ---------- | ---------- |
| Sign-out | No way to end a session | **No** |
| Settings entry | `#settings/*` is a hash modal, not a route — with no trigger it is reachable only by typing a URL fragment | **No** |
| Organization switcher | `routeTree.tsx` derives org context from the URL (10 `organizationSlug` refs). A user with 2+ orgs cannot switch. | **Only in `personal-only` deployment mode** |
| Notifications · ⌘K trigger · verification banner | Palette keeps working via its shortcut; banner is conditional anyway | Yes — fold or drop |

The single exception to relocate-never-delete: in `personal-only` deployment
mode the org switcher is genuinely meaningless (such a deployment never reaches
the clinic shell — `requireTeamDeployment`, D44). Confirm the mode before
treating it as removable.

Two rules that keep this honest:

- **Ditto applies to the chrome, not to the inventory.** Match the design's
  structure, spacing, and treatment — but every existing surface still needs a
  home. If the design's sidebar has three nav items and the app has six plus a
  switcher, the design informs *how* they look, not *how many* survive.
- **Settings stays a hash modal.** `#settings/<scope>/<section>` opens over any
  page — it is not a route and must not become one
  (`agent-os/rules/fe-file-structure.mdc`). If the design shows settings as a page,
  that is a conflict to raise, not to implement.

Mobile is part of the shell, not an afterthought: the bottom nav, the collapse
behaviour, and what the header hides at narrow widths all belong in `shell.md`.

### Step 5 — Verify by comparison

Functional checks cannot detect a fidelity defect. "User can create the thing"
passes while the UI matches nothing.

- **Side-by-side screenshot per screen — source vs implementation, at 375px and
  1440px, per state.** With a prototype: open it in the browser pane alongside
  the app. Without one: walk the md field by field.
- Every reconciliation row now satisfied?
- Every state in the spec reachable and rendered?
- Static gates: `pnpm validate:tokens && pnpm validate:theme-axis &&
  pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint`

### Step 6 — Recap honestly

1. Reconciliation table (md vs prototype, and which won)
2. Theme applied — tokens, measured contrast ratios, registration points touched
3. What was built
4. **What still differs, and why** — deliberate deviations are fine; silent ones are not
5. What was not verified (e.g. behaviour needing a live backend)

## Known failure modes

Each produced a real rebuild in this repo.

| # | Failure | Prevention |
| - | ------- | ---------- |
| 1 | Built a centered dialog; source was a bottom sheet | Step 2 shape probe |
| 2 | Built one linear form; source varied steps by trigger type | Step 2 sequence probe |
| 3 | Desktop-only; mobile nav unclickable, cards overflowing | Step 4 — both widths together |
| 4 | Built 1 of 3 preview surfaces | Read the whole render path, not the default branch |
| 5 | Static preview; source had a timed frame player | Step 2 timing probe |
| 6 | Paraphrased copy | Quote verbatim |
| 7 | Claimed done functionally while the UI didn't match | Step 5 comparison |
| 8 | Built dead CSS as a feature | Step 2 dead-code check |
| 9 | Inferred the API contract from a plan doc | Read the backend's routes/serializers |
| 10 | Shipped a brand colour failing AA for text | Step 4 — recompute ratios |
| 11 | Adopted a design's shell and lost the org switcher / settings entry | Step 4b slotting table |
| 12 | Kept the old shell beside the new one as a preview variant; the default drifted and dead shells piled up | Step 4b — one design per surface |

## Anti-patterns

- **"It looks close enough."** If the user said ditto, it isn't.
- **Reading only the md** when a prototype is on disk.
- **Building screens before applying the preset.**
- **Keeping the old design beside the new one** (a "preview variant") instead of replacing it.
- **Dropping a platform surface** because the design spec didn't mention it.
- **Building desktop, then making it responsive.** Rebuild, not retrofit.
- **Raising a tolerance** to make a comparison pass.
- **Reporting done with known gaps unstated.** Name them; the user decides.

## Related

- `fe-kickoff-iteration` — drives this skill once per ledger row of an approved `KICKOFF.md`
- `fe-iteration-planning` — writes that `KICKOFF.md`
- [`design-intake-checklist.md`](../../../docs/design-workflow/prompts/design-intake-checklist.md) — the portable checklist (Part B = the scoreboard)
- [`ditto-intake-checklist.md`](../../../docs/design-workflow/prompts/ditto-intake-checklist.md) — the gate's clinozy-fe rules
- [`extract-screens-prompt.md`](../../../docs/design-workflow/prompts/extract-screens-prompt.md) — generates the iteration specs
- [`design-handoff.contract.json`](../../../docs/design-workflow/prompts/design-handoff.contract.json) — preset mapping
- `frontend-design` — craft, once fidelity is met
- `shadcn` — which primitive to reach for
- `fe-route-island` — page structure and registration
- `fe-visual-regression` — pin the result once it matches
