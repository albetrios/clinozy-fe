# Clinozy launch — kickoff plan

> **Status: plan only — awaiting your confirmation. Nothing is built.**
> The four RED questions were answered on 2026-10-01 (D17–D20, Appendix C.2).
> Before any build step, confirm or amend the decisions in §2 (D1–D16) and the
> proposed defaults in Appendix D.
> `fe-design-ditto` then executes §3–§8 in ledger order (§9).

## 1. Header

| Field            | Value                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/launch-2026-09-30-jxmr/` · **initial** (type launch, Baseline none)                                                                                                                                                                                                                                                                                 |
| Date             | 2026-10-01                                                                                                                                                                                                                                                                                                                                                      |
| Product          | Clinozy — clinic operations for the front desk, doctors, pharmacy and money. Desktop 1440 and tablet 1024; phone is not designed, by decision (`_report.md:13`)                                                                                                                                                                                                 |
| Sources          | 20 docs: `PRD.md` (the product brief), `schema-routes.md` (added after this plan, not yet read — L-61), `_index.md`, `_patterns.md`, `_report.md`, `preset.md`, `design-brief-preset.md`, `shell.md` and 12 screen specs · `Clinozy.dc.html` (5,929 lines: template H:8–2754, app script H:2755–5927) · `support.js` (1,911 lines; generic runtime, not ported) |
| Planned by       | `fe-kickoff-planning` (this file)                                                                                                                                                                                                                                                                                                                               |
| Built by         | `fe-design-ditto`, with the skills named per ledger row (§9)                                                                                                                                                                                                                                                                                                    |
| Readiness gate   | `docs/design-workflow/prompts/design-intake-checklist.md` Part B, with the clinozy-fe rules in `docs/design-workflow/prompts/ditto-intake-checklist.md`                                                                                                                                                                                                         |
| Authority        | Prototype over md for behaviour. md-only additions build to the md only where §7.1 lists them. CLAUDE.md and the repo rules override both (§7.2)                                                                                                                                                                                                                |
| Evidence         | `H:n` = `Clinozy.dc.html` line n · `<spec>.md:n` = spec line n · `S:n` = `support.js` line n                                                                                                                                                                                                                                                                    |
| Coverage         | Every file read in full except `schema-routes.md`, added after this plan (L-61). The prototype union is 5,929 of 5,929 lines (Appendix A)                                                                                                                                                                                                                       |
| Reference plan   | none                                                                                                                                                                                                                                                                                                                                                            |

## 2. Locked decisions

D1–D16 are **proposed** until you confirm them; confirmed rows get a lock date. D17–D20 record your RED answers and are locked.

| #   | Decision                                                                                                                                                                                                                                                                                                                                         | Dated      | Status     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------- |
| D1  | Authority: the prototype wins behaviour; the md wins only for the md-only additions in §7.1; `preset.md` wins over `design-brief-preset.md`, whose dark JSON values lose (Appendix B, T2)                                                                                                                                                        | 2026-10-01 | proposed   |
| D2  | Scope: the 12 index screens, the shell, the preset, and the prototype-only surfaces the screens depend on (§6.0, Visit sheet §6.13). Out: Blueprint room (H:2007–2257, `shell.md:36`), the "How data connects" explainer (H:2508–2512), the signed-out overlay (H:337), and all dead markup (Appendix B.12)                                      | 2026-10-01 | proposed   |
| D3  | Routing: every clinic room is an island under `/organization/$organizationSlug/` for team deployments. No personal-workspace copies; personal-only deployments keep the Focus shell and get no clinic rooms                                                                                                                                      | 2026-10-01 | proposed   |
| D4  | URLs: a tab that switches entity is a path param owned by the room island (`$tab`, `$section`); a view that filters one entity is a search param in `<room>.search.ts` (§4)                                                                                                                                                                      | 2026-10-01 | proposed   |
| D5  | URL-driven drawers only for the primary record of single-entity rooms (Leads, Appointments, Patients, Tasks). Every other drawer, popover and child drawer is component state                                                                                                                                                                    | 2026-10-01 | proposed   |
| D6  | Data: fixtures-first. Each `*.api.ts` reads a `*.fixtures.ts` behind `REPLACE_WITH_API`; no clinic `apiClient('/api/v1/…')` literal (`contracts:drift` fails on unknown routes); Zod contracts keyed by ids with ISO datetimes. Real API only where clinozy-be has it: memberships, invitations, roles, role permissions, uploads                | 2026-10-01 | proposed   |
| D7  | Lists: cursor-shaped contracts (`{ items, nextCursor }`, the `useCursorList` keyset precedent), rendered as infinite scroll plus virtualisation with the prototype's "All … loaded" end line (`_patterns.md:38` contract, prototype UI)                                                                                                          | 2026-10-01 | proposed   |
| D8  | Release: each room manifest carries a `module` id; fixture-backed modules stay disabled in production through the existing `VITE_DISABLED_MODULES` until their API lands. No new flag                                                                                                                                                            | 2026-10-01 | proposed   |
| D9  | RBAC: routes gate on org membership plus module. In-room View/Create/Edit/Delete and the 11 abilities read one fixture access matrix (`US_PERM0` H:3392–3393, `US_ABIL0` H:3364) through one hook, `REPLACE_WITH_API` until clinozy-be issues clinic permission codes. No alias bypass (H:3102 defect)                                           | 2026-10-01 | proposed   |
| D10 | Phone (<768px): out of design scope (`_report.md:13`). Build `shell.md:69` plus the project screen tiers (§7.2); verify "no breakage" at 375px and fidelity at 1024 and 1440                                                                                                                                                                     | 2026-10-01 | proposed   |
| D11 | Theme: named preset `clinozy-zinc-pastel` (`preset.md:3`), full-surface, made the default through the `BASE_PRESET` split                                                                                                                                                                                                                        | 2026-10-01 | proposed   |
| D12 | Shell: a new fifth `AppLayout` variant, `sectionBar`, default for team deployments; the four existing variants stay untouched                                                                                                                                                                                                                    | 2026-10-01 | proposed   |
| D13 | Icons: registry only (`@/shared/icons/index.ts`), Lucide; icon-weight axis `thin` (1.5) for the prototype's 1.6 stroke (H:2860); WhatsApp and Instagram as local marks (`github-mark.tsx` precedent)                                                                                                                                             | 2026-10-01 | proposed   |
| D14 | Copy: every string is an i18n key in a per-room namespace, authored verbatim in English from the prototype; the source of the other 10 locales is open (Q-X1)                                                                                                                                                                                    | 2026-10-01 | proposed   |
| D15 | Simulation is not shipped: the prototype's fake latency and failure rates, fixed clock (now 11:00, design date Sun 27 Sep 2026, H:3196–3198) and hard-coded people are demo artefacts. Real clock (IST display) and real latency; every state they exercised is still built and tested                                                           | 2026-10-01 | proposed   |
| D16 | Build order = ledger order: preset → shell → shared primitives → Offerings → Users → Patients → Leads → Appointments → Payments + Invoice → Patient file → Tasks → Today + Visit → Medical → Clinic stock → Splash                                                                                                                               | 2026-10-01 | proposed   |
| D17 | RED-1: the Users room is the single members surface. Team = clinozy-be members joined with fixture staff profiles; "New user" sends an invitation (no admin-set passwords); Roles & access edits backend roles plus the fixture clinic matrix; the Settings modal's Members and Roles sections become links into the room                        | 2026-10-01 | **locked** |
| D18 | RED-2: both visit workspaces ship as designed — Today's Visit sheet and the patient file's 5-step flow — on one Visit model. Check-in starts the visit; completing the visit completes the appointment                                                                                                                                           | 2026-10-01 | **locked** |
| D19 | RED-3: the patient file's Overview (bento + activity timeline) ships and is the default section                                                                                                                                                                                                                                                  | 2026-10-01 | **locked** |
| D20 | RED-4: Today keeps the prototype's behaviour — 7 lanes, no Done lane; enquiry and pharmacy cards stay in their lanes ("Book" opens Leads, "Dispense" opens the sale)                                                                                                                                                                             | 2026-10-01 | **locked** |
| D21 | PRD authority: `PRD.md` states product intent. It settles product questions the prototype leaves open or only demos — roles and access, id formats, data fields, the unwired "Save & sell" — and the Appendix D defaults now follow it. It does not override prototype behaviour (D1) or your locked D17–D20; those conflicts are listed in B.13 | 2026-10-01 | proposed   |

## 3. Foundation (before any screen)

### 3.1 Theme preset `clinozy-zinc-pastel`

**Full-surface.** Today's named presets override only primary, ring, sidebar and
chart. This one sets every surface token. Values are the prototype's (H:11
light, H:12 dark); light matches `preset.md`. Dark tones use H:12's explicit
values, because the formula at `preset.md:41` only approximates them.

**Reuse check:** `[data-base='zinc']` (`src/index.css:336–361`) is shadcn zinc.
It is within ΔL ≈ 0.003 of the prototype in light, but dark differs (prototype
cards `#141417`, canvas `#0e0e10`). The preset carries its own surfaces and the
zinc base stays untouched for other looks.

**Ramp naming:** `preset.md:21` labels the ramp with the prototype's
`--color-neutral-*` aliases (H:19), which sit one step off the raw `--z*` ramp
(H:11). This plan cites hex values so the two can't be confused.

| Token                                       | Light                                                                                                                  | Dark                                                 | Prototype                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `background` (room canvas)                  | `#fafafa`                                                                                                              | `#0e0e10`                                            | `--z50`                                                                            |
| `foreground`                                | `#09090b`                                                                                                              | `#fafafa`                                            | `--z950`                                                                           |
| `card`, `popover` (cards, header, drawers)  | `#ffffff`                                                                                                              | `#141417`                                            | `--z0`                                                                             |
| `card-foreground`, `popover-foreground`     | `#09090b`                                                                                                              | `#fafafa`                                            | `--z950`                                                                           |
| `primary`                                   | `#18181b`                                                                                                              | `#f4f4f5`                                            | `--z900` (H:24)                                                                    |
| `primary-foreground`                        | `#fafafa`                                                                                                              | `#0e0e10`                                            | `--z50` (H:24; the md's dark `#141417` loses)                                      |
| `secondary`, `muted`, `accent`              | `#f4f4f5`                                                                                                              | `#1e1e22`                                            | `--z100`                                                                           |
| `secondary-foreground`, `accent-foreground` | `#18181b`                                                                                                              | `#f4f4f5`                                            | `--z900`                                                                           |
| `muted-foreground`                          | `#71717a`                                                                                                              | `#9d9da6`                                            | `--z500` (never as text on `muted` in light, §7.3)                                 |
| `border`, `input`                           | `#e4e4e7`                                                                                                              | `#2c2c31`                                            | `--z200`                                                                           |
| `ring`                                      | `#18181b`                                                                                                              | `#f4f4f5`                                            | `--z900` (H:24)                                                                    |
| `destructive` · `-foreground`               | `oklch(0.53 0.2 25)` · `#ffffff`                                                                                       | `oklch(0.67 0.2 25)` · `#141417`                     | `--k5` · `--z0`                                                                    |
| `success` · `-foreground`                   | `oklch(0.52 0.12 150)` · `#ffffff`                                                                                     | `oklch(0.66 0.12 150)` · `#141417`                   | `--k8` · `--z0`                                                                    |
| `warning` · `-foreground`                   | `oklch(0.935 0.06 85)` · `oklch(0.38 0.085 65)`                                                                        | `oklch(0.255 0.042 85)` · `oklch(0.855 0.064 65)`    | butter bg/ink (`preset.md:18`; its dark bg 0.245 loses to H:12's 0.255)            |
| `info` · `-foreground`                      | `oklch(0.925 0.04 235)` · `oklch(0.37 0.08 235)`                                                                       | `oklch(0.265 0.028 235)` · `oklch(0.86 0.06 235)`    | sky bg/ink (plan choice; the md is silent)                                         |
| `brand`                                     | `oklch(0.72 0.14 150)`                                                                                                 | same                                                 | `--k3`: logo dot, splash; non-text only                                            |
| `overlay`                                   | `#09090b`                                                                                                              | `#09090b`                                            | `rgb(9 9 11 / α)`: α .45 drawers, .35 palette, .32 delete confirm, .28 lead drawer |
| `chart-1` … `chart-5`                       | `oklch(0.52 0.12 150)` · `oklch(0.68 0.09 235)` · `oklch(0.74 0.11 75)` · `oklch(0.68 0.1 295)` · `oklch(0.68 0.1 20)` | `chart-1` `oklch(0.66 0.12 150)`; the rest unchanged | `preset.md:19`                                                                     |
| `sidebar*`                                  | z50 · z950 · z900 · z100 · z200                                                                                        | dark equivalents                                     | unused by `sectionBar`; set so other variants and Settings stay on-palette         |

**Section tones** become base-level tokens (`@theme`), so `bg-tone-*` utilities
exist under every preset: `--color-tone-<name>`, `-foreground` (ink), `-border`
(line) and `-dot`. Values are `oklch(…)` from H:11/H:12 through `TN`
(H:2757–2768); light equals `preset.md:27–39`. The dot is the same in both modes.

| Tone   | Section      | bg light / dark                   | ink light / dark               | line light / dark              | dot           |
| ------ | ------------ | --------------------------------- | ------------------------------ | ------------------------------ | ------------- |
| butter | Today        | 0.935 0.06 85 / 0.255 0.042 85    | 0.38 0.085 65 / 0.855 0.064 65 | 0.85 0.08 80 / 0.4 0.064 80    | 0.74 0.11 75  |
| lav    | Leads        | 0.925 0.045 295 / 0.265 0.032 295 | 0.37 0.09 295 / 0.86 0.068 295 | 0.83 0.06 295 / 0.4 0.048 295  | 0.68 0.1 295  |
| sky    | Appointments | 0.925 0.04 235 / 0.265 0.028 235  | 0.37 0.08 235 / 0.86 0.06 235  | 0.83 0.055 235 / 0.4 0.044 235 | 0.68 0.09 235 |
| sage   | Patients     | 0.925 0.045 150 / 0.265 0.032 150 | 0.37 0.08 150 / 0.86 0.06 150  | 0.83 0.06 150 / 0.4 0.048 150  | 0.66 0.1 150  |
| blush  | Medical      | 0.925 0.04 20 / 0.265 0.028 20    | 0.38 0.1 20 / 0.855 0.075 20   | 0.83 0.06 20 / 0.4 0.048 20    | 0.68 0.1 20   |
| mint   | Clinic stock | 0.93 0.04 190 / 0.26 0.028 190    | 0.37 0.07 195 / 0.86 0.053 195 | 0.83 0.055 190 / 0.4 0.044 190 | 0.68 0.08 190 |
| peach  | Payments     | 0.93 0.045 55 / 0.26 0.032 55     | 0.4 0.1 50 / 0.845 0.075 50    | 0.84 0.07 55 / 0.4 0.056 55    | 0.72 0.12 55  |
| plum   | Tasks        | 0.925 0.04 330 / 0.265 0.028 330  | 0.38 0.1 330 / 0.855 0.075 330 | 0.83 0.06 330 / 0.4 0.048 330  | 0.68 0.1 330  |
| lime   | Offerings    | 0.935 0.055 120 / 0.255 0.038 120 | 0.38 0.08 125 / 0.855 0.06 125 | 0.85 0.07 120 / 0.4 0.056 120  | 0.72 0.11 120 |
| slate  | Users        | 0.925 0.02 255 / 0.265 0.014 255  | 0.37 0.04 255 / 0.86 0.03 255  | 0.83 0.03 255 / 0.4 0.024 255  | 0.66 0.05 255 |
| stone  | fallback     | `--z100`                          | `--z700`                       | `--z200`                       | `--z300`      |

**Colour map.** The prototype paints with 13 neutral steps (`--z*`) and 127
accent variables (`--k*`), and every one is used. Appendix E maps each to a token,
with its ΔE (OKLab distance, the larger of light and dark):

- 75 map exactly: the ten tones, the semantic tokens and the new tokens below.
- 31 (89 uses) sit within ΔE 0.03 of a token and map to it.
- 34 (51 uses, one to three each) are farther. They map to the nearest token and
  are confirmed side by side (L-57); if a comparison fails, add a tone step —
  never a raw value.

The 25 new tokens take their values from the prototype colour they replace:

| Token                                                   | From                                                        | Role                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `hover`                                                 | `--z150`                                                    | hover and focus wash (125 uses)                                                           |
| `border-strong`                                         | `--z300`                                                    | stronger borders, scrollbar thumb (241 uses)                                              |
| `disabled`                                              | `--z400`                                                    | disabled text, placeholders, idle icons (156 uses)                                        |
| `muted-foreground-strong`                               | `--z600`                                                    | secondary text, and any text on `muted` (324 uses)                                        |
| `foreground-soft`                                       | `--z700`                                                    | body text one step down (228 uses)                                                        |
| `foreground-strong`                                     | `--z800`                                                    | emphasis text (85 uses)                                                                   |
| `destructive-tint` · `destructive-border`               | `--k6` · `--k86`                                            | danger hover wash and border on row actions                                               |
| `highlight`                                             | `--k34`                                                     | the search-match `<mark>`                                                                 |
| `assist`                                                | `--k30`                                                     | the AI "Suggest" accent                                                                   |
| `tone-sage-tint` · `tone-butter-tint` · `tone-lav-tint` | `--k35` · `--k32` · `--k113`                                | pale washes: steppers and reviewed rows; "Quick fill" chips; the lead contact-card header |
| `success-strong`                                        | `--k101`                                                    | "Read", trend up                                                                          |
| `channel-whatsapp`, `-tint`                             | `--k117`, `--k102`                                          | WhatsApp send button and chips                                                            |
| `channel-call`, `-tint`, `-foreground`                  | `--k118`, `--k14`, `--k103`                                 | calls                                                                                     |
| `channel-note`                                          | `--k119`                                                    | notes and SMS                                                                             |
| `channel-instagram`, `-tint`, `-foreground`             | `#DD2A7B` (a raw literal in the script), `--k104`, `--k105` | Instagram                                                                                 |
| `now-indicator`                                         | `--k46`                                                     | the calendar now-line                                                                     |
| `presence-online`                                       | `--k88`                                                     | the online presence dot                                                                   |

The names are proposals for the theme-catalog review (L-03); the values are not.
No digits in names.

Raw colour literals in the markup map too:

- `rgb(0 0 0 / α)` shadows (about 190 uses) → the preset's elevation tokens;
- `rgb(9 9 11 / α)` overlays → `overlay` at .45, .4, .35 and .78;
- `rgb(255 255 255 / α)` on dark surfaces → `primary-foreground` with alpha;
- `rgb(161 161 170 / .25)` input glow → replaced by the focus ring (§7.3);
- `rgb(244 244 245 / .75)` → `muted` at 75%;
- `#333` and `#555` (print only) → `foreground` and `muted-foreground` in the
  light-locked print scope;
- `#dc2626` → `destructive`; `#DD2A7B` → `channel-instagram`.

**Shape and density**

- **Radius:** base `0.5rem`, which gives `rounded-sm` 4 (kbd), `rounded-md` 6
  (inner controls, tab triggers, tooltip), `rounded-lg` 8 (controls, list cards)
  and `rounded-xl` 12 (panels, popovers, table cards, drawer ×). Pills, avatars
  and chips use `rounded-full` with `data-slot="pill"`. The 2–3px bars use
  `rounded-xs`. (Prototype radius counts: 8px ×783, 999 ×452, 6px ×399,
  12px ×217, 4px ×128.)
- **Shadows** (`preset.md:77`): sm, md, lg on floating layers only. The drawer
  panel uses `-16px 0 40px rgb(0 0 0/.14)` (H:1574).
- **Compact viewport rule:** `@media (max-width: 1439px), (max-height: 799px)`
  sets the spacing variables from the prototype's `ui` table (H:5881):

  | Variable        | Normal              | Compact             |
  | --------------- | ------------------- | ------------------- |
  | Toolbar padding | 16px 20px           | 12px 12px           |
  | Room gutter     | 0 20px 20px         | 0 12px 12px         |
  | Table row       | 10px 20px 10px 17px | 10px 16px 10px 13px |
  | Drawer header   | 14px 24px           | 12px 20px           |
  | Drawer body     | 20px 24px 28px      | 16px 20px 20px      |
  | Footer x        | 24px                | 20px                |
  | Text inset      | 20px                | 16px                |
  | Step card       | 14px 16px           | 12px 14px           |
  | Field gap       | 16px 12px           | 12px 10px           |

  The drawer header height stays 76px in both.

- **Focus:** the prototype's inset tint fails WCAG 1.4.11 (1.15 light, 1.17
  dark). Keep the tint and add the visible `ring` (§7.3).

**Type, fonts and scrollbars**

- **Fonts:** self-host `@fontsource/inter` (400, 500, 600, 700) and
  `@fontsource/jetbrains-mono` (400, 500). The platform stacks already name both
  (`src/index.css:96–98`). CSP `font-src 'self'` blocks the prototype's Google
  Fonts link (H:15–16). The dependency and `pnpm-lock.yaml` land in one atomic
  commit.
- **Type scale:** 11.5 · 12 · 13 · 14 · 16 · 20px (`preset.md:68`). The Today
  greeting is 23px (H:401) and the Visit sheet name 21px.
  - h1: 20/600, −0.015em.
  - Drawer title: 18/600.
  - Tooltip: 11.5/500.
- **Scrollbars:** 10px pill thumb `#d4d4d8` (`#a1a1aa` on hover), transparent
  track, `scrollbar-gutter: stable` (`preset.md:84`). The prototype's earlier
  8px rule (H:27–33) is overridden and dead.

**The four registration points** (`docs/design-workflow/prompts/README.md:52–62`):

1. **`src/index.css` theme blocks:** `[data-theme='clinozy-zinc-pastel']` and
   `.dark[data-theme='clinozy-zinc-pastel']`. They hold every token above plus
   the compact rule; tone defaults go in `@theme`.
2. **`src/index.css` swatch:** `.theme-dot-clinozy-zinc-pastel`. Finding: named
   presets render as text in the picker, so no preset swatch is drawn today.
   Register it anyway and log the picker gap (L-04).
3. **`src/shared/theme/presets.ts`:** add `{ id: 'clinozy-zinc-pastel', label:
'Clinozy' }` to `THEME_PRESETS`. Set `DEFAULT_PRESET` to it and add
   `BASE_PRESET = 'default'` for the stock palette, which `README.md:60–62`
   proposes but no code has yet. Add a persisted-preference migration test.
4. **`public/theme-init.js`:** add `PRESET_PRIMARY['clinozy-zinc-pastel']`,
   light `#18181b` / dark `#f4f4f5` in OKLCH, and update
   `boot-theme-vars.drift.test.ts`.

The preset also defaults the icon-weight axis to `thin`. Update the theme
catalog docs (`validate:theme-catalog`) and `docs/reference/theming.md`, then
run `fe-theme-axis-audit`.

**Contrast**, recomputed locally rather than trusted (method:
`scratchpad/contrast.mjs`, which becomes a unit test in L-05):

| Pair                                         | Light                                        | Dark        | Verdict                                                                                                         |
| -------------------------------------------- | -------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `primary-foreground` on `primary`            | 16.97                                        | 17.54       | pass                                                                                                            |
| `muted-foreground` on `card` / `background`  | 4.83 / 4.63                                  | 6.84 / 7.17 | pass                                                                                                            |
| `muted-foreground` on `muted`                | **4.40**                                     | 6.18        | **fail in light**: use `#52525b` (7.03; dark `#b4b4bc` 8.07) for text on `muted`, e.g. segmented tabs (H:50–54) |
| white on `success`                           | 5.21 (md claims ≈5.5)                        | 6.22        | pass                                                                                                            |
| white on `destructive`                       | 5.86 (md claims ≈5.3)                        | 5.60        | pass                                                                                                            |
| tone ink on tone bg, all 10                  | 7.68–8.54 (peach lowest; md claims ≈8.0–8.4) | 9.55–10.25  | pass                                                                                                            |
| selected tone (ink fill, card-coloured text) | 9.6–10.6                                     | 11.2–12.3   | pass                                                                                                            |
| tone dot on tone bg                          | 1.9–2.5                                      | —           | decorative only: always beside a text label                                                                     |
| `brand` dot on `card`                        | 2.35                                         | —           | logo only                                                                                                       |
| disabled text `#a1a1aa`                      | 2.56                                         | —           | exempt (WCAG 1.4.3, disabled)                                                                                   |
| focus tint `#efeff1` on `#ffffff`            | **1.15**                                     | 1.17        | **fails 1.4.11**: add a ring (§7.3)                                                                             |

### 3.2 Shell: new variant `sectionBar`

One header bar and no sidebar (`shell.md:7`). It is a **new** fifth
`AppLayout` variant, never an overwrite of `topNav`.

| Slot | Contents (prototype)                                                                                                                                                                                                                                                                                              | Desktop · tablet                                        | Phone (<768px, D10)                      | Evidence                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| 1    | Mark: 28px rounded square in `primary`, white "C", `brand` dot; wordmark "clinozy"                                                                                                                                                                                                                                | kept                                                    | mark only below 480px                    | `shell.md:18`, H:346–366                                                    |
| 2    | "All sections": 32px button, compass icon and count badge → popover `min(280px, 100vw − 32px)`. Each item has a tile, label, description, badge and pin. Dividers after Today · Patients · Payments · Offerings · Users. Footer: "Pin to keep in the bar · this device" · "G · 1–9"                               | kept                                                    | becomes the phone nav (`shell.md:57–58`) | `shell.md:19, 39`; H:346–366. md 36px, no count → prototype 32px with badge |
| 3    | Pinned tabs, 32px. Default: Appointments · Leads · Patients · Payments. The selected tab is tinted in its section tone. An unpinned open section shows as a temporary tab with a 5px dot, "Not pinned · shown while open". Overflow "More ⌄" from the right; it opens on hover after 120ms and closes after 220ms | folds into More when the bar can't fit tabs plus search | hidden                                   | `shell.md:20, 40`; H:346–366; I1                                            |
| 4    | Search button "Search patients, leads…" with a ⌘K kbd, `flex: 0 1 240px` → command palette                                                                                                                                                                                                                        | kept                                                    | 36px icon button                         | H:346–366. md has a "Search" field (min 170px); the prototype button wins   |
| 5    | Notifications bell and a Tasks shortcut                                                                                                                                                                                                                                                                           | md-only, built to the md (§7.1)                         | icon buttons                             | `shell.md:22, 51`                                                           |
| 6    | Branch picker, 32px: pin icon, count, chevron. Multi-select with "All branches"; hidden with one active branch or fewer                                                                                                                                                                                           | kept                                                    | kept                                     | `shell.md:23`; H:366, H:5869                                                |
| 7    | Avatar, 32px, with a presence dot → user menu, 260px                                                                                                                                                                                                                                                              | kept                                                    | kept                                     | H:366–372. md 28px → prototype 32px                                         |

- **Header height** is 60px (H:346); the md's 56px loses.
- **User menu** (H:367–372), top to bottom:
  - header: 40px avatar, name, role, email;
  - "Status" radiogroup: Online · Away · Busy;
  - "Appearance": Light · Dark · System;
  - the relocated platform rows (table below);
  - "Log out" in `destructive`.
- **View-as bar** (H:375): a fixed pill, 16px side insets, `bottom: 72px` (it
  rides above `--floating-bottom-offset`), 44px tall, `role="status"`, 160ms
  `czddup`. Copy: "Previewing as {role}", then the sections or "No sections",
  then "Exit preview".
- **Nav order** (`shell.md:36`): Today `House` · Leads `UserPlus` · Appointments
  `Calendar` · Patients `Users` · Medical `Pill` · Clinic stock `Package` ·
  Payments `Wallet` · Tasks `SquareCheck` · Offerings `Tag` · Users `Shield`. A
  room shows only with View access (`useVisibleNav`).

**Platform-surface relocation** — relocate, never delete:

| Platform surface                                                                                                                                                                                                          | Today                                                    | In `sectionBar`                                                                                                                                                                            | Evidence                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Brand logo / wordmark (`BrandLogo`, `AppLayout.shared.tsx:133–142`; a Lucide Boxes chip)                                                                                                                                  | header or sidebar, all four variants                     | header slot 1: the Clinozy mark (28px `primary` square, white "C", `brand` dot) and "clinozy". The same mark replaces `public/app-icon.svg`, the PWA icons and the HTML splash mark (L-59) | `shell.md:18`; H:346–366 |
| Primary nav (`NAV_ITEMS`, `AppLayout.shared.tsx:62–74`)                                                                                                                                                                   | sidebar list; `dashboard` segment hard-coded (`:84–117`) | pinned tabs + All sections; generalised to manifest-driven nav (L-12)                                                                                                                      | `shell.md:48`            |
| Org switcher (`OrganizationSwitcher`)                                                                                                                                                                                     | sidebar header                                           | user-menu row "Switch clinic"; it self-hides without team orgs. `shell.md:49` maps it to the branch picker, but a branch is not an org                                                     | `shell.md:49`            |
| ⌘K palette (`CommandPaletteLazy`, `:100–109`)                                                                                                                                                                             | sidebar search trigger                                   | header search button + ⌘K. The palette's nav group, hard-coded to Dashboard (`CommandPalette.tsx:111–146`), becomes manifest-driven                                                        | `shell.md:50`            |
| Notifications (`NotificationCenter`)                                                                                                                                                                                      | header bell                                              | header slot 5                                                                                                                                                                              | `shell.md:51`            |
| Mode toggle (`ThemeModeToggle`)                                                                                                                                                                                           | header                                                   | user menu "Appearance"                                                                                                                                                                     | H:367–372                |
| User menu and sign-out (`UserMenu`, `:203–279`)                                                                                                                                                                           | sidebar footer                                           | avatar menu; "Log out" calls `logout({ reason })`                                                                                                                                          | `shell.md:53`            |
| Settings entry (`:258–266`)                                                                                                                                                                                               | user menu                                                | user menu "Settings" (`#settings/…`), kept although the prototype menu lacks it                                                                                                            | `shell.md:54`            |
| Account shortcuts: profile, security, billing, appearance, devices                                                                                                                                                        | `AppContextStrip` (Focus)                                | user-menu rows deep-linking `#settings/<scope>/<section>`                                                                                                                                  | `shell.md:55`            |
| `SidebarQuickLinks`                                                                                                                                                                                                       | sidebar only                                             | not mounted; the same entries via user menu and palette                                                                                                                                    | —                        |
| `EmailVerificationBanner` (`AppMain`, `:495–501`)                                                                                                                                                                         | under the header                                         | full-width 36px strip under the header                                                                                                                                                     | `shell.md:56`            |
| `MobileNav` bottom bar (`:348–379`)                                                                                                                                                                                       | `md:hidden`                                              | not mounted: ten rooms don't fit; the phone nav is the All sections popover                                                                                                                | `shell.md:57`; D10       |
| Mobile menu trigger (sidebar toggle)                                                                                                                                                                                      | Sidebar variant only                                     | the All sections button                                                                                                                                                                    | `shell.md:58`            |
| Keyboard shortcuts (`KeyboardShortcutsLazy`)                                                                                                                                                                              | AppLayout                                                | unchanged; the "G · 1–9" copy depends on Q-S2                                                                                                                                              | I1                       |
| Root and AppLayout surfaces: Settings modal, appearance handle, Appearance dialog, offline indicator, route announcer, consent banner, toaster, progress bar, skip link, workspace-switch overlay, session-timeout dialog | root / AppLayout                                         | unchanged; toasts render above drawers (§7.3)                                                                                                                                              | —                        |

**Make-it-live contract:**

1. `APP_SHELL_VARIANT.sectionBar = 4` and
   `PREVIEW_VARIANTS = [sectionBar, sidebar, topNav, rail]`. The default,
   non-persisted `appVariant` 0 then resolves to `sectionBar` for team
   deployments; personal-only still resolves to `focus`
   (`resolve-app-shell.ts`).
2. `SHUFFLE_TEMP.appLayout` stays `false`, so shuffle stays pinned off.
3. `appVariant` stays out of persistence (`useThemeStore` partialize deletes it,
   `useThemeStore.ts:260`), so no stored value can override the default.
4. `resolve-app-shell.test.ts` pins item 1; shell test ids follow
   `fe-e2e-testids`.

The `fe-design-ditto` surface-audit table (`SKILL.md:204–217`) has four errors,
fixed in L-11:

- the mobile trigger is Sidebar-only;
- the settings entry is in `UserMenu` in all four variants;
- Focus omits the org switcher only in personal-only;
- the launcher's last item is keyboard shortcuts, not devices.

### 3.3 Stores

| Store                                                                | Scope and shape                                                                                                                                                                                                   | Persisted          | Default                                                                                                                                                   | Why                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDevicePrefsStore` (new, `src/shared/store/useDevicePrefsStore/`) | This device: `navPins`, `filePins`, `hiddenColumns[tableId]`, `savedViews[tableId]` (filter values, no free-text search), `photoSize`, `pickerRecent[pickerId]` (≤3 ids — never names or phones), `leadChatWidth` | yes, versioned key | `navPins` appointments, leads, patients, payments · `filePins` clinical notes, visits, prescriptions, invoices · `photoSize` medium · `leadChatWidth` 420 | Replaces `cz.navPins`, `cz.ptPins`, `cz.imgSz`, `cz.ddRec` (I1, I2). The copy says "this device". `useUIStore` is deliberately ephemeral and `useThemeStore` is theme-only, so neither fits |
| `useUIStore` (extend)                                                | `previewRole: string \| null` for View-as                                                                                                                                                                         | no                 | `null`                                                                                                                                                    | Ephemeral session UI, like the palette flags it already holds                                                                                                                               |
| `useThemeStore` (unchanged)                                          | Light / Dark / System from the user menu                                                                                                                                                                          | yes (existing)     | —                                                                                                                                                         | Replaces `cz.theme`                                                                                                                                                                         |
| Branch selection                                                     | Per device (the prototype writes `cz.branches` but never restores it, H:2952) or per user (server)?                                                                                                               | Q-U7               | All branches                                                                                                                                              | Decision                                                                                                                                                                                    |

**Never in Zustand:** no record (patient, lead, appointment, invoice and so on).
TanStack Query owns them. The lead-hold days (default 3, H:3783) are an org
setting served by the fixture, not a device preference.

### 3.4 Icons

Registry only. Each add is four edits: `index.ts` (`makeIcon`), `icon-names.ts`
(union), `iconset-tabler.ts` and `iconset-phosphor.ts`. The `Record` type forces
a Tabler and a Phosphor equivalent for every name. Glyph choices were checked
against the prototype's path data (H:2793–2858).

| Export (new)                     | Lucide                           | Used for                                                                          |
| -------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `ArrowDownLeft` · `ArrowUpRight` | arrow-down-left · arrow-up-right | Payments "Receive" · "Pay"                                                        |
| `ArrowLeft`                      | arrow-left                       | patient-file Back; user-menu "Log out"                                            |
| `ArrowUpDown`                    | arrow-up-down                    | idle sort header                                                                  |
| `Calendar`                       | calendar                         | Appointments nav, "Book it", slot chips                                           |
| `Camera`                         | camera                           | Photos                                                                            |
| `ChevronDown`                    | chevron-down                     | picker triggers                                                                   |
| `CircleCheck`                    | circle-check                     | status done, closed-day report; the registry's `CheckCircle` is a different glyph |
| `Clock`                          | clock                            | working hours, reminders                                                          |
| `Compass`                        | compass                          | All sections                                                                      |
| `FileIcon`                       | file                             | Reports, Log usage, bulk Export                                                   |
| `Folder`                         | folder                           | patient-file section popover                                                      |
| `House`                          | house                            | Today nav, Walk-in preset, "In clinic today" view                                 |
| `ImageIcon`                      | image                            | photo placeholders                                                                |
| `Info`                           | info                             | notes and hints                                                                   |
| `LayoutGrid`                     | layout-grid                      | Overview section, Browse panel                                                    |
| `LinkIcon`                       | link                             | review links                                                                      |
| `ListFilter`                     | list-filter                      | Filters button                                                                    |
| `Lock`                           | lock                             | locked ledger rows                                                                |
| `MapPin`                         | map-pin                          | Branches tab, branch picker                                                       |
| `MessageSquare`                  | message-square                   | Team notes, channels, bulk Message                                                |
| `Package`                        | package                          | Clinic stock nav, Packages                                                        |
| `Pause` · `Play`                 | pause · play                     | offer Pause / Resume                                                              |
| `Pencil`                         | pencil                           | Edit actions                                                                      |
| `Phone`                          | phone                            | call channel, Phone call preset                                                   |
| `Pill`                           | pill                             | Medical nav, Rx                                                                   |
| `Printer`                        | printer                          | Print                                                                             |
| `Receipt`                        | receipt                          | Payments tab, invoices, sales                                                     |
| `RefreshCw`                      | refresh-cw                       | Pending tab, Re-target, Movements, Recall, Adjust count                           |
| `Send`                           | send                             | composer Send                                                                     |
| `SquareCheck`                    | square-check                     | Tasks nav and selected chips (the prototype's `check` draws a box, H:2810)        |
| `Stethoscope`                    | stethoscope                      | Clinical notes                                                                    |
| `Tag`                            | tag                              | Offerings                                                                         |
| `Wallet`                         | wallet                           | Payments nav, Collect, Give back                                                  |
| `WhatsAppMark` · `InstagramMark` | local marks                      | channels, sources, contact reach                                                  |

- **Name collisions:** `FileIcon`, `ImageIcon` and `LinkIcon` avoid shadowing
  DOM `File`/`Image` and the router's `Link`. Confirm against the registry's
  naming convention (L-08).
- **Reused:** Bell, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Copy, Eye, EyeOff, Mail, Menu, Minus, Moon, MoreHorizontal, Plus, Search,
  Shield, Sparkles, Sun, Trash, UserPlus, Users, X, XCircle, ArrowUp, ArrowDown,
  Loader.
- **Not added:** `net` (explainer is out), `clipboard` (Blueprint), and `cols`,
  `cmf`, `cmp`, `filt` (unbound or dead).

### 3.5 Shared primitives (built once, before any screen)

The prototype duplicates its table markup in six rooms (I1). The rebuild has
**one** of each.

| Primitive                                     | Reuse or add                                                                                                                                   | Behaviour (source)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data table                                    | **Extend** `src/shared/components/DataTable` and its ColumnHeader, Toolbar and Pagination (`@tanstack/react-table` v9). Never a parallel table | `mkTable`/`dtVM`, H:3516–3672 and H:3855–3964. **Layout:** sticky header outside the scroller (40px, 11px uppercase); 3px status edge; row padding per §3.1; 24px hover checkbox, tri-state header, shift-range; sticky right actions with shadow (32px buttons, 13px icons, danger last after a separator). **Sort:** asc → desc → off. **Virtualise:** above 60 rows, overscan 10, 52px rows. **Fold engine:** available = width − 78; rank id 0, low-label regex 1, others 2, right-aligned 4; primary, actions and locked columns never fold; 11.5px meta line; footer "N column(s) in rows · Show all" ↔ "Fit to width". **Columns:** default-hidden per table; chooser "Columns · N of M shown" / "Show all columns". **End line:** "All … loaded". **Bulk bar** replaces the footer (220ms): "N selected · Select all N · actions · Esc ×"                                                                                                                                                                                                                                                          |
| Room toolbar                                  | Add                                                                                                                                            | Order (H:907): h1 (20/600, hairline) · tabs (segmented, `muted` track) · spacer · search (36→200px in 220ms, "/" focuses, 300ms debounce, `#` stripped) · saved views · Filters (count badge, joined clear ×) · Columns · primary action (plain or split)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Filters popover                               | Add                                                                                                                                            | 340px (560px in Appointments). Sections stay pending until "Apply filter"; a backdrop click discards them. Auto chip sections come from badge columns with 2–10 values. "Created": Any · Today · Yesterday · Last 7 days · Last 30 days · This month · Custom range; "Follow-up date" where it applies; "Save as view". Flips and clamps (H:3964–3973); Esc closes (md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Record drawer                                 | Add on shadcn `sheet` (side right)                                                                                                             | `mkDrawer`, H:3541–3640. **Width:** 560 (≤8 simple fields) / 680 / 840 (items table) / explicit, as `min(W, 100vw − 56px)`. **Motion:** overlay `bg-overlay/45` and panel 340ms `cubic-bezier(.32,.72,0,1)`; floating 36px × (radius 12) outside the left edge, `czpop` 200ms after 200ms on every drawer (md). **Header:** 76px; title 18/600, tag, sub, badges; "Quick fill" ⚡ presets; type switch. **Steps:** accordion, 24px circle — open = section tone ink, passed = `success`, missing = `destructive` "!", future = `border`; peek grid; "Missing: …"; "Next: <step> →"; `czacc` 240ms. Auto-split: a single section with ≥4 fields becomes Details/Payment/Notes; more than 3 groups merge into 3. **Fields:** 6-column grid, full/half/third. **Footer:** summary · Delete · Cancel (stacked: Back) · Save & add another · "Not saved · your changes are kept" · Save ("Saving…", "Retry save"). Read-only: "View only · your role can’t change this". Child drawers stack; Esc closes the top one; initial focus, focus trap and focus return (md); dirty guard and Save-when-dirty per Q-P1 |
| Picker                                        | Add on shadcn `popover` + `command`                                                                                                            | The dropdown engine, H:3696–3762. **Trigger:** 32/36/44px; multi pills ≤3 then "+N". **Search:** when dynamic, remote or more than 7 options; local debounce 250ms, remote 300ms. **Recent:** up to 3, in device prefs. **Rows:** 36px. **Keys:** ↑ ↓ PgUp PgDn Home End Enter Esc Tab, type-ahead. **Load more:** pages of 30. **Size:** width max(trigger, 240px), height ≤340px, flips. **Create:** "<Create> “q”". **Empty:** "No results for “q”". **Loading:** 4-row skeleton                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Date and time pickers                         | **Reuse** `LocalizedCalendar` (react-day-picker v10)                                                                                           | 260px popover with « ‹ Month › »; quick chips; time in 30-minute steps 06:00–23:30; date list grouped Today / Coming up / <Mon YYYY> with "Type a date · e.g. 12 sep". Week start: Q-A10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Reason confirm (delete, void, cancel, revert) | **Extend** `ConfirmDialog`, or justify a new unit in the PR                                                                                    | `askDel`, H:2479 and H:4205–4213. Right drawer `min(480px, 100vw − 56px)`, `alertdialog`, backdrop α .32. Title "<Verb> this <kind>?"; record pill; body by kind; reason chips per kind; note ≤160 chars, required for "Other"; "Keep it" plus a destructive action, disabled until valid; toast "<name> removed" with Undo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Toasts                                        | **Reuse** `notify`                                                                                                                             | Bottom-centre, 16px up, dark; 5,200ms, errors 9,000ms with "Retry"; "Undo" action; one at a time. They render **above** drawers (the prototype renders them under, a defect, H:2480)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Hover cards                                   | Add on shadcn `hover-card`                                                                                                                     | **Contact card:** 320 × ≤520px, opens after 280ms, hides after 220ms. **Team card:** 320px, opens after 160ms, hides after 200ms (I1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Empty state                                   | **Reuse** `EmptyState`                                                                                                                         | 96px dashed ring, tinted disc, 40px tile, 18px icon; title and hint; "Clear filters" or create action (I1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Skeletons and tooltip                         | **Reuse** `skeleton`, `tooltip`                                                                                                                | In-place shimmer 1.1s (dropdown rows 1.2s). Tooltip shows after 160ms; touch hides after 1,400ms; hides 60ms after a click; 11.5/500                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cells                                         | Add small shared units                                                                                                                         | tone pill, person cell (avatar, name, sub, "P" badge), avatar stack (+N), id pill, money cell. Money: ₹ with Indian grouping (`inrF`, H:3350) and "−" U+2212 for negatives, through the existing money and date formatting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Print templates (invoice, sale, Rx)           | Add                                                                                                                                            | H:256–336. A4 210 × 297mm, Arial 3.25mm, letterhead space 38.1mm top and 23.3mm left; 260ms → rAF → `window.print()`, cleanup on `afterprint`. Clinic name, phone and GSTIN come from org/branch settings, never the "Cresence Skin" literals (H:332–333)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Upload tray                                   | **Reuse** clinozy-be generic uploads                                                                                                           | Bottom-right, 320px: "Uploading N of M…" / "All uploads complete"; a done row leaves after 1,400ms. Size limit: Q-P5 (BE caps 10MB; the prototype allows 15MB photos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

shadcn primitives to add (`pnpm dlx shadcn@latest add …`, `shadcn` skill):
`sheet`, `tabs`, `toggle-group`, `hover-card`, `command`, `accordion`,
`scroll-area`, `radio-group`, `resizable`.

### 3.6 Data layer and contracts

- **Where code lives:**
  - Domains used by two or more rooms (patients, contacts, appointments, staff,
    branches, offerings, invoices and payments, tasks) go in
    `src/shared/api/clinic/`, as `<domain>-contracts.ts`, `<domain>-api.ts` and
    `<domain>.fixtures.ts`.
  - Room-private domains go in the island, as `<room>.contracts.ts`,
    `<room>.api.ts` and `<room>.fixtures.ts`.
- **Contracts:** Zod schemas; types are inferred, never hand-written.
  - Relations are by id. The prototype joins by name (B, D, E reports), and
    that is a defect.
  - Datetimes are ISO 8601. The prototype stores display strings such as
    "Today 10:12" and "24 Sep".
  - Branded ids reuse `src/core/types/branded.ts` (`PatientPublicId`,
    `AppointmentPublicId`, `InvoicePublicId`) and add the rest.
  - Money precision is Q-X3.
- **Hooks:** Query hooks wrap the api functions. Mutations go through
  `useAppMutation` (single-flight) with toasts, and Undo where the prototype
  offers it.
- **Fixtures** are seeded from the prototype's seed data and converted to the
  contracts. The prototype's duplicate patient sets (`PT_SEED` vs `PATIENTS`) merge into one. The prototype's seeds come first so
  side-by-side screenshots match; the PRD's sample records (PRD.md:168) are added
  alongside.

### 3.7 Access

- **Route gate:** `gatewayFromManifest` (session → module → permission
  `organization:read`), then `requireOrgStatus` — the existing leaf pattern.
- **In-room:** `useClinicAccess()` returns `can(section, action)`,
  `canAbility(key)` and the preview role. It reads the fixture matrix
  (`US_PERM0`, `US_ABIL0`) for the member's clinic roles; access is the union
  across roles, and Admin is always full.
  - Effects match the prototype: create buttons hide (H:227), row actions filter
    (H:4327), drawers go read-only (H:3542).
- **Gaps the prototype left open, closed here:**
  - the palette respects access (H:4361–4364);
  - alias rooms don't bypass (H:3102);
  - the Users room is gated (H:4904);
  - Pay and Day close are gated (G report);
  - Remove lead and Save lead are gated (D report).

  Which screens enforce the nine unused abilities is Q-U8.

- **Users (D17)** gates on real platform codes, not the fixture matrix: the route
  needs `membership:read`; inviting, removing and changing roles need
  `invitation:manage`, `membership:manage` and `role:manage`. The fixture matrix
  still governs the clinic modules.
- **View-as:** `previewRole` narrows `useClinicAccess`. Where "Exit preview"
  lands is Q-U11.

### 3.8 Copy, i18n and formats

- **Namespaces (11 new):** `today`, `leads`, `appointments`, `patients`,
  `patient-file`, `medical`, `clinic-stock`, `payments`, `tasks`, `offerings`,
  `users`. Generic table and drawer chrome goes in `common`; shared clinic
  vocabulary (statuses, roles) goes in `clinic`.
- **Per namespace:** `namespaces.ts`, 11 loaders (`i18n-resources.multi.ts`),
  11 JSON files, `localizedRoute([NS])`, and `<ROOM>_NS` / `<ROOM>_KEYS`
  constants. Manifest titles need bootstrap keys. A new namespace needs a
  dev-server restart (`fe-i18n-constants`).
- **Parity gate:** all 11 UI locales must carry every key (no partial locales).
  The source of the 10 non-English files is Q-X1.
- **Print and message languages:** English / ગુજરાતી / हिंदी (Rx print, Visit
  sheet, Blueprint) are not UI locales — Gujarati isn't one. Q-X2.
- **Formats:**
  - ₹ with Indian grouping (`toLocaleString('en-IN')`, H:3350).
  - Dates: "Wed 30 Sep 2026", "27 Sep – 3 Oct", "Sep 24 · 15:39".
  - Relative time: "Just now", "N min ago", "Yesterday", "N days ago".
  - IST shown in full-date titles (H:5901).
  - Phones display "+91 98765 43210" and are stored E.164.

## 4. Route / island map

Every clinic island lives under
`src/pages/organization/$organizationSlug/`, the org guard boundary. Each is
registered as a child of the org route (`addChildren`,
`src/app/routes/routeTree.tsx:560–563`) with the existing leaf pattern:

- `beforeLoad`: `if (preload) return`, then
  `gatewayFromManifest(manifest)(toGateContext(location, params))`, then
  `requireOrgStatus`;
- `head: manifestHead(manifest)`;
- `errorComponent: RouteErrorBoundary`;
- `lazyRouteComponent(localizedRoute([NS], …))`.

The URL column omits the `/organization/$organizationSlug` prefix. "Access"
lists the default View roles from `US_PERM0` (H:3392–3393); the route itself
gates on membership plus module (D9). Folder file prefixes follow the strip-`$`
kebab rule.

| URL                             | Folder                          | Kind                                                                                                                                      | Module         | Access (View)                                                                                   | Search params                                                                                                                 |
| ------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/today`                        | `today/`                        | page                                                                                                                                      | `today`        | every member (H:4195 shows Today to all)                                                        | `lane` (focused lane), `queue` (`mine` \| `everyone`)                                                                         |
| `/visits/$visitId`              | `visits/` (owns the param)      | full-screen page (D18: one Visit model)                                                                                                   | `today`        | Doctor, Therapist, Front desk, Counsellor, Admin (proposed)                                     | `tab` (`history` \| `consult` \| `treatment` \| `checkout`)                                                                   |
| `/leads`                        | `leads/`                        | page                                                                                                                                      | `leads`        | Admin, Doctor, Front desk, Counsellor                                                           | `view` (`mine`* \| `unreplied` \| `all`), `q`, `status`, `source`, `hold`, `team`, `created`, `followUp`, `sort`              |
| `/leads/create`                 | `leads/create/`                 | URL-driven dialog (renders `null`)                                                                                                        | `leads`        | + Create                                                                                        | `contact`, `preset` (prefill)                                                                                                 |
| `/leads/$leadId`                | `leads/$leadId/`                | URL-driven drawer (detail + chat)                                                                                                         | `leads`        | as `/leads`                                                                                     | —                                                                                                                             |
| `/appointments`                 | `appointments/`                 | page                                                                                                                                      | `appointments` | Admin, Doctor, Front desk, Counsellor; Therapist view-only                                      | `view` (`agenda`* \| `day` \| `week` \| `month`), `date` (ISO), `doctor`, `q`, `status`, `appointedTo`, `created`, `followUp` |
| `/appointments/create`          | `appointments/create/`          | URL-driven dialog                                                                                                                         | `appointments` | + Create                                                                                        | `date`, `time`, `who`, `kind` (prefill from slot click, "Book it", contact card)                                              |
| `/appointments/$appointmentId`  | `appointments/$appointmentId/`  | URL-driven dialog (booking drawer, edit)                                                                                                  | `appointments` | as `/appointments`                                                                              | —                                                                                                                             |
| `/patients`                     | `patients/`                     | page                                                                                                                                      | `patients`     | Admin, Doctor, Front desk, Counsellor, Pharmacist; Therapist view-only                          | `view` (`all`* \| `in-clinic-today` \| `with-dues` \| `follow-up-due` \| `recall`), `q`, filters, `sort`                      |
| `/patients/create`              | `patients/create/`              | URL-driven dialog                                                                                                                         | `patients`     | + Create                                                                                        | `preset`, `contact`                                                                                                           |
| `/patients/$patientId`          | `patients/$patientId/`          | layout (file bar, rail, Activity); index redirects to `overview`, the default section (D19)                                               | `patients`     | as `/patients`                                                                                  | `activity` (panel open)                                                                                                       |
| `/patients/$patientId/$section` | `patients/$patientId/$section/` | page; `$section` ∈ overview, clinical-notes, visits, prescriptions, treatments, photos, reports, invoices, payments, packages, team-notes | `patients`     | per-section rules (Q-F1)                                                                        | `album`, `visit` (Photos)                                                                                                     |
| `/patients/$patientId/edit`     | `patients/$patientId/edit/`     | URL-driven dialog over the file                                                                                                           | `patients`     | + Edit                                                                                          | —                                                                                                                             |
| `/medical/$tab`                 | `medical/` (owns the param)     | page; `$tab` ∈ sales, medicines, purchases, suppliers, manufacturers, mrs, payments                                                       | `medical`      | Admin, Pharmacist; Accountant view-only                                                         | `q`, `stock`, `expiry`, `status`, `stage`, `sort`                                                                             |
| `/stock/$tab`                   | `stock/` (owns the param)       | page; `$tab` ∈ items, purchases, movements (vendors per Q-K1)                                                                             | `stock`        | Admin, Pharmacist; Accountant view-only (Q-K2)                                                  | `q`, `category`, filters                                                                                                      |
| `/payments/$tab`                | `payments/` (owns the param)    | page; `$tab` ∈ ledger, pending                                                                                                            | `payments`     | Admin, Front desk, Counsellor; Accountant view-only                                             | `q`, `show` (`all` \| `received` \| `paid`), filters                                                                          |
| `/tasks`                        | `tasks/`                        | page                                                                                                                                      | `tasks`        | Admin, Doctor, Front desk, Counsellor; Therapist view-only                                      | `tab` (`todo`* \| `snoozed` \| `done`), `q`, `type`, `scope` (`mine` \| `everyone`)                                           |
| `/tasks/$taskId`                | `tasks/$taskId/`                | URL-driven dialog (task drawer)                                                                                                           | `tasks`        | as `/tasks`                                                                                     | —                                                                                                                             |
| `/offerings/$tab`               | `offerings/` (owns the param)   | page; `$tab` ∈ offerings, offers                                                                                                          | `offerings`    | Admin                                                                                           | `q`, filters, `sort`                                                                                                          |
| `/users/$tab`                   | `users/` (owns the param)       | page; `$tab` ∈ team, roles, branches (D17: the single members surface)                                                                    | `users`        | `membership:read` (D17); actions need `membership:manage` / `invitation:manage` / `role:manage` | `q`, `role` (selected role), filters                                                                                          |

\* default value.

- **Rooms with a `$tab` param** own it as a param-only leaf (the `accept-invite`
  precedent). Their bare URL (`/medical`, `/stock`, …) redirects to the default
  tab: Medical → Q-M5, Stock → items, Payments → ledger, Offerings →
  offerings, Users → team.
- **Splash is not a route.** It is the boot surface: `index.html#app-splash`,
  `src/lib/app-splash.ts` and `BrandLoader`. `BOOT_PENDING_POLICY` holds it
  until the first navigation resolves.
- **Landing room after sign-in:** the org index redirect. The prototype opens
  Leads (H:4255); `today.md:5` and `splash.md:6` say Today; the template
  Dashboard is the current default. Decision Q-T1.
- **Registrations per island:**
  - `routeTree.tsx` and `docs/reference/routes-and-ui.md`;
  - a builder in `src/lib/routes/builders.ts`;
  - param parsers in `src/lib/routes/params.ts` (ids and the `$tab` /
    `$section` enums);
  - test ids in `docs/reference/e2e-testids-inventory.md`;
  - the i18n namespace wiring (§3.8).
- **Doc fix:** `docs/reference/routing-and-tenancy.md:38–40` sketches
  appointment detail under `patients/$patientId/appointments/$appointmentId`.
  That can't hold appointments for leads, so it gets updated to
  `/appointments/$appointmentId` (L-13).
- **Count:** 21 islands. Skills: `fe-page-scaffolding` → `fe-route-island`,
  with `fe-routing-tenancy` for guards and `fe-e2e-testids` for test ids.

## 5. State management map

Never violated:

- **TanStack Query owns every record.** Zustand holds only ids and device prefs.
- **Filters:** pending-until-Apply sections are component state; applied
  filters live in the URL.
- **Derived business values are pure functions in the domain module,**
  unit-tested and never stored: dues, effective price (`ofEff`), invoice totals
  (`pyTot`), hold/claim state, offer state, stock level and runway, week load
  bars, conflict checks. One money module serves the invoice drawer, print and
  ledger.

| Screen       | Server state (Query)                                                                                                                      | Client state                                                                                                             | URL state                                      | Forms (RHF + Zod)                                                                                                                                                             | Watch-outs                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Shell        | me/context, access matrix, branches, open-task count                                                                                      | pins (device prefs), palette flags and `previewRole` (`useUIStore`), branch selection (Q-U7)                             | —                                              | —                                                                                                                                                                             | `previewRole` is never persisted                                                                                              |
| Splash       | —                                                                                                                                         | boot state in `app-splash.ts`                                                                                            | —                                              | —                                                                                                                                                                             | the exit is tied to boot, not a fixed timer (Q-S1)                                                                            |
| Today        | today's appointments, visits, work-queue tasks                                                                                            | none                                                                                                                     | `lane`, `queue`                                | none on the board                                                                                                                                                             | Stage moves are mutations with Undo, optimistic only where reversible (check-in)                                              |
| Visit sheet  | visit, patient history, Rx, treatment session, bill                                                                                       | dictation state                                                                                                          | `tab`                                          | consult note, Rx lines, treatment settings, checkout (bill + payment modes)                                                                                                   | one Visit model shared with the patient file (D18)                                                                            |
| Leads        | leads (cursor), lead detail with messages, contact search, staff                                                                          | filter drafts, people popover, composer draft (component); chat width (device prefs)                                     | view, filters, sort, `$leadId`                 | New lead (conditional steps), Edit lead draft (source, interests, status), contact editor                                                                                     | Drafted fields and immediate actions (assign, involve, claim, release, convert, send) must not share one submit               |
| Appointments | appointments by range, doctors, patient/lead search, offerings, packages                                                                  | quick view (hover/pin), "+N more" popover, filter drafts                                                                 | view, date, doctor, filters, create/edit       | booking drawer; status change (with cancel reason)                                                                                                                            | The filter mini-calendar keeps its own month; the board's month comes from `date` (the prototype shares one offset, a defect) |
| Patients     | patients (cursor), per-patient dues, staff, branches                                                                                      | filter drafts                                                                                                            | view, filters, sort, create                    | patient drawer (2 steps); quick-add per Q-P2                                                                                                                                  | Views are server queries, not client filters over a page                                                                      |
| Patient file | patient, visits, invoices, payments, Rx, treatments, photos (pages of 12), reports, packages, team notes, suggestions, feedback, activity | privacy mask (component; default masked; never persisted), lightbox, section popover; pins and photo size (device prefs) | `$section`, `album`, `visit`, `activity`, edit | Rx (with quick-line parser), treatment (discriminated by template), invoice (shared), receive payment, upload, add package, check-in/review/feedback child drawers, team note | One Visit model with Today (D18)                                                                                              |
| Medical      | per tab: sales, medicines with batches, POs, suppliers, manufacturers, MRs, medical ledger                                                | use popover                                                                                                              | `$tab`, filters, sort                          | medicine (2 steps), supplier, manufacturer, MR, MR visit, PO, goods receipt, sale (= invoice drawer, Medical), returns                                                        | FEFO deduction and stock checks are server rules (fixture now)                                                                |
| Clinic stock | items, purchases, movements, vendors                                                                                                      | Use popover, Stock check grid (component)                                                                                | `$tab`, filters                                | item, purchase, movement, stock check (field array), vendor (child drawer)                                                                                                    | "Only items that differ are saved" (Stock check) is a server rule                                                             |
| Payments     | ledger (receipts and expenses merged server-side), credits, day-close records, invoices and open bills for pickers                        | Day close drawer and selected day (component)                                                                            | `$tab`, `show`, filters                        | receive, pay (conditional first step), invoice, add pending, give back, day-close opening and count                                                                           | "Mark as checked" is a server mutation; the day lock is server-derived                                                        |
| Tasks        | tasks (one model, Q-T3), staff                                                                                                            | none                                                                                                                     | tab, filters, scope, `$taskId`                 | task drawer (outcome, note, snooze, assign), "What’s next" child, composer                                                                                                    | Rule derivation runs server-side (fixture now), never in the view                                                             |
| Offerings    | offerings, offers                                                                                                                         | none                                                                                                                     | `$tab`, filters, sort                          | offering (conditional steps), offer (3 steps)                                                                                                                                 | `ofEff` and the offer state are shared pure functions (invoice uses them too)                                                 |
| Users        | members (BE), staff profiles (fixture), roles (BE) and clinic matrix (fixture), branches (fixture)                                        | `previewRole` (`useUIStore`)                                                                                             | `$tab`, `role`, filters                        | user drawer, branch drawer; matrix toggles are immediate mutations (Q-U6)                                                                                                     | One members surface, not two (D17)                                                                                            |

## 6. Per-screen build notes

Every block is built by **`fe-design-ditto`**. A typical island also uses:

- `fe-page-scaffolding` → `fe-route-island`;
- `shadcn`;
- `fe-http-forms-errors` (forms);
- `fe-i18n-constants`;
- `fe-e2e-testids`;
- `fe-test-generation`;
- `fe-visual-regression`, after fidelity sign-off.

Extra skills are named per block. Copy is verbatim from the cited prototype
lines and becomes keys in the screen's namespace (§3.8).

**Per screen, build in this order** (`fe-design-ditto` Step 4): interaction shell
(sheet, dialog or popover, with its mobile variant) → flow skeleton, conditional
steps included → regions, desktop and mobile together → content (fields, copy,
icons) → states → motion.

**Pacing:** one screen at a time. After each, show the side-by-side comparison
and wait for your OK before starting the next (`kickoff-prompt.md`, Pacing).

### 6.0 Shared behaviour (all rooms)

**Motion.** Prototype durations; the md's "ease" loses to these curves:

| Element                                        | Duration and easing                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Popover, dropdown, menu                        | 160ms `cubic-bezier(.2,.8,.2,1)`: opacity, −4px → 0, scale .985 → 1 (+4px when opening upward) |
| Drawer panel                                   | 340ms `cubic-bezier(.32,.72,0,1)`, translateX 100% → 0                                         |
| Drawer backdrop                                | 340ms, same curve                                                                              |
| Floating drawer ×                              | 200ms after a 200ms delay, `cubic-bezier(.2,.8,.2,1)`, scale .9 → 1                            |
| Accordion step                                 | 240ms `cubic-bezier(.2,.8,.2,1)`                                                               |
| Search expand                                  | 220ms `cubic-bezier(.2,.8,.2,1)`; background 120ms                                             |
| Skeleton shimmer                               | 1,100ms ease, looping; dropdown and "loading more" rows 1,200ms                                |
| Bulk bar                                       | 220ms `cubic-bezier(.32,.72,0,1)`                                                              |
| Tabs, chips, presets, toggles                  | 150ms                                                                                          |
| Sort header, row hover, actions, checkbox fade | 120ms                                                                                          |
| Reduced motion                                 | every duration .01ms, delays 0, one iteration (H:13, H:201)                                    |

**Timers to keep:**

- search debounce 300ms; picker debounce 250ms local, 300ms remote;
- double-click guard 450ms (exempt: steppers, ×, close, digits,
  checkbox/radio/tab/switch, popup triggers);
- tooltip: shows after 160ms, touch hide 1,400ms, hides 60ms after a click;
- contact card 280 / 220ms; team card 160 / 200ms;
- toasts 5,200ms, errors 9,000ms;
- resize re-measure 120ms; tab-overflow measure 250ms; print 260ms;
- nav "More" 120 / 220ms.

**Simulation, never hard-coded (D15):**

- fetch 160–600ms, save 320–740ms with 10% failures, list failures 5%;
- contact-card load 650ms, team-card load 220–480ms, picker latency 420/450ms;
- infinite-scroll wait 700ms; Apply spinner 600ms;
- message delivery 1,000 / 900ms; visit commit 750 / 900ms; dictation 1,200ms.

**Keyboard:**

- "/" focuses search; ⌘K / Ctrl+K toggles the palette.
- Esc closes the top-most surface first: confirm → child drawer → drawer →
  popover.
- j/k + Enter move through rows (Q-P3 decides whether every table gets it).
- "G · 1–9" jumps to pinned tabs (Q-S2). Arrows move through tablists.

**Inputs:**

- The first letter of name-like inputs is auto-capitalised (H:4276–4282).
  Exempt: messages, tel, email, numeric, handle and search inputs.
- Disabled controls are at 50% opacity.
- On touch screens (the consult-room tablet), row actions and checkboxes are
  always visible, tooltips open on tap, and quick inputs get 44px targets
  (H:43; PRD.md:241).

**States** (prototype engine plus the md's per-room copy, §7.1):

| State              | Behaviour                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading            | In-place skeleton over rows, drawer or section on first load                                                                                                    |
| Empty              | `EmptyState` with the per-room copy                                                                                                                             |
| Filtered empty     | "No matches" · "Nothing matches these filters. Clear them to see everything again." · "Clear filters"                                                           |
| List error         | Toast "Couldn’t load this list · connection dropped. Showing the last copy." with "Retry" (9,000ms)                                                             |
| Save error         | Footer "Not saved · your changes are kept"; button "Retry save"; toast "Couldn’t save · connection dropped. Everything you entered is still here." with "Retry" |
| Permission-limited | Create buttons hidden, row actions filtered, drawers read-only                                                                                                  |

**Command palette** — extend the existing `CommandPalette`; it respects access
and preview.

- **Groups:**
  - Actions: New lead, New appointment, New patient, New receipt, Open tasks.
    In the prototype "New appointment" and "New receipt" only navigate; here
    they open their forms (Q-A15).
  - Go to: every room, including Today, which the prototype omits.
  - Patients (from 2 characters; name, phone or #ID): "#<id> · •••• <last4>".
  - Leads: "#<id> · <status>".
  - Invoices.
- **Panel:** `min(640px, 100%)` × `min(560px, 76vh)`, radius 12, overlay α .35
  fading in 150ms, 12vh from the top. Input 52px, 15px text, "Search or jump
  to…"; rows 40px; footer "↑ ↓ move · ↵ open".
- **Copy:** empty "No matches. Try a name, phone or #ID."; hint "Type 2+ letters
  to search patients, leads and invoices".

**Contact card:**

- Header tint: sage for patients, lav for leads. Name links to "Open patient
  file ↗"; badges; Edit contact.
- Reach: WhatsApp and phone tiles, Instagram, Copy → "Copied <v>"; or "No phone
  or handle saved yet".
- Team: owner, involved and doctor chips; "Open · Claim".
- About: gender · age, language, area, household, "Came via", credit, reviews,
  consent chips.
- Footer: "+ Lead" · "+ Appointment" · "+ Patient".

**Team card:**

- 48px avatar with a presence dot; name, role, "Online now" / "Offline"; a kind
  pill (Assigned / Involved / Treating / Sent this).
- Primary action: "Claim <first>" / "Join · take <first>" / "Take over from
  <first>" / "Assign to yourself".
- Reach: phone, email, branch, "Works 10:00 – 19:00"; "Updated HH:MM".

### 6.1 Splash (boot)

- **Shape:** full-bleed boot screen, `role="status"`, aria-label "Loading
  Clinozy" (`splash.md:75`; H:338–344). It restyles the existing `#app-splash`
  (`index.html`) and its exit logic (`src/lib/app-splash.ts`); it is not a new
  splash. `BrandLoader` is reused.
- **Frames** (`splash.md:43–44`, H:338–341):

  | Frame                            | Duration and easing                  | Start   |
  | -------------------------------- | ------------------------------------ | ------- |
  | Mark, scale .6 → 1               | 700ms `cubic-bezier(.2,.9,.25,1.05)` | 50ms    |
  | Halo                             | 1,400ms `cubic-bezier(.2,.8,.2,1)`   | 550ms   |
  | C stroke, dashoffset 40 → 0      | 700ms `cubic-bezier(.65,0,.35,1)`    | 550ms   |
  | Dot, 0 → 1.25 → 1                | 500ms `cubic-bezier(.34,1.4,.64,1)`  | 1,150ms |
  | Wordmark, 8px rise with 6px blur | 800ms `cubic-bezier(.16,1,.3,1)`     | 1,250ms |
  | Greeting block                   | 500ms ease                           | 1,900ms |
  | Bar and ticker                   | 1,500ms                              | 2,050ms |

  The sequence totals about 3,700ms. Exit is a 500ms cross-fade, then the app
  fades in over 450ms ease (H:344). With reduced motion every frame is 1ms and
  the splash holds 500ms (I1).

- **Offline** (`splash.md:75`, H:342): the splash stays; bar and ticker hide; a
  `role="alert"` line reads "Can’t reach Clinozy · check the internet
  connection" (12.5px), with a 36px outline "Retry" that reloads.
- **Decision:** the exit timing versus boot, and text that renders before i18n
  loads (Q-S1).
- **Tests:** update `tests/e2e/boot-splash.e2e.test.ts`. Skill:
  `frontend-design` for the keyframes.

### 6.2 Today (`today/`)

**RED-4 is resolved (D20): the prototype's 7 lanes and stage machine, no Done lane.**

- **Layout** (H:398–475): a grid of `minmax(0,1fr)` plus a 312px aside. The
  main column pads `16px 22px 12px`, gaps 14px and scrolls as a whole. There
  is no h1.
- **Greeting row:**
  - "Good morning, {firstName}" at 23/600, line-height 1.1, −0.02em (H:401);
  - pulse line, 13px: "{n} in clinic · {n} waiting · {n} arriving · {date}";
  - a spacer, then "New booking" and "Walk-in". Their targets are Q-T2: the
    prototype opens New lead and the palette.
- **Lane tiles:** `auto-fill minmax(104px, 1fr)`; count 26/600; up to 4 faces
  then "+N"; a hint line (next, oldest, since, or —). Lanes outside my role's
  focus sit at 60% opacity. The prototype pins roles to Front desk and
  Counsellor (H:4255), a defect; the focus comes from my roles.

  | Lane        | Tone   | Card action  |
  | ----------- | ------ | ------------ |
  | Enquiries   | lav    | Book         |
  | Arriving    | sky    | Check in     |
  | Waiting     | butter | Send in      |
  | With doctor | blush  | Open consult |
  | Treatment   | sage   | Open session |
  | Checkout    | butter | Checkout     |
  | Pharmacy    | mint   | Dispense     |

  `today.md:18` lists eight stages, including Done; the prototype has seven, and the Done lane is not built (D20).

- **Selected lane panel:** cards `auto-fill minmax(210px, 1fr)` — name 13.5/500
  with time, service, flag pills and the action button. A card click opens the booking drawer (`today.md:30`, PRD.md:48).
- **Aside (312px):** the Work queue — tasks with outcomes, filtered Mine /
  Everyone. Empty: "No one here right now." One task model with Tasks (Q-T3).
- **Stage machine** (prototype):
  - booked → Check in → waiting, with a toast and Undo;
  - waiting → Send in → with doctor;
  - with doctor → Open consult (Visit, Consult tab);
  - treatment → Open session (Visit, Treatment tab);
  - checkout → Checkout (Visit, Checkout tab);
  - pharmacy → Dispense → a Medical sale, prefilled;
  - enquiry → Book → Leads.

  Enquiry and pharmacy cards stay in their lanes, as the prototype does (D20). A check-in also
  moves the linked open lead to Clinic visited.

- **Tablet:** lanes wrap (auto-fill). Phone: per D10, lanes stack and the aside
  drops below.

### 6.3 Leads (`leads/`, `leads/create/`, `leads/$leadId/`)

**List**

- **Toolbar:** h1 "Leads" · tabs Mine* / Unreplied (count badge in
  `bg-tone-lav-border`) / All · spacer · search "Search name, phone, #ID" ·
  Filters (with joined clear ×) · Columns · "New lead" (plain button).
- **Table** — a bespoke grid that does **not** fold (H:1550–1565; md says fold,
  prototype wins):

  | Column        | Width                               | Content                                                                                                                                                     |
  | ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Lead          | `minmax(160px,1.5fr)`, always shown | 32px avatar (lav, or sage with a "P" badge for patients); name 13px, 600 when unread else 500; phone 11.5px; hover opens the contact card                   |
  | Status        | `minmax(104px,.8fr)`                | status pill                                                                                                                                                 |
  | Source        | `minmax(116px,.7fr)`                | pill with icon                                                                                                                                              |
  | Interested in | `minmax(96px,.9fr)`                 | first interest, then "+N" titled with the rest                                                                                                              |
  | Team          | `minmax(150px,1.2fr)`               | owner chip (22px, presence dot); "Open · Claim" / "Open to team · Join" / "Open to team"; a 7px butter dot when release is due; up to 3 involved, then "+N" |
  | Updated       | 84px, right-aligned                 | relative time; title "Wed, 30 Sep 2026 · 11:00 am IST"                                                                                                      |

  Table behaviour:

  - Minimum width: Σ minimums + 12 × (n − 1) + 60 = 830px. Below that it
    scrolls inside the card, with the header's scroll synced.
  - Sort cycles asc → desc → off; Updated starts at desc.
  - 3px status edge. The prototype's first row always looks selected — fixed.
  - Row click opens `/leads/$leadId` and clears unread.
  - No action column; the claim pill is the only row action. No selection
    (Q-L2).
  - j/k + Enter.
  - Infinite scroll triggers 80px from the bottom (cursor, D7): "Loading more
    leads" (3 skeleton rows, `role="status"`), then "All leads loaded".
  - Virtualised above 40 rows (53px rows, overscan 10).

- **Views:** Mine = owner is me; Unreplied = unread and owner is me; All.
- **Filters** (340px):
  - Status: single choice; clicking the selected chip returns to All.
  - Source · pick any.
  - Ownership · hold after idle days: Any / Open to claim / Releasing today /
    Held.
  - Team · assigned or involved: inline list with "Search team".
  - Created.
  - Follow-up date: Any / Overdue / Today / Tomorrow / Next 7 days / Not set /
    Custom range.

  The contract carries `createdAt` and `followUpAt`; the prototype hashes them
  (H:3643).

**Lead drawer** (`/leads/$leadId`)

- **Size:** total = `round(min(980, 0.94 × vw))`; chat =
  `max(360, min(pref ‖ 420, total − 400))`; detail = the rest. That is 560 +
  420 at 1440px. The phone layout is Q-L1.
- **Shape:** two panels sliding in at 340ms `cubic-bezier(.32,.72,0,1)`; the
  backdrop (α .28) and × appear instantly.
  - The prototype is non-modal and not a dialog (H:1573–1574). It is built
    modal (`role="dialog"`, focus trap) — §7.3.
- **Chat resize handle** (shadcn `resizable`, 7px): drag 360–680px; ← / → step
  20px within 300–640; double-click resets to 420. The width persists in device
  prefs, and the ARIA range matches the real clamp (the prototype says 340–720).
- **Header** (76px):
  - "Edit lead"; the #ID chip copies → "Lead ID #‹id› copied";
  - the Re-target pill;
  - sub "Make your changes, then Save lead";
  - the × floats outside the left edge.
- **Sections**, all open, no steps:
  1. **"Lead details"**
     - Source chips.
     - Interested in, with "Add interest" (≤30 chars; Enter or blur adds,
       case-insensitive dedupe, Esc clears).
     - "Assigned & involved" people popover, which applies immediately. Width
       `max(320, min(440, trigger))`, max height `min(460, max(160, space))`;
       flips up when space below is under 240px.
     - Claim and Release buttons.
  2. **"Progress"** — a tracker over New → Contacted → Follow-up → Clinic
     visited:
     - past: ink fill, check, "Done";
     - current: tone fill with a halo, "Current";
     - next: 30% tint, dashed number, "Next";
     - a 3px bar at 100 / 50 / 0%;
     - "Close as": No response · Not interested · Invalid · Lost.

     Drafted until saved; any status can move to any (Q-L4).

  3. **"Info":**
     - Created; Last message ("‹Channel› · ‹at›" or "None yet");
     - Patient "Linked" / "Not yet", with "Convert to patient" when there is no
       patient and the status is Contacted or Follow-up;
     - Open tasks; Re-target reason.
- **Footer:**
  - "Remove lead";
  - "Discard" (only when dirty);
  - "Not saved · your changes are kept";
  - "Save lead" (disabled until dirty). The drawer stays open after saving.
- **Side effects:**
  - Status:
    - No response → an automatic "Call back" task, due tomorrow;
    - Follow-up → a follow-up task due tomorrow, owned by me (the prototype
      hard-codes "Asha (you)").
    - Toast "‹name› → ‹st›[ · follow-up task for tomorrow]" with Undo.
  - Automatic moves:
    - the first WhatsApp or Instagram reply while New → Contacted;
    - a call logged while New → Contacted;
    - an appointment Checked in or Completed → the contact's open leads, by
      id → Clinic visited;
    - Convert → Clinic visited.
- **Hold / claim / release** (a pure function):
  - Hold days are an org setting, default 3. Idle time counts from the last
    touch, and owner activity resets it (Q-L9).
  - Closed statuses never release; a lead whose owner has left is open.
  - left = hold − idle; open at ≤ 0; the dot shows at 1 ("Released to the team
    tomorrow if nobody follows up").
  - Claim: I become owner and the previous owner joins as involved; toast with
    Undo. Release makes it open now.
  - Assign: only the current owner, and only to roles allowed for theirs — Front
    desk → Front desk, Counsellor; Counsellor → Front desk, Counsellor, Doctor;
    Doctor → Doctor, Therapist, Counsellor, Front desk.
- **Chat aside:**
  - Thread with system pills.
  - Message states: Sending… → Delivered / Read / Queued / Not sent, with
    Retry.
  - Composer modes: WhatsApp (if the contact is on it), Instagram (disabled with
    "No Instagram on this contact"), Call log, Note. Labels show only when the
    pane is at least 460px.
  - Textarea ≤1,000 chars, 3 rows, min 78px; Enter sends, Shift+Enter adds a
    line; "/" opens templates.
  - Reply hint: "‹First› wrote on ‹Ch› · replying there" / "· switch to ‹Ch›".
  - Warnings: "WhatsApp down · replies will queue" (Q-L10), "Prefers no calls ·
    message instead", "Prefers contact after 6 pm".
  - Suggest popover: Share price · Offer 2 slots · Send location · Explain
    ‹term›; fallback Greet · Offer 2 slots · Follow up. Eight templates
    (Greeting, Price, Free slots, Location, Reminder, Aftercare, Follow-up,
    Review). Fill-in values come from org/branch settings, not the prototype's
    address literals.
  - "Book it" opens `/appointments/create` prefilled: who = the lead; LHR
    Treatment if the interest matches lhr/laser, else Consultation; 20 min;
    today.
  - Empty: "No messages yet · start the conversation below". Loading and error
    states are md-only (§7.1).

**New lead** (`/leads/create`, 640px, modal) — the step sequence **varies by
input**:

| Input                               | Contact step                                                                                                                                                                                                                                                                                              | Lead details step                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| No contact (default)                | Step 1, open. Search: autofocus, "Search by name or mobile", from 2 chars, up to 5 results. Quick start: Walk-in (source Walk-in, status Clinic visited) · Phone call (source Phone call — Q-L6 — status Contacted) · Instagram DM (source Instagram, status New). "New contact" opens the contact editor | Step 2, locked: "After contact"; toast "Pick or add the contact first"                                          |
| Existing patient picked             | Replaced by the contact card and "Change"                                                                                                                                                                                                                                                                 | Becomes step 1, open; source Re-target; linked patient; toast "Existing patient ‹id› · new lead will be linked" |
| New contact saved                   | Contact card                                                                                                                                                                                                                                                                                              | Step 1, open                                                                                                    |
| Opened from a contact card "+ Lead" | Card, prefilled                                                                                                                                                                                                                                                                                           | Step 1, open                                                                                                    |

- **Fields:** Source (default WhatsApp); Interested in, with custom values and
  "What are they interested in?" (≤40) for Others; Assigned & involved (owner =
  me).
- **Footer:** "Creates or updates one contact" · Cancel · "Create lead" (always
  enabled).
- **Validation runs on submit,** before saving (the prototype checks after the
  save delay): "Add a name and a 10-digit mobile".
- **On create:** toast "Lead #‹id› created"; the drawer closes and the list
  stays. Duplicate check: Q-P7.

**Contact editor** (child drawer, 560px) — an accordion:

1. **"Identity & reach":**
   - contact ID chip "C-‹5 digits›" (copies); Name ≤60;
   - mobile numbers: +91, ≤10 digits; each with ★ Primary / ☆ Set primary, a
     WhatsApp toggle, and × to remove when there's more than one; "+ Add
     number";
   - "+ Instagram" handles (≤30) with "+ Add handle";
   - default channel: WhatsApp / Call / SMS / Instagram;
   - the linked banner, with Undo.
2. **"Contact preferences":** 12 chips plus "+ Custom" (≤40).

"Done" closes it. In contact-only mode, Done writes immediately. Whether the
backdrop also commits, as in the prototype, is Q-P1. Esc closes it (md).

**Remove lead** — reason confirm:

- reasons: Duplicate / Test entry / Spam / Other (note ≤160 chars, required for
  Other);
- body: "The lead leaves every list and the owner’s queue. Chat history is kept.
  You can undo from the toast right after.";
- title "Remove this lead?" (the prototype reads "Remove lead this lead?");
- toast "Lead #‹id› removed · ‹reason›" with Undo; the drawer closes.

**Access:** View, Create and Edit for Admin, Doctor, Front desk and Counsellor;
Delete for Admin. Save and Remove are gated too (the prototype gates neither).
Extra skill: `shadcn` (sheet, resizable, hover-card, command).

### 6.4 Appointments (`appointments/`, `create/`, `$appointmentId/`)

**Toolbar:** h1 "Appointments" · View tabs Agenda* / Day / Week / Month · (not
on Agenda) the Today button — "Today", "This week" or "This month" — plus
‹ label › "Period" ("Wed 30 Sep 2026" / "27 Sep – 3 Oct" / "Sep 2026") ·
spacer · search "Patient, phone or #ID" · Filters (`ListFilter` 15) · "New
appointment" (plain). The md's "day · week · list" (`_index.md:8`) is stale.

**Agenda** (default):

- Grouped by day. The sticky group header has a 34px date tile, "In N days",
  and "{n} confirmed │ {n} awaiting reply" or "· all set".
- Grid: `76px minmax(150px,1.6fr) minmax(96px,1fr) minmax(128px,.9fr) minmax(112px,1.1fr) 36px 132px`.
- Columns: Time · Contact · Service · Appointed to · Latest update · eye (pins
  the quick view) · Status (opens the status popover).
  - Latest update shows "✓ Plan ready · N offerings" or "○ Plan pending", then
    the last event (Reminder read / delivered / sent, Replied Yes, Moved ×N,
    Checked in). The data comes from the server; the prototype synthesises it
    from the id.
- Minimum width 790px, scrolling inside the card with header sync.
- End line "All appointments loaded"; empty "No appointments here · book one".
- After a new booking the Agenda jumps to that date (H:5806).

**Day:**

- Time grid 9:00–22:00 at 88px per hour (1,144px); hours source is Q-A3.
- 52px gutter labelled "9 am" … "9 pm"; grid lines from tokens (the prototype
  hard-codes light colours, which break dark mode).
- Past shading; now-line in `destructive`.
- One "All doctors" column with overlap lanes (Q-A2). Header: "N booked ·
  X.X h" / "Free all day", plus a 240px doctor filter.
- Block geometry: top = (h + m/60 − 9) × 88; height = max(22, dur/60 × 88 − 2).
- Clicking an empty slot opens `/appointments/create?date&time`, snapped to
  15 min and labelled "New appointment · {day} · {time}". A past slot toasts
  "Past dates can’t be booked".
- Hovering a block opens the quick view; clicking opens the edit drawer.

**Week:**

- Starts Sunday in the prototype (Q-A10).
- Header: weekday and date, a load bar, and a same-doctor overlap dot. The bar
  turns butter at ≥55% and blush at ≥85%; capacity = 13h × max(2, doctors).
  Clicking the header opens Day.
- No slot click. Scrolls horizontally below about 1,126px.

**Month:**

- Sunday-first. Chips are 26px and single-line (Q-A19).
- "+N more" opens a 300px popover with "Open day". Today's cell is bordered in
  `primary`; clicking a cell opens Day.
- Gets a loading skeleton, which the prototype lacks.

**Filters** (560px; pending until Apply):

- a mini calendar with load dots — its own month, decoupled from the board;
- Appointed to: multi-select, labelled with each person's real role (the
  prototype says "Doctor" for everyone);
- Status chips: All / Active (open) / Scheduled / Confirmed / Checked in /
  Completed / Cancelled / No show;
- Created; Follow-up — these apply to the calendars too; the prototype ignores
  them there but counts them in the badge.

Esc closes it and it flips (md).

**Quick view:** opens on hover after 420ms and closes 160ms after leaving; the
eye pins it. 340px wide, with a stepper and the next action (Check in /
Confirm / Complete / Rebook). It enforces the status popover's guards (Q-A7).

**Status popover** (260px):

| From                            | Allowed next                                                 |
| ------------------------------- | ------------------------------------------------------------ |
| Scheduled                       | Confirmed · Checked in · Reschedule · Cancelled · No show    |
| Confirmed                       | Checked in · Reschedule · Cancelled · No show                |
| Checked in                      | Completed                                                    |
| Completed · Cancelled · No show | final: "Final status. Use Rebook to make a new appointment." |

- **Guards:** Checked in only on the appointment's date; No show only after its
  start time.
- **Reschedule** is an action that opens the move drawer, not a stored status.
- **Cancel** asks for a reason, from one reason set (Q-A8).
- **Side effects:**
  - No show → an automatic "No-show" task;
  - Completed → a "Feedback" task;
  - Checked in or Completed → the linked open lead moves to Clinic visited;
  - toasts carry Undo.

**Booking drawer** (create / edit): `min(760px, 100vw − 56px)`. The
prototype's `max(560, W − chat − 56)` overflows phones; there it is full-width
per D10.

- **Who:** picker "Search patient or lead by name, phone, ID". "Connected lead"
  chips read "#id · status", with "· moves to Clinic visited at check-in".
- **Type chips** with default length and hint: Consultation 20 · Follow-up 15 ·
  Treatment 60 · Package session 45 · Other 30. Treatment opens an offering
  dropdown; Package session shows the patient's package cards.
- **Doctor:** staff with the Doctor or Therapist role (Users). The prototype's
  names are fixture data.
- **Length chips:** 15 / 20 / 30 / 45 / 60 / 90 / 120.
- **Date and time:** quick chips, a calendar, and a slot grid in 30-minute steps
  (15 by toggle), 10:00–19:30 (Q-A3). AM slots are butter, PM sky. The grid
  shows existing bookings; the prototype ignores them.
- **Reason and Notes** are persisted on create too (Q-A9).
- **Edit mode adds:**
  - the visit status strip, toned per status;
  - the Rescheduled note — "needs confirming again" only when it was Confirmed;
  - for non-patients: "Not a patient yet · Create the patient record to
    continue · unlocks photos, offering suggestions, feedback and Completed",
    with "Create patient record";
  - Photos (locked: "…at the clinic · check them in first") and offering
    suggestions;
  - reminder "1 day before" = the previous day at 16:00 (Q-A13).
- **Footer:** summary · "Cancel" · a save labelled "Book {day}, {time}", "Move
  to …", "Save changes" or "Pick a time". The prototype dims it to 50% until
  complete; the dirty rules are Q-P1.
- **Validation:** toasts "Pick who…", "Pick a date and time", "That time has
  passed…", "Just taken…", plus field errors (md).
- **Conflicts:** same doctor, overlapping time (Q-A4); the prototype checks only
  an equal start time.

**Access:** Admin, Doctor, Front desk and Counsellor view, create and edit;
Therapist views. Edit and Cancel are gated (Q-A16).

**Not built** (dead): the room/machine resource calendar, the slot-based views,
the person card, the footer strip, the agenda range dropdown (Q-A17).
Geometry, load and guard rules are pure functions with unit tests. The
contract carries an optional room or machine for later resource views (Q-A1).

### 6.5 Patients (`patients/`, `patients/create/`)

**Toolbar:**

- h1 "Patients";
- view tabs, icons at 14px: All (`Users`) · In clinic today (`House`) · With
  dues (`Wallet`) · Follow-up due (`Bell`) · Recall (`RefreshCw`). The tabs
  scroll;
- search "Name, mobile or #ID";
- saved views; Filters; Columns; "New patient".

**Table** — the shared `DataTable`:

| Column     | Content                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| ☐          | hover checkbox                                                                                           |
| ID         | "#3508"                                                                                                  |
| Patient    | 32px sage avatar with a 14px "P", name, "+91 82006 03212"; hover opens the contact card                  |
| Gender     | hidden by default                                                                                        |
| Type       | badges                                                                                                   |
| Status     | pill                                                                                                     |
| Conversion | hidden by default                                                                                        |
| Age        | hidden by default; "N yrs" with date of birth                                                            |
| Follow-up  | blush when past, butter today, sky in future                                                             |
| Due        | blush, weight 600, or "—"                                                                                |
| Updated    | avatar + "Sep 24 · 15:39"                                                                                |
| Actions    | New invoice (`Receipt`) · Collect ₹<due> (`Wallet`, only with dues) · Edit (`Pencil`) │ Delete (`Trash`) |

- Minimum width 1,450px; the actions track is 183px (145px compact).
- Row click opens `/patients/$patientId` with Activity open; the default section
  is Overview (D19).
- Folding: at 1024px, ID and Updated fold; at 768px, ID, Status, Follow-up and
  Updated.

**Views are server queries:**

- In clinic today: Q-P4. The prototype matches follow-up = today, which is
  wrong.
- With dues: dues by patient id.
- Follow-up due: past or today.
- Recall: status Inactive.

**Patient drawer** (680px): "New patient" / "Edit patient", tag #id, sub
"Creates or updates the contact too", badges.

- **Quick fill** (new only): Walk-in today (butter) · Referred by patient
  (lav) · From Instagram (blush) · LHR patient (blush).
- **Two steps** (prototype; `patients.md:51`'s three lose): "Contact &
  personal" → "Clinic, referral & follow-up".
- **Fields:**

  | Field                       | Notes                                                                                                                                       |
  | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | First name*                 | ≤60                                                                                                                                         |
  | Last name                   |                                                                                                                                             |
  | Mobile*                     | +91, placeholder "98765 43210", hint "primary · WhatsApp"                                                                                   |
  | Secondary mobile            |                                                                                                                                             |
  | Address                     | "Area, city"                                                                                                                                |
  | Home branch                 | chips; shown with more than one branch                                                                                                      |
  | Gender                      | Female / Male / Other                                                                                                                       |
  | Birth date                  | calendar; hint "Age N"                                                                                                                      |
  | Patient type                | chips, not a picker: Aesthetic lav · Clinical sky · LHR blush · Dental mint · Physio sage · Gynac butter                                    |
  | Status                      | New / Regular / VIP / Inactive                                                                                                              |
  | Conversion                  | T-Converted / T-Not converted                                                                                                               |
  | Referred by · Referrer type | text ≤30 · Patient / Doctor / Instagram / Google / Walk-in / Other                                                                          |
  | Follow-up                   | a datetime, not free text. Quick chips Tomorrow 10:30 / In 1 week / 20 days / 1 month, computed from today (the prototype hard-codes dates) |
  | Notes                       | ≤1,000                                                                                                                                      |

- **Footer:** Delete (edit) · "Create & add another" (new) · Cancel · "Create
  patient" / "Save changes".
- **On save:** an onboarding task, "New patient. Collect consent, DOB and a
  first photo."; toast "Patient #<id> created · onboarding task added".
  Navigation afterwards is Q-P6.
- **Validation:** "Add name and mobile", plus field errors. Duplicate check:
  Q-P7.

**Quick-add** (`ptNew`, 680px child drawer, from pickers): a second form. One
form or two is Q-P2. Sections:

- **Patient:** First name*, Last name, Mobile*, Gender, date of birth, Address.
- **Clinic:** Patient type; Consent chips (Data / Photos / Marketing); first
  photos, "Take or drop photos", "JPG or PNG · up to 15 MB each"; Notes.

**Access:** everyone except the Accountant views; all but the Therapist create
and edit; Delete is Admin only.

### 6.6 Patient file (`patients/$patientId/`, `$section/`, `edit/`)

**Resolved: Overview ships as the default section (D19); the visit flow ships on the shared Visit model (D18).**

**Layout** (H:523–699):

- A column on `background`: the file bar, then a body grid (gap 12).
- The body is `1fr`, or `1fr` plus the Activity panel at
  `max(340, min(400, round(vw × 0.28)))`.
- Main card (radius 12): a 288px rail plus content.
- The rail hides below 1000px wide, or below 1280px while Activity is open
  (Q-F2; `patient-file.md:16` says "above content").

**File bar**, left to right:

- Back, 36px ("Back to patients (Esc)"). Esc navigates back when no overlay is
  open (Q-F8).
- "Patients / <name>" breadcrumb when the rail shows; otherwise an identity
  block: 32px avatar, "#id · masked phone".
- A "Visit in progress · Resume" pill.
- Folder button (32px) → section popover `min(360px, 100vw − 32px)`:
  - groups: Clinical (Clinical notes) · Care (Visits, Prescriptions, Treatments,
    Photos, Reports) · Billing (Invoices, Payments, Packages) · Team (Team
    notes);
  - 3-column tiles, each showing "Open now" / "Empty" (dashed) / "Has records",
    with a 24px pin;
  - footer "Pinned sections stay in the bar · this device".
- Pinned tabs, 32px:
  - default pins: Clinical notes, Visits, Prescriptions, Invoices;
  - a temporary tab gets a dot; ← / → cycle the tabs;
  - tones: Overview and Photos blush, Visits sky, Rx sage, Treatments and Notes
    lav, Reports and Packages mint, Invoices and Payments peach.
- "+" add-to-record menu (232px): Prescription, Treatment, Invoice, Payment,
  Photo, Appointment, Report, Note.
- "Start visit" (primary, 36px).
- "Activity" toggle with an unread badge.

**Sections** (labels and icons, H:4685 and H:4487):

| `$section`       | Label          | Icon            |
| ---------------- | -------------- | --------------- |
| `overview`       | Overview       | `LayoutGrid`    |
| `clinical-notes` | Clinical notes | `Stethoscope`   |
| `visits`         | Visits         | `Calendar`      |
| `prescriptions`  | Prescriptions  | `Pill`          |
| `treatments`     | Treatments     | `Sparkles`      |
| `photos`         | Photos         | `Camera`        |
| `reports`        | Reports        | `FileIcon`      |
| `invoices`       | Invoices       | `Receipt`       |
| `payments`       | Payments       | `Wallet`        |
| `packages`       | Packages       | `Package`       |
| `team-notes`     | Team notes     | `MessageSquare` |

**Rail** (288px), top to bottom:

1. **Identity** on a sage tint: 48px avatar with "P"; name 16/600; the ID copies
   ("Patient ID copied"); "45 days as patient" / "Joined today"; type and status
   badges; "Edit contact" → `/patients/$patientId/edit`.
2. **Reach:** phones masked "•••• 1234" with an eye to reveal; labels like
   "WhatsApp · Primary" or "Mobile · From lead"; Open WhatsApp / Call /
   Instagram / Copy.
3. **About:** "Female · 30 yrs"; date of birth with "🎂 in N days"; language;
   address or "No address"; consent chips ✓Data ✓Photos ✕Marketing.
4. **Up next**, fixed at the bottom:
   - next visit, "Today · 11:00 am" or "Not booked", with Reschedule / Book;
   - Due "₹ ••••" with Collect; Credit "₹X to return" with Give back; or "All
     paid · nothing due";
   - the Feedback row.

**Section head** (50px): title, Columns (tables only), and a split "New …" —
New appointment · New invoice · Record payment · New prescription · New
treatment · Upload report · Upload images · Add package.

**Clinical notes:**

- A 12-column bento. Cards span 12, then 6 at ≥620px, then 3 at ≥980px
  (container queries).
- Four chip cards: Complaints (blush) · Diagnosis (lav) · Treatment suggestions
  (sage) · Future suggestions (sky). Each has "×" on chips, "N new", "Type and
  press Enter to add" (≤60), and the empty line "Nothing added yet".
- **Offering suggestions** (wide, collapsed by default):
  - rows: name / quantity stepper / price (masked) / status (Planned · Accepted ·
    Next time · Declined) / by / actions;
  - ideas with "+ Add"; "Add offering"; "<First>’s last purchases";
  - "Contact activity" with "Open chat";
  - two rows per entry below a 600px container.
- **Feedback** (collapsed): type chips; a carousel of 236px cards, 3 in view
  (2 below 760px), "Load more" adds 6; "Action needed" with "Log action". "Log
  feedback" opens a 560px picker drawer (prototype; the md's dropdown loses).

**Overview** — the default section (D19); unreachable in the prototype, so it is built from the designed markup:

- A bento of Clinical, Visits, Photos, Packages, Rx, Treatments, Billing,
  Reports and Team notes (H:590–600).
- Columns: 3 when the main width is ≥1100px, 2 at ≥640px, else 1.
- Each card's empty line: "No visits yet", "No photos yet · upload the first",
  "No active packages", "No prescriptions yet", "No treatments yet", "No reports
  yet", "No notes yet".
- Plus a day-grouped activity timeline with filter chips (H:4601–4625).

**Tables:**

| Section       | Columns                                                                                                                   | Row actions                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Visits        | ID · When · Offering · Doctor · Status — from live appointments; the prototype uses a static list                         | —                                                                    |
| Invoices      | Invoice # + type · Items · Team (hidden) · Bill · Paid/due · Status · Date                                                | Print · Preview · Copy invoice · Record payment · Edit · Delete      |
| Payments      | Receipt · When · Invoice · Mode · ±Amount · By                                                                            | —                                                                    |
| Prescriptions | ID · Date · Medicines (dose · when) · Notes (hidden) · Doctor · Updated (hidden)                                          | Print · Preview · Copy prescription · Sell medicines · Edit · Delete |
| Treatments    | ID · Treatment · Area · Team (hidden) · Session #N · Details (hidden) · Feedback ("Feel · N/10" / "Call next day") · Date | Check-in · Copy as next session · Edit · Delete                      |
| Reports       | Report · Type (Lab mint / Scan sky / Consent lav / Other stone) · Date · Uploaded by                                      | Open · Delete                                                        |

**Photos:**

- Album tabs General / Private / LHR, with a count. Private-album protection is
  Q-F5.
- Visit filter: "All photos" / "Not attached to a visit" / per visit.
- Sizes S / M / L = 110 / 160 / 230px, kept in device prefs.
- Date groups ("· 24 Sep · Hydrafacial"); tiles with a body-part pill and a hover bar (Edit / Delete), always shown on touch devices (H:236).
- 12 per page, "Load more · N left"; drag and drop.
- **Lightbox:** full-screen; zoom ×1.25 per step (wheel ×1.12), levels 1–6,
  double-click to zoom; keys ← → + − 0 Esc; no backdrop close.
- Uploads use the shared tray.

**Packages:** cards showing "N left", "U of T used", a progress bar and "Valid
till · Next", with "Use a session" and "Book next".

**Team notes:** a list with a composer (≤500 chars). Delete is instant with
Undo.

**Activity panel** (side column, 340–400px): the contact's chat from Leads,
with masked system pills and the Leads composer. A patient with no lead is
Q-F6.

**Visit flow** (D18, on the shared Visit model) — "Start visit" opens five fixed steps; the content is
max 880px wide with a 240ms accordion:

1. Check-in & safety: Consent signed / Before photos taken / Allergies &
   medicines checked.
2. Prescription: ⚡ kits that create an Rx instantly, or "Write prescription".
3. Treatment: gated with "Finish check-in first"; ⚡ Repeat last session / New
   treatment; "Remembered for this patient: …"; the package pill.
4. Invoice: built from today's treatment (unless it's a package session) and the
   Rx medicines — "Create invoice from visit" / "Custom invoice".
5. Collect & share: "Collect ₹X" via UPI / Cash / Card (the first unpaid
   invoice); "Share Rx, invoice & photos".

Pause keeps the state. Complete uses a package session and sets the next
follow-up, computed rather than the prototype's fixed "Oct 26 · 11:00".

**Rx drawer** (1040px):

- **Quick fill:** Print prescription (edit), Repeat last Rx #id, Hair fall kit,
  Post-peel kit, Pigmentation kit.
- **Steps:**
  1. Prescription — date chips, doctor.
  2. Medicines:
     - a quick line, "Type medicine, dose, timing · e.g. flu 0-0-1 af 10d",
       parsing od, bd, tds, hs, sos, af, bf, Nd, Nw, xN and body areas;
     - a Browse panel: All / Often prescribed / Oral / Topical;
     - rows: Medicine · Dose M A N (cycles 0 → 1 → 2 → 0 in sage; SOS butter) ·
       Meal Before / After / More timings · Where · Qty · ×;
     - "N days" recalculates the quantity.
  3. Clinical notes — Notes, Lab report, Today's procedure.
- **Save** "Save prescription"; empty error "Add a medicine".
- Unknown medicines are added to Medical as drafts (Q-M4). Print preview is an 820px drawer. "Save & sell" is dead in the prototype
  (H:4571), but PRD Flow 2 needs it (PRD.md:132): build it to save the Rx and
  open the Medical sale prefilled.

**Treatment drawer** (680px):

- **Template switch:** Skin·laser / Dental / Physio / Gynac / General, each with
  its own fields (a discriminated contract).
- **Steps:**
  1. Session — treatment quick chips, session number, doctor, therapist.
  2. The template's details.
  3. Aftercare — remark; aftercare call No call / Next day / In 2 days / In a
     week, which creates a task (Q-F7).

**Child drawers:**

| Drawer          | Width | Contents                                                                                                                                                                                             |
| --------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload report   | 560   | the prototype drops the files (a defect)                                                                                                                                                             |
| Add package     | 560   | —                                                                                                                                                                                                    |
| Check-in        | 680   | Compared with last visit* (Much better / Better / Same / Worse), score 1–10, In their words, Followed the advice, Plan + Add to offering suggestions. Worse or ≤4 creates a call-back task due in 3h |
| Review          | 560   | Where: Google / Video / Instagram / Internal form / WhatsApp; rating 5–1; link; upload; text. ≤3 creates a task due in 4h                                                                            |
| Feedback picker | 560   | —                                                                                                                                                                                                    |
| Image edit      | 560   | —                                                                                                                                                                                                    |
| Give back       | 560   | —                                                                                                                                                                                                    |
| Report view     | 560   | "Download"                                                                                                                                                                                           |

**Privacy:**

- Money and phones are masked by default and revealed per session (Q-F4).
- Removing a record follows the lifecycle in Q-F3: packages close, appointments
  cancel, sessions reverse, payments refund, invoices get a credit note,
  prescriptions stop, photos hide (H:2508–2512).

Extra skill: `shadcn` (tabs, hover-card, accordion).

### 6.7 Medical (`medical/`, `/medical/$tab`)

**Toolbar:**

- h1 "Medical".
- Tabs: Sales (`Receipt`) · Medicines (`Pill`) · Purchases (`Package`) ·
  Suppliers (`Users`) · Manufacturers (`Package`) · MRs (`Users`) · Payments
  (`Wallet`). The overflow is "More ⌄", grouped Selling / Stock / Buying /
  Money, with 78px reserved.
- Search; saved views; Filters; Columns.
- A per-tab view action: "Prescriptions to fill"; "Send payment reminders"
  (Q-M6).
- Split "New …": Selling (New sale) · Stock (New medicine) · Buying (New
  purchase order, New supplier, New MR, New manufacturer).

The default tab is Q-M5. `medical.md:18`'s "Ledger: All · Money in · Money out"
bar duplicates the Filters "Show" section and is not built.

**Tables:**

| Tab           | Columns                                                                                                                                                                                                                                                                                                | Row actions                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Sales         | Sale #id · Customer (sub "Patient" or "Medical contact") · Medicines ("name ×q", "Batches: …") · Bill (Σ qty × MRP; "− ₹X returned") · Margin (hidden) · Status (Returned lav + Paid sage / Unpaid blush) · When                                                                                       | Collect ₹B (unpaid) · Return medicines · Print · Void sale (unpaid and not returned)                                |
| Medicines     | ID · Medicine (composition, or butter "Needs MRP and composition") · Manufacturer · Stock (Σ batches; Out / Low / OK) · Nearest expiry ("MM/YY · batch"; blush ≤30 days, butter ≤90, counted to the end of the expiry month) · MRP (sub "−20% near expiry") · Best rate (hidden) · Margin % (sage ≥30) | Return expiring stock to supplier · Sell at 20% off / Remove near-expiry discount (≤90 days) · Edit │ Delete        |
| Purchases     | PO (#id + invoice) · Supplier · Items ("N items · N free") · Date · Total · Stage (Ordered sky / Received butter / Paid sage, "+ ₹X paid")                                                                                                                                                             | Ordered: Receive goods · Edit · Cancel order. Received: Pay ₹X · View. Paid: View. Toolbar: "Pay all received · ₹X" |
| Suppliers     | Supplier (+ phone or "Add phone") · Manufacturers · Orders · Payable (blush) · Ageing (blush ≥30, butter ≥7)                                                                                                                                                                                           | Pay ₹X · New purchase order · Edit · Delete (no dues, no open PO)                                                   |
| Manufacturers | name badge · Medicines · Suppliers · MRs                                                                                                                                                                                                                                                               | Edit · Delete (no medicines)                                                                                        |
| MRs           | MR · Represents · Last visit · Next visit · Samples (hidden)                                                                                                                                                                                                                                           | Log visit · Edit · Delete                                                                                           |
| Payments      | the Payments ledger filtered to Medical                                                                                                                                                                                                                                                                | as the ledger                                                                                                       |

Filters: Medicines › Stock (All · Low) and Nearest expiry (Any · 30 · 60 · 90).

**Drawers:**

- **Medicine** (840px, two steps: "Medicine, price & stock" / "Batches &
  supplier prices"):
  - Name*; Manufacturer* (quick-create uppercases, or "New manufacturer" child
    drawer); Composition ("used for substitutes"); Sold with: Prescription only
    / Over the counter;
  - MRP* including GST, with GST 0 / 5 / 12 / 18 and a breakdown: Before GST,
    GST, Best buy rate, Margin (sage ≥30, butter ≥15);
  - a stock-levels widget (Out / Reorder / Overstocked / Healthy; Reorder at,
    Fill up to);
  - batches (Batch, Expiry MM/YY, Qty, Rate) and supplier prices (Supplier,
    Rate*, Free, Lead days).
- **Supplier:** 560px new; 840px edit (adds account history). **MR:** 560px.
- **Log MR visit:** 560px; quick "2 weeks" / "1 month" computed from today.
- **PO** (840px, Order → Items): quick line "azel 20 +2 @180"; save "Create
  order".
- **Goods receipt:** "Tick what arrived", with batch and expiry; "Mark
  received".
- **New sale:** the shared Invoice drawer locked to Medical (§6.9). The md's
  walk-in sale form is the prototype's dead alternative and is not built.
- **Returns:** from patient (680px); expiring stock to supplier (680px).
- **Sale from an Rx:** prefilled.

Sales print A4 as "S-<id>"; PO print is Q-M7.

**Access:** Admin and Pharmacist; Accountant views. The md's Owner is not a role
(Q-U2). Open decisions: Q-M1 (PO payment paths), Q-M2 (void restores stock),
Q-M3 (near-expiry discount at sale).

### 6.8 Clinic stock (`stock/`, `/stock/$tab`)

**Toolbar:** h1 "Clinic stock" · tabs Items · Purchases · Movements (they
scroll) · search "Search item, category or supplier…" · saved views · Filters ·
Columns · "Stock check" (Items only) · "New item" / "New purchase". The Vendors tab (`clinic-stock.md:3`, PRD.md:89) is built per Q-K1.

**Tables:**

| Tab       | Columns                                                                                                                                                                                                                                           | Row actions                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Items     | ID · Item ("per <unit>[ of <size> <mu>] · uses ~<use>/week") · Category · Stock bar ("2.5 tube · 75 g · Out/Low/OK"; Out blush, Low butter, OK sage) · Lasts ("~N days" / "~N weeks" / "No usage"; blush ≤7 days, butter ≤21) · Supplier (hidden) | Use (`Minus`, popover) · Receive stock (`Plus`) · Log usage… (`FileIcon`) · Adjust count (`RefreshCw`) · Edit │ Delete. Row click edits                                  |
| Purchases | ID · Supplier · Invoice (hidden) · Date · Bill · Due (blush) · Status (Paid / Partly paid / Unpaid). Count line "N purchases · ₹X due"                                                                                                            | Pay ₹X (opens Payments "Pay", category Consumables) · Edit │ Delete                                                                                                      |
| Movements | Type (+ Reverted) · Item/party · When · By · Change ("+n / −n unit" or "−₹X")                                                                                                                                                                     | Revert (reason confirm: Logged by mistake / Wrong item / Wrong quantity / Other — "Stock goes back to what it was before this entry. Both entries stay in the history.") |

**Drawers:**

- **Item** (680px; Item → Levels → Supplier):
  - Name*; Category chips (6); Unit chips: tube, bottle, pack, box, kit, piece,
    vial, ampoule, sachet, jar, roll, pair, ml, g, litre;
  - Contents per <unit> ("optional · lets the team use part of a <unit>");
    Measured in: ml / g / pcs / units;
  - In stock (decimals); Usage per week; Minimum; Maximum;
  - Supplier, with a "New clinic vendor" child drawer.
  - Save "Add item" / "Save changes"; errors "Add a name"; toast "Item saved".
- **Purchase** (840px; Bill → Items received → Payment):
  - Supplier*; Invoice no.; Bill date;
  - items (Item / Qty / Rate* / Amount) with the quick line "Type item and
    qty · e.g. gloves 10 @250";
  - Bill amount; Paid: Full / Nothing; preset "Reorder low items".
  - Save "Create purchase"; error "Pick a supplier"; toast "Purchase saved ·
    stock updated".
- **Movement** (560px; Receive stock / Adjust stock / Log usage):
  - Type: Used / Received / Adjust / Damaged / Returned;
  - Quantity ("Counted quantity" for Adjust) with quick chips; Measure in;
  - Used for: LHR / Peel / Facial / Mole removal / General; Remark.
  - Save "Save movement"; error "Only <q> in stock"; toast with Undo.

**Use popover** (300px):

- Anchored below the row button, or above when there's less than 380px of
  space; 160ms.
- Item name and "In stock · <q>"; a Measure-in toggle ("1 tube = 30 g").
- A 44px stepper (− input +) with quick chips 0.25 / 0.5 / 1 / 2 (or 1 / 5 /
  10 / 25 / 50) and Used-for chips.
- An "After" line, or "Only … in stock"; "More details" opens Log usage.
- "Use N unit" is disabled when empty or over stock. Enter saves; Esc closes
  (md).
- An out-of-stock item toasts "<n> is out of stock".

**Stock check** (`min(840px, 100vw − 56px)`):

- Sub: "Type what is on the shelf. Only items that differ are saved, each as an
  Adjust entry."
- "N of M counted"; category chips ("All items" + 6); "Fill rest as matching".
- Grid: Item / In system / Counted / Difference — ✓ "Same as system", or pills
  Not counted / Matches (sage) / +N (sky) / −N (blush).
- Footer: "N item(s) will change" / "Nothing changes yet"; "Save count",
  disabled when nothing changes. Esc closes (md).

**Access:** Admin and Pharmacist; Accountant views. The md lists Therapist,
Front desk and Owner (Q-K2).

### 6.9 Payments (`payments/`, `/payments/$tab`) and the shared Invoice drawer

**Toolbar:**

- h1 "Payments".
- Tabs: Payments (`Receipt`, slug `ledger`) / Pending (`RefreshCw`). They
  collapse into "More ⌄" when space runs out (ResizeObserver plus a 250ms
  re-measure).
- Search "Patient, invoice or receipt" (36px → max 220px); saved views;
  Filters; Columns; "Day close".
- On the ledger tab: "Pay" (outline, `ArrowUpRight`) and "Receive" (dark,
  `ArrowDownLeft`).
- On the Pending tab: a split "+ Add pending" ⌄ with Give ("We pay a patient or
  party back") and Take ("A patient or party pays us").

**Ledger** (receipts and expenses merged; newest first; no sortable columns):

- Columns:
  - Ref — every id displays as `PAY-` (`payments.md:11`);
  - What — "Received" (sage) / "Paid" (blush; butter for expenses; stone for
    money back);
  - When — plus "Edited N× · last ₹X Mode → ₹Y Mode" in butter;
  - From / to — a person cell for patients ("Refund · Credit note CN-### · for
    Invoice #…", "Invoice #785", "Sale · Invoice #785"), or text for suppliers
    ("Money back · …", "Medical PO #431 · bill 1631", or the category);
  - Mode pill; Amount ("+ ₹600" sage / "− ₹180" blush; reversed rows muted);
    By (avatar).
- Grid: `96px 110px 150px minmax(240px,1.8fr) 110px 120px 130px 190px`, minimum
  1,180px.
- Edit and Delete appear only on rows from open days. Clicking a locked row
  toasts "<ref> · <state>". The day lock comes from the server.
- Filters: Show (All / Received / Paid), What, Mode, Created.
- Bulk Export / Print. End line "All entries loaded"; empty "No entry matches".

**Pending** (credits):

- Columns: Ref CR-n · Who (person "Patient" or "Supplier / party") · Which way
  (Give blush, "We pay them back" / Take sky, "They pay us") · Amount ("₹X
  adjusted") · Why ("From PAY-5466 · Received", "Invoice #785", "By hand") ·
  Since · State (Open sky / Returned sage / Received sage / Adjusted lav).
- Grid: `86px minmax(200px,1.4fr) 130px 110px minmax(200px,1.5fr) 100px 120px 230px`,
  minimum 1,240px.
- Open rows: Give back / Got it back (`Wallet`) · Edit · Delete. The delete
  title says "pending", not "payment".
- End line "All pending loaded"; empty "Nothing pending".

**Receive** (560px, one page, "Who is paying"):

- Quick fill, once an invoice is picked: "Full · ₹X" (UPI) / "Half · ₹X" /
  "Cash + UPI".
- **Fields:**
  - Branch: chips, with more than one branch.
  - Patient* — remote search; leads appear disabled, "Lead #N · not a patient
    yet". Required (the prototype doesn't enforce it).
  - Against invoice: chips "#785 · ₹876", peach when picked; "Nothing due" or
    "Pick the patient first".
  - Amount received: Mode / Amount rows, "+ Split · add a mode" (up to 3),
    "Total ₹X · due ₹Y".
  - Reference ("UPI ref / card last 4", e.g. "4321"); Note.

  Reference, Note and Branch are saved; the prototype drops them.

- **Save** "Record ₹X" / "Save ₹X"; the edit log notes the change.
- Sub: "Receipt goes to the patient on WhatsApp" / "Open until the day is
  closed · every change is logged". Toast "₹X received from <pt>".

**Pay** (680px; "Send payment" / "Edit payment out"; "Clinic spend · shows in
day close"):

- Quick fill: Consumables (Medline Surgicals ₹3,200 UPI) · Tea & snacks (Misc
  ₹260 Cash) · Courier (Misc ₹150 Cash).
- **The step sequence varies by input:**
  - Step "Pay against a bill" appears only when the record is new **and** open
    bills exist. It has a Supplier bill picker ("Search PO #, supplier or bill
    no", "Other spend"; groups Medical POs / Clinic stock POs; "Bill 1631 · N
    days pending") and "Pending longest" chips for the 3 oldest (blush ≥30 days,
    butter ≥14).
  - Then "Expense": Category — Medicines blush, Consumables mint, Salary lav,
    Rent sky, Marketing blush, Utilities butter, Maintenance sage, Misc stone;
    Paid to*, with quick chips; Note.
  - Then "Payment": Amount*, quick ₹500 / 1,000 / 2,000 / 5,000; Date (+14 /
    −180 days); Mode Cash / UPI / Card; Bill / receipt upload.
- **Footer:** summary · Delete · Cancel · "Add & another" · "Add expense" /
  "Save changes". Paying a PO raises its paid amount (Q-M1).

**Invoice drawer** (840px; global; opened from the patient file, suggestions,
Medical "New sale" and "Sell medicines"):

- **Type switch:** Clinic sky / Medical sage / Consultation lav. It's locked for
  sales, and switching resets the items.
- **Quick fill:** Print invoice (edit) / Plan · <offering>(×N) / Package ·
  <offering> / Repeat #<last> / New consultation · ₹300 / From Rx #id.
- **Steps:**
  1. "Patient & team" — Branch; Patient*, with a "New patient" child drawer.
     For Medical it is Customer* (patients, leads, medical contacts) plus
     Mobile. Then Team, or "Prescribed by" for Medical.
  2. "Items" / "Medicines":
     - the quick line "lhr face 1 10%" (`%` discount, `@` rate, `+N` free, a
       bare number = qty); "Often billed" top 5; a Browse panel;
     - grid `minmax(0,2.2fr) 88px 84px 64px 52px 100px 30px`: Item · Qty
       (1–9,999) · Rate (read-only) · Disc % · GST (read-only) · Final · ×.
       Typing Final back-solves the discount;
     - offerings are active, available at the branch, and filtered by type, with
       the `ofEff` promo toast;
     - prices below the floor get a red border, "Below the lowest price ₹X…" or
       "Too much discount… ask an admin".
  3. "Payment" — Overall discount %; quick fill "Full · ₹X in UPI" / "Split
     cash + UPI" / "Nothing now"; Paid now rows; Remark ("Shown on the printed
     invoice", and it prints).
- **Money math** — one shared module:
  - base = qty × rate; the line discount comes off base; GST is charged on the
    discounted amount;
  - bill = round(sub − disc + gst − overall − credit note);
  - status: Paid / Partly paid / Due.

  The prototype applies the overall discount after GST (Q-G7).

- **Save:**
  - Medical: create the sale and deduct stock FEFO.
  - Offerings with more than one session create patient packages.
  - A due amount creates an automatic "Payment due" task.
  - Toast "<Type> invoice #N created".
- **Print** the A4 invoice (§3.5).

**Add pending** (680px, stacked; blush for Give, sky for Take):

- Steps: "Which way" (Give / Take; Who*; Amount*) → "Why" (Reason chips; For
  invoice; Settle by, which creates a task; Note ≤300).
- Reason chips:
  - Give: Charged twice / Advance not used / Package cancelled / Overpaid /
    Returned items / Other.
  - Take: Short payment / Damaged goods returned / Advance given / Loan to
    staff / Other.
- Save "Save · give later" / "Save · take later".

**Give back / Got it back** (560px): Mode / Amount rows; "Return ₹X" / "Record
₹X". Giving back to a patient also issues credit note CN-101 onward.

**Day close** (`min(1040px, 100vw − 56px)`):

- It sits below the page drawers, and its × is in the header.
- **Day picker:** up to 120 days back, no future.
- **The states run in order:**
  1. **Gate:** opening float = recounted value, else the previous count, else
     2,000; labelled "Recounted" / "Carried from <prev> close" / "Default
     float". Actions "Accept ₹X" / "Accept recount"; "You’re starting the day
     as <Me> · this is stamped on the day".
  2. **Working:** Cash in · out; Expected = float + cash net; Counted;
     difference pill; Net by mode, with split rows counted per mode (Q-G5);
     staff chips. "Close day" needs a count: "Count the cash first".
  3. **Report:** Collected · Paid out · Cash counted · Expected · Difference
     ("Drawer matched" / "Extra in drawer" / "Short in drawer"); "What
     happened"; "Reopen" (Q-G1).
- **"Review every entry"** shows in every state: "k of n checked" with a
  progress bar; "Mark as checked" is a server mutation. Columns: Q-G11.
- Auto-close is Q-G2; "Previous closes" lists up to 6.

**Access:** Admin, Front desk and Counsellor view, create and edit; Accountant
views. Pay is gated by Create and Day close by the `dayclose` ability (Q-G4).

### 6.10 Tasks (`tasks/`, `tasks/$taskId/`)

- **Toolbar:**
  - h1 "Tasks";
  - tabs To do* / Snoozed / Done;
  - search (300ms, "/");
  - Type multi-select over the 13 rules;
  - Scope: Mine / Everyone;
  - Rules popover (400px);
  - "New task" — md-only (Q-T4).
- **List:**
  - Groups: Overdue (blush) / Due today (butter) / Coming up (sky); then
    Snoozed; then Resolved.
  - Rows: grid `32px 2fr 1fr 150px 110px` with a 3px left bar. Each row has the
    rule tile; the title with a "Clinozy can do this" pill and the reason; the
    person chip (contact card); the owner pill (team card) or "Anyone"; the
    relative due date.
- **Task drawer** (900px = 560 + a 340px activity column):
  - Sections: "1 What · 2 How ("Let Clinozy do it") · 3 Close", with outcomes
    and a note.
  - Snooze: 1h / 3h / Tomorrow 10:00 / Next week. Assign.
  - Composer: WhatsApp / Call note / Note.
  - **The next step depends on the outcome:** Log check-in → the check-in
    drawer; Happy → the review log; No answer → snooze 3h, no drawer. 380ms
    after closing with an outcome, the "What’s next for {first}?" child drawer
    (560px) opens with "Nothing next" / "Create task".
- **Rules:** 13 — reply, failed, follow, claim, confirm, arrive, rebook,
  feedback, aftercare, nextvisit, noreply, manual, unhappy. They run on the
  server (fixture job now); one model with Today (Q-T3).
- **Empty states** (md, unreachable in the prototype):
  - To do: "Nothing needs you right now. New tasks appear here as leads write,
    visits come up and feedback arrives." (`tasks.md:79`);
  - Snoozed: "No snoozed tasks";
  - Done: "Nothing resolved yet today".
- **Access:** every role sees its own tasks; the Everyone scope is for Admin
  (PRD.md:102). The prototype limits Tasks to Admin, Doctor, Front desk and
  Counsellor, with Therapist view-only.

### 6.11 Offerings (`offerings/`, `/offerings/$tab`)

- **Toolbar:**
  - h1 "Offerings";
  - tabs Offerings (`Tag`) / Offers (`Sparkles`), which scroll;
  - search "Search name or search term" / "Search offers or codes";
  - saved views; Filters; Columns;
  - "New offering" / "New offer".
- **Offerings table:**
  - Columns:
    - ID; Offering (name, with the description or "Valid N days");
    - Category (Consultation sky, Treatment sage, Package lav, LHR blush,
      Product butter);
    - Price — the effective `ofEff` price at 600, sub "was ₹<list> · <n>% off"
      (sage) or "list price";
    - Offer pill; Branches or "All branches"; Duration "N min";
    - Sessions "N sessions" + " + N free" (sub "valid N days");
    - Status; Updated (hidden).
  - Actions: Edit │ Delete.
  - Grid: `64px minmax(200px,1.6fr) 120px 130px minmax(130px,1fr) minmax(120px,.9fr) 84px 130px 104px minmax(150px,1fr) 72px`,
    minimum 1,340px.
  - Every column sorts except Offer and Branches.
- **Offers table:**
  - Columns:
    - Offer — name pill and code;
    - Type — "20% off" / "₹500 off" / "at ₹3,999" / "+1 session", with the kind
      as sub;
    - Applies to — 2 names + N, with the note as sub;
    - Branches;
    - Valid — "<from|Now> – <to|no end>", sub "Ends today" / "Ends tomorrow" /
      "Ends in N days" / "Starts …" / "Over";
    - Status — Running sage / Scheduled sky / Ended stone / Paused butter;
    - Updated (hidden).
  - Actions: Edit · Pause / Resume (not when Ended) · Delete.
  - Sorted Running, Scheduled, Paused, Ended.
- **Offering drawer** (680px; "Used in bookings, invoices and packages"):
  - Quick fill: Single session / 6-session pack / LHR 10-pack / Consultation.
  - **Steps vary by input:** two steps ("Offering, price & sessions" / "Time,
    validity & details"); editing an offering with live offers adds an "Offers
    on this" step, making three.
  - **Fields:**
    - Name* (≤60); Category; Colour (6 tones); Available at (All branches /
      per branch);
    - Price*; Offer price; Sessions (quick 1 / 4 / 6 / 8 / 10);
    - GST rate %; GST Inclusive / Exclusive (Q-O3);
    - Lowest price, a toggle and field shown only with the `floor` ability: "the
      desk can never bill below this";
    - read-only info: Billed today, Offers on this;
    - Duration (quick 15–90 min); Validity in days (None / 3 mo / 6 mo / 1 yr);
    - Search terms; Description;
    - Status "Active · bookable" / "Inactive · hidden".
  - Errors: "Add a name", "Add a price", "Offer price can’t be above the price",
    "Lowest price can’t be above the offer price". The automatic floor is Q-O4.
- **Offer drawer** (680px, three steps):
  1. "Offer" — Name* ("e.g. Diwali glow"); Code (≤12, uppercase, "GLOW20");
     Type — % off lav / ₹ off sky / Fixed price butter / Extra sessions sage,
     which resets the value to 10 / 500 / '' / 1; the value field; Colour.
  2. "Where it applies" — Offerings*; Branches; Starts / Ends (+120 / −60 days);
     a preview of up to 6 rows, "₹<offer> → ₹<fin>".
  3. "Notes" — Note; Status "Live · applies automatically" / "Paused".

  Errors: "Name the offer", "Pick at least one offering", "Set the discount /
  free sessions / amount", "Ends before it starts". Esc closes it; the
  prototype misses this.

- **Shared pure functions:**
  - `offerState`: Paused manual; otherwise before the start → Scheduled; after
    the end → Ended; else Running.
  - `ofEff`: the lowest price offer wins without stacking; extra sessions take
    the maximum and stack; the result is clamped up to the floor (Q-O2).
- **Stacked "New offering"** (560px, from the invoice item picker): Name*,
  Price*, Duration, Category. The prototype clones the first row — don't copy
  that.
- **Access:** Admin only (Q-O1).

### 6.12 Users (`users/`, `/users/$tab`)

**D17: this room is the single members surface.** Team reads clinozy-be members joined with fixture staff profiles; Settings' Members and Roles sections become links here. Reuse, don't rebuild:
Team uses the existing `src/core/resources/members.resource.ts`
(`fe-resource-crud`) and the existing invite and role units
(`InviteMemberDialog`, `CreateRoleDialog`) and their data hooks, restyled and
moved out of Settings — never duplicated.

- **Toolbar:**
  - h1 "Users";
  - tabs Team (`Users`) / Roles & access (`Shield`) / Branches (`MapPin`);
  - search on Team only ("Name, email, mobile or #ID", ≤80);
  - saved views and Filters on Team and Branches; Columns on Team;
  - "New user" / "New role" / "New branch".
- **Team table:**
  - Columns:
    - ID; User (32px avatar in the user's colour, name, phone);
    - Email (hidden);
    - Roles pills — the first titled "Main role", the rest "Also";
    - Branches (hidden with one branch or fewer);
    - Working hours (hidden; "Mon–Sat · 10:00–19:00");
    - Commission (hidden; Q-U10);
    - Status Active / Inactive; Updated (hidden).
  - Actions: Edit │ Delete. There is no delete for yourself; the prototype
    hard-codes id 12. Guard the last Admin too.
  - Grid: `56px minmax(200px,1.4fr) minmax(170px,1.1fr) minmax(150px,1fr) minmax(130px,.9fr) minmax(170px,1fr) 96px 100px 150px 72px`,
    minimum 1,340px.
  - Filters: Roles, Branches, Status, Created. Bulk Message / Export / Print
    (Q-P8). Empty: Q-U5.
- **Roles & access:** a master–detail view, neither a drawer nor a table.
  - Grid `minmax(220px,264px) minmax(0,1fr)`.
  - **List:** a 10px tone square, name, description, up to 3 avatars + N.
    Default selection: Front desk.
  - **Detail header:** a 40px tile with `Shield` 18, the name (an input for
    custom roles, ≤24), the description, "Copy access from ⌄", and "Preview as
    {name}" (`Eye`; disabled for Admin).
  - **People with this role:** chips that open the user.
  - **Matrix:** Section · View · Create · Edit · Delete · Row, grid
    `minmax(200px,1fr) repeat(4,64px) 72px`, minimum 560px. Nine rows, each
    with a 26px section tile, and a row pill Full / Some / None.
    - Rules: turning View off clears the rest; turning Create, Edit or Delete
      on forces View; Row toggles all four.
  - **Special permissions:** 11 switch cards, `auto-fill minmax(260px,1fr)`.
  - **Changes apply instantly** (Q-U6). Admin is locked: "Admins always have
    full access". Without the `perms` ability: "You can’t change roles · ask an
    admin".
  - **Note line:** the three prototype variants.
- **Branches table:**
  - Columns: Branch (name pill, "Main" pill) · Address (primary) · Contact ·
    Opening hours · Team avatars · Default people ("Doctor · {name}" / "Not
    set") · Status Open / Closed.
  - Actions: Edit; Delete, except for the main branch. The prototype asks twice;
    don't copy that.
- **User drawer** (680px; "Sign-in, roles, branches and working hours"):
  - Quick fill: ⚡ Doctor · 10:00–19:00 / Therapist · 10:00–19:00 / Front desk ·
    09:30–19:30 / Pharmacist · 09:00–21:00.
  - **Two steps:** "Profile, roles & branches" → "Working hours & pay". The
    prototype wins over `users.md:54`'s three.
  - **Fields:**
    - Name*; Mobile; Email* (format validated, md);
    - an email invitation in place of the Password field (D17);
    - Colour (8); Roles* ("pick one or more · access adds up"); "Gets access
      to" (read-only); Branches;
    - Days ("Appointments only offer these days", which drives the slot grid);
      From / To in 30-minute steps;
    - Commission (quick 0 / 5 / 10 / 15%);
    - Status "Active · can sign in" / "Inactive · signed out".
  - **Footer:** Delete · Cancel · "Create & add another" (with real save and
    validation) · "Create user" / "Save changes".
- **Branch drawer** (680px; three steps):
  1. "Branch & address":
     - Name*; Colour (9); Main; Status;
     - Address line 1*, line 2, Area, City, PIN (6 digits, never masked), State.
  2. "Contact & opening hours" — Phone; Email; GSTIN (15, uppercase); Days;
     Opens / Closes.
  3. "People" — Team; default doctor, front desk, therapist (single) and
     pharmacist. The defaults preselect in forms at that branch.

  Errors: "Name the branch" → "Add the address" → "A branch called {n} already
  exists". Exactly one branch is main. Esc closes it; the prototype misses
  this.

- **View-as:** "Preview as" sets `previewRole`, closes drawers, toasts
  "Previewing Clinozy as {r}", and moves to the first room that role can view.
  Exit toasts "Back to your own access" (Q-U11).
- **Access:** Admin (Users View).
- **Roles:** the seven prototype roles plus a seeded Marketing role (Q-U2,
  PRD.md:23).

### 6.13 Visit sheet (prototype-only, no md; D18)

- **Shape:** full-screen, opaque, fixed above the app, with no animation
  (H:2258–2457). Built with dialog or page semantics and focus management.
- **Header band** (butter): name 21/600, meta, kind pill, 5 chips, "Full
  profile", "Close · Esc".
- **Tabs:** History | Consult & Rx | Treatment | Checkout.

| Tab          | Contents                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| History      | Filter pills All / Clinical / Money / Messages / Audit; a timeline list; a "Next for this visit" aside                                                                                                                                                                   |
| Consult & Rx | A 240px history column. The note: Complaint, Findings (dictation draft), Diagnosis chips, Plan. Rx cards: Review / ✓ Reviewed, Remove, Copy last Rx, Add chips, Print in English / ગુજરાતી / हिंदी (Q-X2). Approval is gated: at least one line, and every line reviewed |
| Treatment    | A 6-segment progress bar; settings table (Fluence / Spot size / Pulse); Areas chips; Complete session; a 3 × 2 photo grid                                                                                                                                                |
| Checkout     | Bill lines and totals → "Create bill" → modes UPI / Cash / Card / Split, amount and balance → "Receive". Toast "₹X received by <mode> · RCT/26-27/0388 · receipt sent on WhatsApp"                                                                                       |

- **Commit timings** (750ms, +900ms after Receive) and dictation (1,200ms) are
  simulation (D15).
- **The prototype's content is static** (one hard-coded patient). It needs the
  Visit, Rx, Treatment and Bill contracts.
- **Entry:** from Today's lane actions. The patient file's "Start visit" opens its own 5-step flow; both write the same Visit (D18).

## 7. Deviations

### 7.1 md over the prototype

**Built to the md:**

| What                                                                                                                                                                                                                                                                                      | md                                                                                                          | Prototype                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Drawer initial focus, focus trap, focus return                                                                                                                                                                                                                                            | `_patterns.md:14`; each screen's "Initial focus"                                                            | none (H:3541–3640)                                                  |
| Esc closes every drawer, child drawer and popover: branch drawer, offer drawer, Day close, contact editor, filters, Use popover, Stock check                                                                                                                                              | `_patterns.md:10`; screen dismiss rows                                                                      | gaps in the Esc chain (H:4273)                                      |
| Floating × animates on every drawer (200ms after 200ms)                                                                                                                                                                                                                                   | `_patterns.md:68`                                                                                           | only some drawers (H:971, H:1573)                                   |
| Errors below the field, plus a toast naming the first missing field; email-format and 10-digit validation                                                                                                                                                                                 | `_patterns.md:13`, `appointments.md:40`, `users.md:29–30`                                                   | toasts only, after the save delay (H:4222–4224)                     |
| Save disabled until dirty, and a discard guard (per Q-P1)                                                                                                                                                                                                                                 | `_patterns.md:12`                                                                                           | always enabled; Cancel closes                                       |
| Per-room empty copy and hints. Users: "No team members yet" / "Invite doctors, therapists and front desk so work can be assigned." Payments: "Nothing to collect here" / "Receipts, invoices and dues show up as soon as a visit is billed." Offerings, Medical, Stock and Tasks likewise | `users.md:90`, `payments.md:85`, `offerings.md:86`, `medical.md:86`, `clinic-stock.md:82`, `tasks.md:79–81` | the generic "Nothing here yet. Try another tab or search." (H:4327) |
| Every list's empty state offers its "New …" button                                                                                                                                                                                                                                        | `_patterns.md:52`, PRD.md:250                                                                               | missing in places (Offerings: `onNew` not passed)                   |
| States the prototype lacks: Month loading skeleton; chat skeleton and error; Snoozed and Done empties                                                                                                                                                                                     | `appointments.md:105`, `leads.md:100`, `tasks.md:80–81`                                                     | none                                                                |
| Shell: notifications bell, Tasks shortcut, the 36px system-banner strip                                                                                                                                                                                                                   | `shell.md:22, 56`                                                                                           | absent                                                              |
| Manual "New task"                                                                                                                                                                                                                                                                         | `tasks.md:17`                                                                                               | unreachable (Q-T4)                                                  |

**md-only, not built** (the prototype wins):

- Today's Done lane (`today.md:18`; D20).
- Medical's "Ledger" view bar (`medical.md:18`).
- The Leads bulk bar and notes field (Q-L2, Q-L3).
- The Stock "Vendors" tab (Q-K1).
- A "More ⌄" tab overflow and split "New ⌄" on rooms where the prototype
  scrolls tabs or has a plain button.
- Appointment resources: rooms and machines (Q-A1).
- Owner and Marketing roles (Q-U2, Q-L5).
- A role drawer (`users.md:6`): it's master–detail.
- A min-price column in Offerings (`offerings.md:22`).
- Lead table folding (`leads.md:18`): it scrolls.

### 7.2 Project rules over the source

- **Tokens.** Only semantic tokens and tone tokens. The prototype's inline
  styles become Tailwind classes; none of its hex values reach components
  (`validate:tokens`).
- **Primitives.** shadcn throughout: `sheet`, `popover`, `command`,
  `hover-card`, `tabs` and the rest. The prototype's markup sets the look only,
  never the DOM. The table is the shared `DataTable`.
- **Icons.** Registry only, with stroke from the icon-weight axis. No digits in
  names: `Columns3` and `Trash2` arrive renamed on the import side.
- **Copy.** Every string is an i18n key across 11 locales, with the parity
  gate.
- **Settings** stays the `#settings/*` hash modal. Its Members and Roles sections link to the Users room (D17).
- **Fonts** are self-hosted (CSP `font-src 'self'`).
- **Phone (D10):**
  - drawers become full-width Sheets;
  - nothing scrolls the page sideways — tables scroll inside their card;
  - floating bottom surfaces ride above `--floating-bottom-offset`.
- **Auth.** "Log out" calls `logout({ reason })`. The signed-out overlay (H:337)
  is not built: the platform's session flow owns sign-out, and drafts kept on
  the device after sign-out conflict with the memory-only security model.
- **Behaviour is env-driven.** No simulated latency ships; fixture rooms are
  gated through `VITE_DISABLED_MODULES` (D8).
- **No inferred API contracts.** Fixtures with `REPLACE_WITH_API` markers; no
  `apiClient` literal for a route clinozy-be doesn't serve.
- **Corner radius.** Named radius steps follow the Corner radius axis; pills
  carry `data-slot="pill"`.
- **Right-to-left.** Arabic is a UI locale, so layouts use logical properties
  (`validate:logical`): drawers anchor to the inline end, the floating × sits
  outside the inline-start edge, sticky row actions sit at the inline end, and
  the patient-file rail sits at the inline start.

### 7.3 Prototype defects fixed, not copied

| Defect                                                                                                       | Evidence                    | Fix                                                                |
| ------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------ |
| Toasts render under drawers                                                                                  | H:2480                      | toaster above every overlay                                        |
| Focus is an inset tint at 1.15:1                                                                             | H:78                        | keep the tint and add the `ring`                                   |
| Segmented-tab labels at 4.40:1 on `muted`                                                                    | H:50–54                     | `#52525b` (7.03)                                                   |
| The lead drawer isn't a dialog and manages no focus                                                          | H:1573–1574                 | modal `sheet`                                                      |
| Calendar blocks and month cells are `role=button` with no key handler                                        | H:1884, H:1906              | real buttons with Enter / Space                                    |
| Calendar grid lines and past shading are hard-coded light                                                    | H:1882–1883, H:1895–1896    | tokens                                                             |
| Alias rooms bypass RBAC; the palette ignores access; Users renders unchecked                                 | H:3102, H:4361–4364, H:4904 | `useClinicAccess` everywhere                                       |
| Validation runs after the "Saving…" delay                                                                    | H:4222–4224                 | validate before submitting                                         |
| Relations join by name; dates are display strings                                                            | B, D, E reports             | ids and ISO datetimes                                              |
| Hard-coded people, dates and ids: "Asha (you)", "Oct 26 · 11:00", "#3509", Rhea Shah, fixed quick-date chips | H:5395, C, A reports        | computed values                                                    |
| Confirm titles "Remove lead this lead?", "Void sale this sale?", "Cancel order this purchase order?"         | H:4210                      | "<Verb> this <kind>?"                                              |
| The first lead row always looks selected                                                                     | H:5398, H:5404              | selection only when open                                           |
| "Create & add another" skips the save and wipes the form on error                                            | H:4992, H:5289              | the real save path                                                 |
| PIN code masked as a password in step previews                                                               | H:3619                      | mask only passwords                                                |
| Receive saves without a patient and drops Reference, Note and Branch                                         | H:4833                      | required and saved                                                 |
| The invoice remark never prints (`note` vs `remark`)                                                         | H:4183, H:4824              | one field                                                          |
| The Day-close review State column and actions are empty (index bug)                                          | H:4900 vs H:4869            | Q-G11                                                              |
| Split and Credit payments are left out of the Day-close mode totals                                          | H:4872                      | per-mode rows (Q-G5)                                               |
| Undo after a status change restores only the status                                                          | H:5394–5396                 | Undo reverts the side effects too                                  |
| Stacked "New offering" clones the first offering                                                             | H:3840                      | a fresh record                                                     |
| The month view and filter mini-calendar share one offset                                                     | H:5675, H:5698              | decoupled                                                          |
| Created and Follow-up dates are synthetic hashes                                                             | H:3643                      | contract fields                                                    |
| "Releasing today" matches tomorrow                                                                           | H:5397, H:5905              | correct buckets                                                    |
| The resize handle's ARIA range is 340–720; the real clamp is 360–680                                         | H:1649, H:5877              | the same values                                                    |
| A branch row delete asks twice; Undo desyncs                                                                 | H:4327, H:4959, H:4965      | one confirm, consistent state                                      |
| Renaming a role overwrites a duplicate                                                                       | H:4947                      | uniqueness check                                                   |
| The contact editor commits on backdrop and isn't in the Esc chain                                            | H:4273, H:5614              | Q-P1                                                               |
| The team card misreads `US_SEED`                                                                             | H:5885                      | typed data                                                         |
| `style-hover` attributes with bindings are invalid at runtime (86 of 811)                                    | `support.js` (I2)           | build to the md's intent; e.g. the pinned-tab hover, `shell.md:38` |

## 8. Verification plan

1. **Side-by-side, per screen, per state:**
   - Viewports: 1440px and 1024px for fidelity; 375px for "no breakage"
     (D10). Light and dark.
   - States: default, loading, empty, filtered-empty, error toast, view-only,
     each drawer and popover open, and every input-dependent step variant
     (New lead ×4, Pay ×2, Offering ×2).
   - Source: serve `iterations/launch-2026-09-30-jxmr/` from a local static server — the runtime
     re-fetches its own URL and loads React from unpkg (I2), so `file://`
     fails. Open it in the in-app browser at the same viewport and click to the
     same room and state.
   - Per screen, walk the UI against the source: text, font size, colour,
     background, spacing, radius, border, shadow, icons, layout, states and
     motion (`kickoff-prompt.md`, Verify & close).
   - One right-to-left pass per screen, in Arabic at 1440px.
2. **Static gates, every PR:**

   ```bash
   pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint
   ```

   Plus `pnpm validate:logical`, `pnpm validate:i18n`, `pnpm validate:i18n-parity`, `pnpm sync:check`,
   `pnpm build:check` (rooms stay lazy; nothing heavy on the entry chunk) and
   `pnpm biome:check`.

3. **Unit tests** (`fe-test-generation`), colocated per unit, with `vitest-axe`
   (portaled dialogs through `axeForDialog`). Pure-function suites for:
   `pyTot`, `ofEff`, `offerState`, hold/claim, the appointment status guards,
   calendar geometry and load bars, fold ranking, stock runway, the Rx
   quick-line parser, and the invoice quick-line parser.
4. **Contrast test** for the preset's text pairs (L-05), proved both ways: it
   fails on the 4.40 pair, passes on the fix.
5. **Coverage:** changed lines ≥ 90% (`pnpm coverage:patch`); the coverage
   ratchet and the TSDoc budget never drop.
6. **E2E, local only** (clinozy-be on :3000): a smoke spec per room with hybrid
   selectors. After fidelity sign-off, light and dark baselines per route (`fe-visual-regression`), and the axe lane (`tests/e2e/accessibility.e2e.test.ts`).
7. **Recap** (`fe-design-ditto` Step 6): the closed ledger, what was built,
   what still differs from the source and why, and what couldn't be verified.
8. **Freeze** once the build matches: set `Status: frozen` in
   `iterations/launch-2026-09-30-jxmr/README.md` in the last commit before this
   iteration's branch merges to `main`. After the merge the folder is never
   edited; a correction is a new `fix` iteration.

## 9. Delta ledger

Status for every row: `open | in progress | done | deferred(user-OK)`. Each row has an
assignee — `—` until someone takes it. **Success may not be reported while any row
is open.**

| #    | Work item                                                                                                                                                                                                                                                    | Skill(s)                                                                            | Depends on             | Assignee | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------- | -------- | ------ |
| L-01 | **Gate:** confirm D1–D16 (RED-1–4 answered: D17–D20), confirm or amend the Appendix D defaults                                                                                                                                                               | — (you)                                                                             | —                      | —        | open   |
| L-02 | Self-host Inter and JetBrains Mono (`@fontsource/*`); dependency and lockfile in one commit                                                                                                                                                                  | `fe-platform-hygiene`                                                               | L-01                   | —        | open   |
| L-03 | Preset tokens: theme blocks in `index.css`, tone tokens in `@theme`, the 25 new tokens and the Appendix E colour map, compact viewport rule                                                                                                                  | `fe-theme-axis-audit`                                                               | L-01                   | —        | open   |
| L-04 | Preset registration: swatch (and log the picker gap), `THEME_PRESETS`, `BASE_PRESET` split, `DEFAULT_PRESET`, `PRESET_PRIMARY` + drift test, persisted-preference migration                                                                                  | `fe-theme-axis-audit`                                                               | L-03                   | —        | open   |
| L-05 | Contrast unit test over the preset's text pairs, proved both ways                                                                                                                                                                                            | `fe-guard-authoring`                                                                | L-03                   | —        | open   |
| L-06 | Theme catalog docs, `theming.md`, icon-weight default `thin`                                                                                                                                                                                                 | `fe-theme-axis-audit`, `fe-documentation-maintenance`                               | L-04                   | —        | open   |
| L-07 | Add shadcn primitives: sheet, tabs, toggle-group, hover-card, command, accordion, scroll-area, radio-group, resizable                                                                                                                                        | `shadcn`                                                                            | L-01                   | —        | open   |
| L-08 | Icons: 35 registry exports plus 2 local marks (4 edits each; confirm the collision-name convention)                                                                                                                                                          | `fe-design-ditto`                                                                   | L-01                   | —        | open   |
| L-09 | Shell variant `sectionBar`: header slots, All sections popover, pinned tabs + More, search button, utilities, branch picker, user menu, View-as bar, relocation table                                                                                        | `fe-design-ditto`, `shadcn`, `fe-e2e-testids`                                       | L-04, L-07, L-08, L-14 | —        | open   |
| L-10 | Make it live: resolver default, shuffle pinned off, not persisted, `resolve-app-shell.test.ts`                                                                                                                                                               | `fe-test-generation`                                                                | L-09                   | —        | open   |
| L-11 | Fix the four errors in the `fe-design-ditto` surface-audit table                                                                                                                                                                                             | `fe-agent-os-authoring`                                                             | —                      | —        | open   |
| L-12 | Manifest-driven nav: generalise `NAV_ITEMS` / `DashboardNavLink` and the palette's nav group                                                                                                                                                                 | `fe-route-island`                                                                   | L-09                   | —        | open   |
| L-13 | Update the appointment URL sketch in `routing-and-tenancy.md`                                                                                                                                                                                                | `fe-documentation-maintenance`                                                      | L-01                   | —        | open   |
| L-14 | `useDevicePrefsStore` (persisted, versioned) and `useUIStore.previewRole`, with tests                                                                                                                                                                        | `fe-test-generation`                                                                | L-01                   | —        | open   |
| L-15 | Extend `DataTable`: fold engine, sticky actions, hover checkbox, bulk bar, virtualisation, column chooser, saved views, end line, j/k                                                                                                                        | `shadcn`, `fe-test-generation`                                                      | L-07, L-14             | —        | open   |
| L-16 | Room toolbar and Filters popover (pending → Apply → URL; Created / Follow-up presets; flip / clamp)                                                                                                                                                          | `fe-design-ditto`                                                                   | L-15                   | —        | open   |
| L-17 | Record drawer: steps accordion, quick fill, footer, child stack, focus / Esc / dirty rules (Q-P1)                                                                                                                                                            | `shadcn`, `fe-http-forms-errors`                                                    | L-07                   | —        | open   |
| L-18 | Picker (popover + command) and date / time pickers on `LocalizedCalendar`                                                                                                                                                                                    | `shadcn`                                                                            | L-07, L-14             | —        | open   |
| L-19 | Reason confirm, extending `ConfirmDialog`                                                                                                                                                                                                                    | `shadcn`                                                                            | L-07                   | —        | open   |
| L-20 | Toasts above drawers, with Undo, through `notify`                                                                                                                                                                                                            | `fe-design-ditto`                                                                   | —                      | —        | open   |
| L-21 | Hover cards (contact, team); cells (tone pill, person, avatars, id, money); `EmptyState` and skeleton usage                                                                                                                                                  | `shadcn`                                                                            | L-07                   | —        | open   |
| L-22 | Print templates (invoice, sale, Rx) using org / branch identity                                                                                                                                                                                              | `fe-design-ditto`                                                                   | L-24                   | —        | open   |
| L-23 | Upload tray on clinozy-be uploads (limit per Q-P5)                                                                                                                                                                                                           | `fe-http-forms-errors`                                                              | L-01                   | —        | open   |
| L-24 | Clinic data layer: shared contracts, fixtures, query hooks, branded ids, prototype seeds converted                                                                                                                                                           | `fe-http-forms-errors`, `fe-test-generation`                                        | L-01                   | —        | open   |
| L-25 | `useClinicAccess`, the fixture matrix, View-as, and access in the palette                                                                                                                                                                                    | `fe-routing-tenancy`                                                                | L-24                   | —        | open   |
| L-26 | Module ids for the clinic rooms; `VITE_DISABLED_MODULES` profiles per environment                                                                                                                                                                            | `fe-platform-hygiene`                                                               | L-01                   | —        | open   |
| L-27 | i18n: 11 namespaces plus `clinic` and `common` chrome; non-English locales per Q-X1                                                                                                                                                                          | `fe-i18n-constants`                                                                 | L-01                   | —        | open   |
| L-28 | Extend the ⌘K palette: clinic groups, forms open directly, access-aware                                                                                                                                                                                      | `fe-design-ditto`                                                                   | L-25                   | —        | open   |
| L-29 | Global keyboard and inputs: "/", Esc cascade, "G · 1–9" (Q-S2), double-click guard, auto-capitalise                                                                                                                                                          | `fe-design-ditto`                                                                   | L-09                   | —        | open   |
| L-30 | Offerings island: tables, offering drawer (conditional steps), offer drawer, `ofEff` / `offerState`, stacked New offering                                                                                                                                    | `fe-page-scaffolding` → `fe-route-island`, `fe-http-forms-errors`                   | L-15–L-27              | —        | open   |
| L-31 | Users island (D17): Team on clinozy-be members + staff profiles with invitations, Roles & access, Branches, View-as; Settings' Members and Roles sections become links; reuses `members.resource.ts` and the invite / role units; gated on `membership:read` | `fe-page-scaffolding` → `fe-route-island`, `fe-routing-tenancy`, `fe-resource-crud` | L-30                   | —        | open   |
| L-32 | Patients island, create dialog, quick-add (Q-P2)                                                                                                                                                                                                             | `fe-page-scaffolding` → `fe-route-island`                                           | L-31                   | —        | open   |
| L-33 | Leads list: views, filters, cursor infinite scroll, virtualisation, j/k                                                                                                                                                                                      | `fe-page-scaffolding` → `fe-route-island`                                           | L-32                   | —        | open   |
| L-34 | Lead drawer `/leads/$leadId`: detail + chat, resize, tracker, claim / release / assign, composer, suggestions, Book it                                                                                                                                       | `shadcn`, `fe-http-forms-errors`                                                    | L-33                   | —        | open   |
| L-35 | New lead (conditional steps), contact editor, remove lead                                                                                                                                                                                                    | `fe-http-forms-errors`                                                              | L-34                   | —        | open   |
| L-36 | Appointments: Agenda, toolbar, filters, quick view                                                                                                                                                                                                           | `fe-page-scaffolding` → `fe-route-island`                                           | L-35                   | —        | open   |
| L-37 | Day / Week / Month calendars (geometry and load pure functions, now-line, +N more)                                                                                                                                                                           | `fe-test-generation`                                                                | L-36                   | —        | open   |
| L-38 | Booking drawer (create / edit) and status popover (guards, cancel reason, side effects)                                                                                                                                                                      | `fe-http-forms-errors`                                                              | L-37                   | —        | open   |
| L-39 | Payments island: ledger, Pending, Receive, Pay (conditional step), Add pending, Give back, Use on next bill (Q-G9)                                                                                                                                           | `fe-page-scaffolding` → `fe-route-island`, `fe-http-forms-errors`                   | L-38                   | —        | open   |
| L-40 | Shared Invoice drawer, the `pyTot` money module, floor rules, packages, the "Payment due" task, print                                                                                                                                                        | `fe-http-forms-errors`, `fe-test-generation`                                        | L-39, L-22             | —        | open   |
| L-41 | Day close drawer                                                                                                                                                                                                                                             | `fe-design-ditto`                                                                   | L-39                   | —        | open   |
| L-42 | Patient file layout: file bar, section popover, pins, rail, Up next, Activity panel, privacy mask                                                                                                                                                            | `fe-page-scaffolding` → `fe-route-island`                                           | L-40                   | —        | open   |
| L-43 | Patient file sections: Clinical notes bento, suggestions, feedback, the tables, Packages, Team notes                                                                                                                                                         | `fe-design-ditto`                                                                   | L-42                   | —        | open   |
| L-44 | Photos: albums, visit filter, sizes, lightbox, uploads                                                                                                                                                                                                       | `fe-design-ditto`                                                                   | L-42, L-23             | —        | open   |
| L-45 | Rx drawer (parser, browse, print, "Save & sell" per PRD Flow 2), Treatment drawer (templates), and the child drawers                                                                                                                                         | `fe-http-forms-errors`, `fe-test-generation`                                        | L-42                   | —        | open   |
| L-46 | Overview section, the default (D19): bento + activity timeline                                                                                                                                                                                               | `fe-design-ditto`                                                                   | L-43                   | —        | open   |
| L-47 | Tasks island and `$taskId` drawer: outcomes, snooze, assign, "What’s next", composer, rules fixture                                                                                                                                                          | `fe-page-scaffolding` → `fe-route-island`                                           | L-45                   | —        | open   |
| L-48 | Today island: lanes, cards, the prototype's stage machine (D20), work-queue aside                                                                                                                                                                            | `fe-page-scaffolding` → `fe-route-island`                                           | L-47                   | —        | open   |
| L-49 | Visit (D18): the sheet and the flow on one Visit model, linked to the appointment                                                                                                                                                                            | `fe-design-ditto`, `fe-http-forms-errors`                                           | L-48                   | —        | open   |
| L-50 | Medical island: 7 tabs, drawers, sale through the Invoice drawer, goods receipt, returns, print                                                                                                                                                              | `fe-page-scaffolding` → `fe-route-island`                                           | L-40                   | —        | open   |
| L-51 | Clinic stock island: Items, Purchases, Movements and Vendors (Q-K1), Use popover, Stock check, drawers                                                                                                                                                       | `fe-page-scaffolding` → `fe-route-island`                                           | L-39                   | —        | open   |
| L-52 | Splash: restyle `#app-splash`, the frames, offline, reduced motion, Q-S1; update the e2e test                                                                                                                                                                | `frontend-design`, `fe-test-generation`                                             | L-04                   | —        | open   |
| L-53 | Side-by-side screenshots per screen and state at 1440 / 1024 / 375, light and dark                                                                                                                                                                           | `fe-design-ditto`                                                                   | L-30–L-52              | —        | open   |
| L-54 | Static, i18n, sync and build gates green                                                                                                                                                                                                                     | `fe-pre-pr-sweep`                                                                   | L-53                   | —        | open   |
| L-55 | E2E smoke per room and the test-id inventory                                                                                                                                                                                                                 | `fe-e2e-testids`, `fe-playwright-e2e`                                               | L-53                   | —        | open   |
| L-56 | Visual baselines, after fidelity sign-off                                                                                                                                                                                                                    | `fe-visual-regression`                                                              | L-55                   | —        | open   |
| L-57 | AMBER — confirm from the source at build: Visit sheet icons and strings (H:2258–2457); the reschedule copy (PRD.md:252); `info` = sky; the 34 long-tail colours in Appendix E                                                                                | `fe-design-ditto`                                                                   | per screen             | —        | open   |
| L-58 | Freeze the iteration: set `Status: frozen` in its README in the last commit before merging to `main`                                                                                                                                                         | —                                                                                   | L-54–L-57              | —        | open   |
| L-59 | Brand identity: the Clinozy mark in `BrandLogo`, `public/app-icon.svg` and its PNGs, the manifest colours (`app-manifest.ts`), the HTML splash mark                                                                                                          | `fe-pwa-manifest`                                                                   | L-04; with L-09        | —        | open   |
| L-60 | Hand Appendix F to clinozy-be. As each API lands, remove that room's `REPLACE_WITH_API` markers and enable its module in production (D8)                                                                                                                     | — (clinozy-be)                                                                      | L-24                   | —        | open   |
| L-61 | Read `iterations/launch-2026-09-30-jxmr/schema-routes.md` (93 routes, 40 entities; added after this plan) in full, add it to the coverage matrix, and reconcile §4 and the contracts against it                                                              | `fe-kickoff-planning`                                                               | —                      | —        | open   |

## Appendix A — Coverage matrix

| File                           | Read fully?                                                                                                                      | Kind                                                                                                                                                                                                                                                                                                                                                                    | Screens / facts it owns                                                                                                                                              | In plan at            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `PRD.md` (273)                 | yes                                                                                                                              | product requirements: the brief the prototype was built from                                                                                                                                                                                                                                                                                                            | product summary, roles and access, screen list, three key flows, data objects, sample data, priorities, visual direction, platform behaviour, states, open questions | D21, B.13, Appendix D |
| `schema-routes.md` (1,758)     | **no** — added 2026-10-01, after this plan                                                                                       | entities and routes (Claude Design); the same file is in clinozy-be                                                                                                                                                                                                                                                                                                     | the data model and route map                                                                                                                                         | L-61                  |
| `_index.md` (20)               | yes                                                                                                                              | screen index                                                                                                                                                                                                                                                                                                                                                            | 12 screens and their proposed routes                                                                                                                                 | §4                    |
| `_patterns.md` (71)            | yes                                                                                                                              | shared spec                                                                                                                                                                                                                                                                                                                                                             | drawer, dropdown, table, toolbar, filters, delete confirm, contact card, states, motion                                                                              | §3.5, §6.0            |
| `_report.md` (13)              | yes                                                                                                                              | the md author's self-check                                                                                                                                                                                                                                                                                                                                              | phone not designed (by decision); banner placement only; routes proposed                                                                                             | D10, §3.2, §4         |
| `preset.md` (84)               | yes                                                                                                                              | preset spec                                                                                                                                                                                                                                                                                                                                                             | tokens, tones, contrast claims, type, shape, density, motion, focus, scrollbars                                                                                      | §3.1                  |
| `design-brief-preset.md` (136) | yes                                                                                                                              | preset brief with JSON                                                                                                                                                                                                                                                                                                                                                  | duplicates `preset.md`; its dark values lose                                                                                                                         | §3.1, B T2            |
| `shell.md` (76)                | yes                                                                                                                              | shell spec                                                                                                                                                                                                                                                                                                                                                              | header slots, nav, surface map, compact rule, phone proposal, ⌘K, drawer stack                                                                                       | §3.2                  |
| `splash.md` (86)               | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | frames, timings, offline                                                                                                                                             | §6.1                  |
| `today.md` (96)                | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | stages, cards, drawer                                                                                                                                                | §6.2                  |
| `leads.md` (110)               | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | list, drawer, chat, forms                                                                                                                                            | §6.3                  |
| `appointments.md` (118)        | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | views, booking drawer, statuses                                                                                                                                      | §6.4                  |
| `patients.md` (103)            | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | list, patient drawer                                                                                                                                                 | §6.5                  |
| `patient-file.md` (107)        | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | layout, rail, sections, drawers                                                                                                                                      | §6.6                  |
| `medical.md` (97)              | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | tabs, tables, drawers                                                                                                                                                | §6.7                  |
| `clinic-stock.md` (92)         | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | tabs, Use popover, Stock check                                                                                                                                       | §6.8                  |
| `payments.md` (96)             | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | ledger, pending, drawers, Day close                                                                                                                                  | §6.9                  |
| `tasks.md` (89)                | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | list, task drawer, empty states                                                                                                                                      | §6.10                 |
| `offerings.md` (94)            | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | tables, drawers                                                                                                                                                      | §6.11                 |
| `users.md` (99)                | yes                                                                                                                              | screen                                                                                                                                                                                                                                                                                                                                                                  | team, roles, branches                                                                                                                                                | §6.12                 |
| `Clinozy.dc.html` (5,929)      | yes. Nine parallel readers' **declared** ranges cover 5,914 lines; the other 15 (H:1–7, H:331–336, H:338–339) were read directly | prototype: template H:8–2754 and app script H:2755–5927, with the view model embedded at the bottom (H:4326–5925)                                                                                                                                                                                                                                                       | behaviour for every screen, plus the prototype-only surfaces                                                                                                         | §3–§6, App. B         |
| `support.js` (1,911)           | yes (reader I2)                                                                                                                  | **Generic runtime — ignore, don't port.** The Claude Design dc runtime: it loads React 18.3.1 UMD from unpkg (S:1143–1146), compiles the `<x-dc>` template twice by re-fetching its own URL (S:158–164, S:1687–1700) and evaluates the app script with `new Function` (S:842–851). It holds no app logic. Honoured: invalid `style-hover` bindings → build to md intent | none                                                                                                                                                                 | §7.3, §8              |
| `KICKOFF.md`                   | —                                                                                                                                | this plan (output)                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                    | —                     |

**Reader coverage** (declared ranges only; overlaps are deliberate):

| Reader | Scope                               | Declared prototype lines       |
| ------ | ----------------------------------- | ------------------------------ |
| A      | Today, Visit sheet, Tasks           | 1,890                          |
| B      | Patients list                       | delivered inline               |
| C      | Patient file                        | 1,647                          |
| D      | Leads                               | 1,341                          |
| E      | Appointments                        | 1,124                          |
| F      | Medical, Clinic stock               | 1,182                          |
| G      | Payments, Offerings                 | 2,187                          |
| H      | Users, roles, View-as               | 1,511                          |
| I1     | Shared patterns, overlays           | 1,864                          |
| I2     | `support.js`, Blueprint, view model | 374, plus `support.js` 1–1,911 |
| J      | Repo and backend context            | —                              |

The union is 5,914, plus 15 lines read directly = **5,929 of 5,929**. Ranges
that a reader only mentioned, without reading them, were excluded.

**Cross-checks** (Step 1):

- **Index:** every screen in `_index.md` has a spec (12/12), a §6 block
  (12/12), reconciliation rows (Appendix B) and ledger rows (§9).
- **Spec sections:** every md section is either extracted into §6 or inherited
  from §3.5 / §6.0 — overview, regions, data display, forms, popups, flows,
  icons, motion, states and copy. md-only items are listed in §7.1, built or
  not.
- **Prototype surfaces with no md** (findings, each with a home in the plan):

  | Surface                                                                      | Where it's handled                                                       |
  | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
  | Visit sheet (H:2258–2457)                                                    | §6.13, D18                                                               |
  | Patient-file visit flow                                                      | §6.6, D18                                                                |
  | Overview bento and timeline (dead)                                           | §6.6, D19                                                                |
  | Invoice drawer and print                                                     | §6.9                                                                     |
  | Pending table, Give back, Day close internals                                | §6.9                                                                     |
  | Roles & access, Branch drawer, View-as bar, header branch picker             | §6.12, §3.2                                                              |
  | Contact editor                                                               | §6.3                                                                     |
  | Offers tab and drawer                                                        | §6.11                                                                    |
  | Rx and Treatment drawers (the md is brief)                                   | §6.6                                                                     |
  | ⌘K details                                                                   | §6.0                                                                     |
  | Upload tray, lightbox                                                        | §3.5, §6.6                                                               |
  | Signed-out overlay; "How data connects"; Blueprint                           | out (D2). The explainer and Blueprint stay as domain-rule sources (Q-F3) |
  | WhatsApp status chip, role lens, stat rail, funnel, pipeline, legacy threads | dead                                                                     |

- **Prototype probes** (`fe-kickoff-planning` Step 2):
  - **Responsive:** the only media rules are dark-on-screen (H:12), reduced
    motion (H:13, H:135, H:201), hover capability (H:43, H:236) and print
    (H:256), plus container queries (H:129–131, H:240–244). All are planned.
  - **Dead CSS:** of 48 attribute selectors, one matches nothing:
    `[data-skbox]` (H:254). Not built.
  - **Colours:** 13 neutral steps and 127 accent variables, all used; each is
    mapped in Appendix E.
- **Other findings:**
  - `schema-routes.md` (93 routes, cited at PRD.md:261) was added on 2026-10-01,
    after this plan was written. It is in `iterations/launch-2026-09-30-jxmr/` but not yet read
    or reconciled (L-61).
  - The global intake checklist was missing. It's now vendored at
    `docs/design-workflow/prompts/design-intake-checklist.md` (done this session).
  - `preset.md` labels its ramp one step off.
  - `design-brief-preset.md`'s dark values lose.
  - `_index.md:8` ("doctor, room and machine (day, week, list)") is stale.
  - `_report.md` claims every icon has a Lucide name. True for the md, but the
    prototype uses more icons (§3.4).

## Appendix B — Reconciliation (md ↔ prototype, with evidence)

**Winner:** P = prototype, M = md, R = repo rule, Q = open decision
(Appendix D).

### B.0 The four rebuild-forcing facts, per screen

| Screen       | Popup shape                                                                                                                       | Mobile (<768px)                                                     | Conditional sequence                                                                                    | Table or cards                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Shell        | All sections popover `min(280px, 100vw − 32px)`; user menu 260px; ⌘K centred overlay (H:346–372, I1)                              | All sections becomes the nav; pinned tabs hide (`shell.md:69`, D10) | none                                                                                                    | n/a                                            |
| Splash       | full-bleed boot screen (H:338)                                                                                                    | the same                                                            | fixed frame sequence (`splash.md:43`)                                                                   | n/a                                            |
| Today        | lane tiles and a card panel; actions open the Visit sheet or navigate (H:398–475)                                                 | lanes wrap; the aside drops below (D10)                             | the prototype's stage machine (D20)                                                                     | cards                                          |
| Visit sheet  | full-screen overlay (H:2258)                                                                                                      | full-screen                                                         | four tabs; Rx approval gated (H:4380)                                                                   | lists and cards                                |
| Leads        | lead drawer of two right panels (H:1573–1648); New lead 640px; contact editor 560px child                                         | one full-width sheet with a Details · Chat switch (Q-L1)            | New lead varies by contact (H:3896, H:1709)                                                             | table, no fold (H:1550)                        |
| Appointments | booking drawer `min(760px, …)` (H:2532); status 260px, quick view 340px, "+N more" 300px and filters 560px popovers (H:1821–1938) | drawer full-width; calendars scroll inside the card                 | status machine with guards (H:5655, H:5729)                                                             | Agenda rows and calendars (H:1860–1906)        |
| Patients     | patient drawer 680px; quick-add 680px child (H:3637, H:4480)                                                                      | full-width sheet; table folds (H:3861)                              | two fixed steps (H:3609–3610)                                                                           | table (H:4459)                                 |
| Patient file | a page with section popover 360px and drawers 1040 / 680 / 560px (H:523–782)                                                      | rail hides below 1000px (H:4684, H:4724); sheets                    | visit flow, 5 steps with treatment gated (H:579, H:4762); treatment template switch                     | bento cards, tables, photo grid                |
| Medical      | drawers 560 / 680 / 840px; split "New" menu (H:1175–1358)                                                                         | sheets; tables fold                                                 | actions by PO stage; sale = the Invoice drawer's 3 steps                                                | tables (7 tabs)                                |
| Clinic stock | Use popover 300px; drawers 560 / 680 / 840px; Stock check 840px (H:1111–1174)                                                     | sheets; tables fold                                                 | movement type switch                                                                                    | tables                                         |
| Payments     | Receive 560, Pay 680, Invoice 840, Day close 1040, Add pending 680, Give back 560px (H:818–903, H:3801–3809)                      | sheets                                                              | Pay's bill step only when new with open bills (H:4892); Day close gate → working → report (H:4846–4886) | tables                                         |
| Tasks        | task drawer `min(900px, 100vw − 40px)` (H:1980); "What’s next" child 560px                                                        | sheet                                                               | the outcome decides the next drawer (`tasks.md:44`)                                                     | grouped list (H:1948–2003)                     |
| Offerings    | offering and offer drawers 680px; stacked New offering 560px (H:5288–5289, H:3840)                                                | sheets; tables fold                                                 | "Offers on this" step when live offers exist (H:5258–5260)                                              | tables                                         |
| Users        | user and branch drawers 680px; Roles inline master–detail; View-as bar (H:968–1036, H:939–967, H:375)                             | sheets; the Roles panes stack (D10)                                 | fixed: user 2 steps, branch 3 (H:3609–3610, H:4970–4978)                                                | tables (Team, Branches); master–detail (Roles) |

### B.1 Theme

| #   | Fact                    | md says                                                                                                                       | Prototype says                                                                  | Winner | Action                     |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | -------------------------- |
| T1  | Preset id and scope     | `clinozy-zinc-pastel`, full-surface (`preset.md:3–4`)                                                                         | full-surface token map (H:11–24)                                                | agree  | §3.1                       |
| T2  | Dark tokens             | brief JSON: primary 0.985, accent `#27272a`, ring 0.871, chart-1 0.7 0.13 150 (`design-brief-preset.md`) vs `preset.md:12–19` | H:12 = `preset.md`                                                              | P      | prototype values           |
| T3  | Dark primary-foreground | `#141417` (`preset.md:13`)                                                                                                    | `--z50` = `#0e0e10` (H:24, H:12)                                                | P      | `#0e0e10`                  |
| T4  | Dark warning bg         | 0.245 0.042 85 (`preset.md:18`)                                                                                               | 0.255 0.042 85 (H:12, `--k21`)                                                  | P      | 0.255                      |
| T5  | Header height           | 56px (`shell.md:10`)                                                                                                          | 60px (H:346)                                                                    | P      | 60px                       |
| T6  | Contrast claims         | tone ink ≈8.0–8.4; white on success ≈5.5; on destructive ≈5.3 (`preset.md:55–56`)                                             | recomputed 7.68–8.54, 5.21, 5.86                                                | local  | §3.1 table                 |
| T7  | Fonts                   | Google Fonts CDN (`preset.md:69`)                                                                                             | CDN link (H:15–16)                                                              | R      | self-host                  |
| T8  | Icon stroke             | 2px (`today.md:66` and every screen md)                                                                                       | 1.6 (H:2860)                                                                    | P      | icon-weight axis `thin`    |
| T9  | Focus                   | inset tint, no outline (`preset.md:80`)                                                                                       | the same (H:78)                                                                 | R      | add a ring (WCAG 1.4.11)   |
| T10 | Muted text floor        | never lighter than `#71717a` (`preset.md:43`)                                                                                 | segmented labels `#71717a` on `#f4f4f5` = 4.40 (H:50–54)                        | R      | `#52525b` on `muted`       |
| T11 | Scrollbars              | 10px pill (`preset.md:84`)                                                                                                    | an 8px rule (H:27–33), overridden by a later 10px rule                          | agree  | 10px; the 8px rule is dead |
| T12 | Radius                  | 4 / 6 / 8 / 12 / 999 (`preset.md:75`)                                                                                         | usage 8px ×783, 999 ×452, 6px ×399, 12px ×217; `--radius-lg:10px` unused (H:22) | agree  | base 0.5rem                |

### B.2 Shell

| #   | Fact                | md says                                     | Prototype says                                         | Winner | Action                         |
| --- | ------------------- | ------------------------------------------- | ------------------------------------------------------ | ------ | ------------------------------ |
| S1  | Shape               | single top bar, no sidebar (`shell.md:7`)   | H:346–378                                              | agree  | new variant                    |
| S2  | All sections button | 36px, no counts (`shell.md:19`)             | 32px with a count badge (H:346–366)                    | P      | 32px + badge                   |
| S3  | Avatar              | 28px (`shell.md:24`)                        | 32px (H:366)                                           | P      | 32px                           |
| S4  | Search              | a "Search" field, min 170px (`shell.md:21`) | a button, "Search patients, leads…", 240px (H:346–366) | P      | button                         |
| S5  | Utilities           | bell + Tasks shortcut (`shell.md:22`)       | absent                                                 | M      | build (§7.1)                   |
| S6  | Settings entry      | user menu → Users (`shell.md:54`)           | no Settings in the user menu (H:367–372)               | R      | keep the platform Settings row |
| S7  | Org switcher        | = branch picker (`shell.md:49`)             | none                                                   | R      | user-menu "Switch clinic"      |
| S8  | Pinned tabs persist | localStorage (`shell.md:20`)                | writes `cz.navPins`, never restores it (I2)            | M      | device prefs                   |
| S9  | Sub-tab header      | —                                           | dead: `SUBS` is empty (H:378–396, H:3100–3101)         | —      | not built                      |
| S10 | "G · 1–9"           | —                                           | copy only; the shortcuts are dead (I1)                 | Q      | Q-S2                           |
| S11 | Phone nav           | the compass popover (`shell.md:57–58`)      | not designed                                           | M      | D10                            |
| S12 | Landing room        | Today (`today.md:5`, `splash.md:6`)         | Leads (H:4255)                                         | Q      | Q-T1                           |

### B.3 Shared patterns

| #   | Fact            | md says                                                                   | Prototype says                                                                 | Winner | Action                        |
| --- | --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | ----------------------------- |
| P1  | Close label     | "Discard" (`_patterns.md:13`)                                             | "Cancel"; stacked drawers say "Back" (H:3638, H:3788)                          | P      | Cancel / Back                 |
| P2  | Save rule       | disabled until dirty (`_patterns.md:12`)                                  | always enabled (H:3637); only "Save lead" is dirty-gated (H:5496)              | Q      | Q-P1                          |
| P3  | Initial focus   | the first empty required field (`_patterns.md:14`)                        | none (H:3541–3640)                                                             | M      | §7.1                          |
| P4  | × motion        | 200ms after 200ms, "ease" (`_patterns.md:68`)                             | only some drawers; curve `cubic-bezier(.2,.8,.2,1)` (H:74, H:2479)             | M + P  | every drawer, prototype curve |
| P5  | Step circle     | 22px; green / `#18181b` / `#e4e4e7` (`_patterns.md:18`)                   | 24px; passed `--k8`, open = section tone, future `--z200` (H:983, H:3628)      | P      | prototype                     |
| P6  | Header padding  | 16px 24px (`_patterns.md:16`)                                             | 14px 24px; compact 12px 20px (H:973, H:5881)                                   | P      | prototype                     |
| P7  | Tab overflow    | "More ⌄" (`_patterns.md:42`)                                              | `tabsFit` only in Medical and Payments; the other rooms scroll (H:3764–3780)   | P      | per room                      |
| P8  | Split "New"     | split everywhere (`_patterns.md:42`)                                      | split only in Medical, Payments Pending and the file section head              | P      | per room                      |
| P9  | Pagination      | cursor pages, infinite (`_patterns.md:38`)                                | load everything and virtualise; Leads scrolls infinitely (H:3878, H:5908–5911) | M + P  | D7                            |
| P10 | Empty state     | icon tile + title + hint (`_patterns.md:52`)                              | the tile, `emptyText` and a generic hint (H:3890–3891, H:4327)                 | M      | §7.1                          |
| P11 | Delete confirm  | "Delete this <type>?" with fixed reasons (`_patterns.md:22`)              | one engine with reasons per kind (H:2479, H:4205–4213)                         | M + P  | md title, prototype reasons   |
| P12 | Picker          | dropdown is the only picker (`_patterns.md:26`)                           | the engine (H:3696–3762), plus custom lists in places                          | P      | one Picker                    |
| P13 | Filters popover | flips (`_patterns.md:46`)                                                 | fixed below-right in Appointments (H:1821, H:5723)                             | M      | flip everywhere               |
| P14 | Motion          | 160 / 340 / 340 / 220 / 1,100 / 220ms; reduced 1ms (`_patterns.md:65–71`) | H:35, H:73–76, H:116, H:91; reduced 1ms (H:13) then .01ms (H:201)              | agree  | §6.0                          |
| P15 | Save timing     | 320–740ms; 9s toast (`_patterns.md:53`)                                   | the same, with 10% failures (H:4222–4224)                                      | —      | simulation (D15)              |

### B.4 Splash

| #   | Fact                      | md says                                                   | Prototype says                                    | Winner | Action       |
| --- | ------------------------- | --------------------------------------------------------- | ------------------------------------------------- | ------ | ------------ |
| SP1 | Frames and durations      | `splash.md:43–44`                                         | H:338–341                                         | agree  | §6.1         |
| SP2 | App fade-in 450ms         | `splash.md:44`                                            | H:344                                             | agree  | §6.1         |
| SP3 | Offline state             | `splash.md:75`                                            | H:342                                             | agree  | §6.1         |
| SP4 | ≈3,700ms total, then exit | `splash.md:44`                                            | a 3,700ms timer (500ms reduced), then +520ms (I1) | agree  | Q-S1 vs boot |
| SP5 | The four rebuild facts    | popup n/a; mobile is full-bleed; fixed sequence; no table | the same                                          | agree  | GREEN        |

### B.5 Today

| #   | Fact             | md says                                                       | Prototype says                                                                           | Winner | Action                       |
| --- | ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ---------------------------- |
| TD1 | Stages and shape | 8 stages including Done, columns side by side (`today.md:18`) | 7 lane tiles plus a card panel for the selected lane (H:398–475)                         | P / Q  | shape: P; no Done lane (D20) |
| TD2 | Card click       | opens the appointment drawer (`today.md:30`)                  | action buttons drive the stages (H:397–475)                                              | AMBER  | verify (L-57)                |
| TD3 | Mobile           | columns scroll sideways (`today.md:31`)                       | tiles wrap (auto-fill)                                                                   | P      | D10                          |
| TD4 | Step sequence    | —                                                             | the stage machine; enquiry and pharmacy cards never leave (`book` H:4407, `sell` H:4420) | P      | kept (D20)                   |
| TD5 | Header buttons   | —                                                             | New booking → New lead; Walk-in → palette (H:404, H:5835)                                | Q      | Q-T2                         |
| TD6 | Role focus       | —                                                             | roles fixed to desk + counsellor (H:4255)                                                | R      | my roles                     |
| TD7 | Work queue       | —                                                             | a task store separate from the Tasks room (H:3247–3256, H:3984–4020)                     | Q      | Q-T3                         |

### B.6 Leads

| #   | Fact                   | md says                                                                                              | Prototype says                                                           | Winner | Action        |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ------------- |
| L1  | Columns                | person · status · source · interested in · assigned & involved · follow-up · created (`leads.md:23`) | Lead · Status · Source · Interested in · Team · Updated (H:5899, H:3937) | P      | §6.3          |
| L2  | Narrow widths          | columns fold (`leads.md:18`)                                                                         | no fold; 830px minimum, scrolls (H:3942, H:4227)                         | P      | Q-L1 on phone |
| L3  | Drawer size            | 680 + chat ≈360 (`leads.md:25, 49`)                                                                  | `min(980, 94vw)`, chat 420 (360 … total − 400) (H:4333)                  | P      | the formula   |
| L4  | Drawer header          | name + status pill (`leads.md:51`)                                                                   | "Edit lead" + #ID + Re-target + sub (H:1575–1587)                        | P      | prototype     |
| L5  | Submit rules           | disabled until dirty (`leads.md:37`)                                                                 | Save lead dirty-gated (H:5496); Create lead always enabled (H:1743)      | P      | prototype     |
| L6  | After saving           | toast, drawer closes (`leads.md:39`)                                                                 | New lead closes (H:5641); Save lead stays open (H:5409)                  | P      | prototype     |
| L7  | Sequence varies?       | "no" (`leads.md:59`)                                                                                 | **yes** — depends on the contact (H:3896, H:1709)                        | P      | §6.3 table    |
| L8  | Initial focus          | Name (`leads.md:54`)                                                                                 | search autofocus (H:1712)                                                | P      | prototype     |
| L9  | Bulk bar               | yes (`leads.md:19, 77, 91, 109`)                                                                     | none (H:1493–1809)                                                       | Q      | Q-L2          |
| L10 | Notes field            | yes (`leads.md:34`)                                                                                  | none                                                                     | Q      | Q-L3          |
| L11 | Backdrop               | 340ms fade (`leads.md:87`)                                                                           | lead drawer instant at α .28; other drawers 340ms (H:1573, H:1705)       | P      | per surface   |
| L12 | Chat loading and error | skeleton; toast with Retry (`leads.md:100`)                                                          | neither exists                                                           | M      | §7.1          |
| L13 | Access                 | Front desk, Counsellor, Marketing, Owner (`leads.md:7`)                                              | Admin, Doctor, Front desk, Counsellor (H:3392–3393)                      | P      | Q-L5          |
| L14 | Delete confirm         | the `_patterns.md:22` reasons                                                                        | Duplicate / Test entry / Spam / Other; title bug (H:4210, H:5570)        | P      | fixed title   |

### B.7 Appointments

| #    | Fact                 | md says                                                   | Prototype says                                                               | Winner | Action         |
| ---- | -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ | -------------- |
| AP1  | Views                | "day, week, list" (`_index.md:8`)                         | Agenda / Day / Week / Month, default Agenda (H:1817)                         | P      | §6.4           |
| AP2  | Resources            | "by doctor, room and machine" (`_index.md:8`)             | the resource calendar is dead (H:3311–3318, H:4421–4426)                     | P      | Q-A1           |
| AP3  | Day columns          | doctors side by side (appointments.md)                    | one "All doctors" column (H:1877–1884)                                       | P      | Q-A2           |
| AP4  | Selected slot colour | sky (`appointments.md:38`)                                | AM butter, PM sky (H:5757)                                                   | P      | prototype      |
| AP5  | Reason and Notes     | both saved (`appointments.md:35–36`)                      | Reason never saved; Notes only on edit (H:5804–5806)                         | Q      | Q-A9           |
| AP6  | Errors               | below the field + toast (`appointments.md:40`)            | toasts only (H:5801, H:2622)                                                 | M      | §7.1           |
| AP7  | Submit               | fixed labels, disabled until dirty (`appointments.md:41`) | dynamic labels; 50% opacity when incomplete; never disabled (H:5738, H:2622) | P / Q  | labels P; Q-P1 |
| AP8  | Dirty guard          | "Discard" (`appointments.md:42, 54`)                      | none; "Cancel" (H:5800, H:2622, H:4273)                                      | Q      | Q-P1           |
| AP9  | Slot click           | (`appointments.md:50`)                                    | Day view only (H:1882, H:1895)                                               | P      | prototype      |
| AP10 | Initial focus        | (`appointments.md:56`)                                    | none                                                                         | M      | §7.1           |
| AP11 | Cancel reasons       | one set (`appointments.md:67`)                            | three sets (H:3906, H:3208, H:2881)                                          | Q      | Q-A8           |
| AP12 | Month loading        | skeleton (`appointments.md:105`)                          | none in Month (H:1902)                                                       | M      | §7.1           |
| AP13 | Bulk bar             | 220ms (`appointments.md:97`)                              | none (H:1853–1875)                                                           | P      | not built      |
| AP14 | Week start           | —                                                         | board Sunday (H:5682); booking calendar Monday (H:5753)                      | Q      | Q-A10          |
| AP15 | Bookable hours       | —                                                         | four sources (H:5681, H:5733, H:3197, H:3355–3357)                           | Q      | Q-A3           |
| AP16 | Conflict rule        | —                                                         | same doctor + same start only (H:5732, H:5801)                               | Q      | Q-A4           |
| AP17 | ⌘K booking           | ⌘K opens the form (appointments.md entry points)          | palette only navigates (H:4361)                                              | Q      | Q-A15          |

### B.8 Patients

| #    | Fact                | md says                                                        | Prototype says                                                             | Winner | Action         |
| ---- | ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ | -------------- |
| PT1  | Steps               | Contact → Details → Notes, "varies? no" (`patients.md:51, 56`) | 4 sections merged into 2 steps (H:3609–3610, H:4469–4478)                  | P      | 2 steps        |
| PT2  | Views               | not mentioned (`patients.md:17`)                               | All / In clinic today / With dues / Follow-up due / Recall (H:493, H:4481) | P      | §6.5           |
| PT3  | "In clinic today"   | —                                                              | `fuK==='today'` rather than checked in (H:4454 vs H:3092)                  | Q      | Q-P4           |
| PT4  | Table               | (`patients.md:22`)                                             | 11 tracks, minimum 1,450px (H:4459)                                        | P      | §6.5           |
| PT5  | Patient type        | chips                                                          | renders as a picker: the label regex (H:3566, H:3569)                      | M      | chips (defect) |
| PT6  | Footer              | "Discard" (`patients.md:38`)                                   | Cancel · Delete · "Create & add another" (H:3638, H:4480)                  | P      | prototype      |
| PT7  | After create        | toast and open the file (`patients.md:38`)                     | the drawer closes and the list stays (H:4479–4480)                         | Q      | Q-P6           |
| PT8  | Errors              | below the field + toast (`patients.md:38`)                     | step "!" and toasts only (H:3627–3628, H:4479)                             | M      | §7.1           |
| PT9  | Duplicate detection | —                                                              | none                                                                       | Q      | Q-P7           |
| PT10 | Gender display      | —                                                              | any non-F value shows "Male" (H:4462)                                      | R      | fix (defect)   |

### B.9 Patient file

| #   | Fact                  | md says                                                 | Prototype says                                                        | Winner  | Action                       |
| --- | --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- | ------- | ---------------------------- |
| F1  | Route                 | `/patients/:id/:section` (`patient-file.md:3`)          | single page; `ptTab` state (H:4483)                                   | M       | §4                           |
| F2  | Default section       | —                                                       | the "Overview" bento is unreachable (H:590–600, H:4483, H:4762)       | decided | D19: Overview is the default |
| F3  | Rail on small screens | above the content (`patient-file.md:16`)                | hidden below 1000px, or 1280px with Activity open (H:4684, H:4724)    | Q       | Q-F2                         |
| F4  | Bento breakpoints     | 3 columns ≥980, 6 + 6 at 620–980 (`patient-file.md:23`) | container queries (H:129–131)                                         | agree   | §6.6                         |
| F5  | Log feedback          | a dropdown (`patient-file.md:39`)                       | a 560px picker drawer (H:4170, H:3790–3791)                           | P       | drawer                       |
| F6  | Dismiss               | Discard (`patient-file.md:49`)                          | Cancel (H:3638)                                                       | P       | Cancel                       |
| F7  | Visit flow            | none                                                    | 5 steps (H:579, H:4762)                                               | decided | D18                          |
| F8  | "Save & sell" (Rx)    | —                                                       | dead (H:4571)                                                         | —       | not built                    |
| F9  | Access                | —                                                       | room-level only; the per-section `PERM` is dead (H:2867–2876, H:2982) | Q       | Q-F1                         |

### B.10 Medical and Clinic stock

| #   | Fact             | md says                                                       | Prototype says                                                                                              | Winner | Action         |
| --- | ---------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ | -------------- |
| M1  | Default tab      | Sales listed first (`medical.md:3`)                           | Medicines (`s.mdSec\|\|'cat'`, H:5070)                                                                      | Q      | Q-M5           |
| M2  | Ledger view bar  | "Ledger: All · Money in · Money out" (`medical.md:18`)        | not rendered                                                                                                | P      | not built      |
| M3  | Sale form        | walk-in, Mode chips, Paid toggle (`medical.md:27`)            | the shared Invoice drawer, locked to Medical (H:5113, H:5191); no live drawer matches the md's walk-in form | P      | Invoice drawer |
| M4  | Access           | Pharmacist, Accountant, Owner (`medical.md:7`)                | Admin, Pharmacist; Accountant view-only (H:3392–3393)                                                       | P      | Q-U2           |
| M5  | PO save label    | "Create purchase" (`medical.md:43`)                           | "Create order" (H:5155)                                                                                     | P      | prototype      |
| M6  | Sequence varies? | yes, by PO stage; sales are never edited (`medical.md:49`)    | the same                                                                                                    | agree  | §6.7           |
| M7  | Delete title     | —                                                             | Delete on a medicine says "Delete this sale?" on first load (H:4205 vs H:5070)                              | R      | fix (defect)   |
| K1  | Stock tabs       | Items · Movements · Purchases · Vendors (`clinic-stock.md:3`) | Items · Purchases · Movements; no Vendors (H:1111–1174)                                                     | P / Q  | Q-K1           |
| K2  | Stock access     | Therapist, Front desk, Owner (`clinic-stock.md:7`)            | Admin, Pharmacist; Accountant view-only (H:3392–3393)                                                       | Q      | Q-K2           |
| K3  | Use popover      | anchored popover (`clinic-stock.md:26, 34`)                   | the same, 300px, flips (F report)                                                                           | agree  | §6.8           |

### B.11 Payments, Offerings, Tasks, Users

| #   | Fact                  | md says                                                                               | Prototype says                                                                           | Winner  | Action           |
| --- | --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------- | ---------------- |
| G1  | Day close ×           | floats outside (`payments.md:40`)                                                     | in the header, z 70 below the page drawers (H:818)                                       | P       | in the header    |
| G2  | Pending drawers       | 680 (`payments.md:38`)                                                                | Add pending 680; Give back 560 (H:3801, H:3809)                                          | P       | both             |
| G3  | Invoice drawer        | not in `payments.md`                                                                  | 840px, rendered globally (H:4827, H:836)                                                 | P       | §6.9             |
| G4  | Pay steps             | 2 steps (`payments.md:27, 42`)                                                        | **3**, the first conditional (H:4892–4893)                                               | P       | §6.9             |
| G5  | Day close states      | 3, closed is read-only (`payments.md:47`)                                             | gate / working / report, an always-visible review list, and "Reopen" (H:819–831, H:4883) | P       | Q-G1             |
| G6  | Ledger columns        | no "By" (`payments.md:22`)                                                            | adds "By" (H:4870)                                                                       | P       | add              |
| G7  | Edit / Delete icons   | 16px; stroke 2 (`payments.md:61–65`)                                                  | 13px; stroke 1.6 (H:4868, H:2860)                                                        | P       | prototype        |
| G8  | Credit copy           | "We give back", "They owe us", "Use on next bill" (`payments.md:28, 95`)              | "Give" / "Take"; adjusting is unreachable (H:546, H:3896)                                | P / Q   | Q-G9             |
| G9  | Access                | Front desk, Accountant, Owner (`payments.md:7`)                                       | Admin, Front desk, Counsellor; Accountant view-only (H:3392–3393)                        | Q       | Q-G4             |
| O1  | Offerings columns     | category · name · sessions · list price · min price · live offers (`offerings.md:22`) | 10 columns, no min price (H:5222)                                                        | P       | §6.11            |
| O2  | Offering form         | 5 fields (`offerings.md:28–32`)                                                       | 18 fields; Category not required (H:5250–5265)                                           | P       | §6.11            |
| O3  | Sequence varies?      | "no" (`offerings.md:52`)                                                              | **yes** — "Offers on this" (H:5258–5260, H:3610)                                         | P       | §6.11            |
| O4  | Access                | Owner, Counsellor (`offerings.md:7`)                                                  | Admin only (H:3392–3393)                                                                 | Q       | Q-O1             |
| TK1 | "New task"            | in the toolbar (`tasks.md:17`)                                                        | none; the 720px task drawer is unreachable (H:1690–1703)                                 | Q       | Q-T4             |
| TK2 | Task drawer           | 560 + activity column (`tasks.md:35`)                                                 | `min(900px, 100vw − 40px)` = 560 + 340 (H:1980)                                          | agree   | §6.10            |
| TK3 | Sequence varies?      | yes, by outcome (`tasks.md:44`)                                                       | the same; "What’s next" after 380ms                                                      | agree   | §6.10            |
| TK4 | Empty states          | three (`tasks.md:79–81`)                                                              | unreachable (H:1948–2003)                                                                | M       | §7.1             |
| U1  | Roles surface         | a role drawer (`users.md:6`)                                                          | master–detail, applies instantly (H:939–967, H:4940–4955)                                | P       | §6.12            |
| U2  | User-drawer steps     | Profile → Access → Hours (`users.md:54`)                                              | 2 steps (H:3609–3610, H:4926–4936)                                                       | P       | 2 steps          |
| U3  | Settings in user menu | yes (`users.md:5`)                                                                    | no (H:367–371)                                                                           | R       | relocation table |
| U4  | Role catalogue        | includes Owner and Marketing (`users.md:7, 11`)                                       | 7 roles plus custom (H:3352)                                                             | P       | Q-U2             |
| U5  | Invite flow           | implied by the empty copy (`users.md:90`)                                             | a password field; the invite code is dead (H:4928, H:3123, H:5317–5318)                  | decided | D17: invitations |
| U6  | Validation            | email format, 10 digits (`users.md:29–30`)                                            | non-empty checks only (H:4938)                                                           | M       | §7.1             |
| U7  | Esc                   | all drawers (`users.md:46`)                                                           | the branch drawer isn't in the Esc chain (H:4273)                                        | M       | §7.1             |

### B.12 Dead markup and code (not built)

| Area                | Lines                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic table room  | `inTable` (H:1464–1491) and the all-`if(false…)` chain (H:5293–5336)                                                                                                                                           |
| Sub-tabs            | `SUBS` / `SUBINFO` (H:3090–3101); sub-tab header (H:378–396)                                                                                                                                                   |
| Blueprint           | H:2007–2257                                                                                                                                                                                                    |
| Patient-file legacy | `ProfileLogic` and `PERM` (H:2944–3063; `renderVals` is never called, H:2982); the Overview bento (H:590–600) is built per D19, not dead by intent                                                             |
| Appointments        | resource calendar (H:3311–3318, H:4421–4426, H:5858); SLOTS views (H:3276, H:4405–4410); person card (H:1917–1932); footer strip (H:1909); agenda range dropdown (H:5721)                                      |
| Leads               | collapsed rail (H:1495–1500); stat rail, funnel, pipeline (H:5337–5338, H:5376–5380); legacy threads (H:4392–4404); channel popover (H:1618–1625)                                                              |
| Users and drawers   | `us.roleTabs` (H:910); drawer steps strip, live summary, Back / Next (H:978–979, H:1021–1025, H:1032, H:847, H:889–900)                                                                                        |
| Payments            | dues, invoice, receipt and expense tables (H:4780–4807); invoice preview (H:3424–3430, H:4896–4897); `crAdjust` (H:4189); Undo drawer (H:3810–3823); Today checkout cash view model (H:4428–4429, H:5861–5863) |
| Shell and misc.     | WhatsApp status chip (H:5833); role lens (H:4356–4358); the 8px scrollbar rule (H:27–33); density toggle icons; a duplicate `bell` icon key                                                                    |
| Dead CSS            | `[data-fetch]:not([data-fetch=""]) [data-skbox]` (H:254); no element carries `data-skbox`                                                                                                                      |

### B.13 PRD ↔ prototype and plan

**Winner:** P = prototype (D1), PRD = product intent (D21), You = your locked
answer, M = the screen md.

| #   | Fact                  | PRD says                                                                                                      | Prototype / plan says                                                                            | Winner                 | Action                                                                 |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------- |
| R1  | Roles                 | Marketing; Owner / Admin (PRD.md:23–24)                                                                       | 7 roles, no Marketing (H:3352)                                                                   | PRD                    | seed a Marketing role (Q-U2)                                           |
| R2  | Today stages          | 8, including Done (PRD.md:47)                                                                                 | 7 lanes (H:398–475); you kept the prototype (D20)                                                | You                    | **confirm D20 stands**, or add the Done lane                           |
| R3  | Today card click      | opens the appointment form drawer (PRD.md:48)                                                                 | AMBER (H:397–475); `today.md:30` agrees with the PRD                                             | PRD + M                | card click opens the booking drawer                                    |
| R4  | Today "New"           | one split "New ⌄": appointment, walk-in, lead, payment (PRD.md:48)                                            | two buttons, "New booking" and "Walk-in" (H:404, H:5835)                                         | P                      | keep two buttons; their targets per Q-T2                               |
| R5  | Leads access          | Front desk, Marketing, Counsellor, Owner (PRD.md:53)                                                          | Admin, Doctor, Front desk, Counsellor (H:3392–3393); doctors appear in the assign rules (H:5464) | PRD + P                | union of both (Q-L5)                                                   |
| R6  | Leads columns         | + follow-up date, last message (PRD.md:54)                                                                    | Lead · Status · Source · Interested in · Team · Updated (H:5899)                                 | P                      | no change (as `leads.md:23`, B.6 L1)                                   |
| R7  | Appointment resources | by doctor, room and machine; Day / Week by resource plus List (PRD.md:59–61); room/machine field (PRD.md:150) | doctor-only; Agenda / Day / Week / Month; resource calendar dead (H:1817, H:3311–3318)           | P for UI, PRD for data | optional room/machine in the contract; UI doctor-only (Q-A1)           |
| R8  | Patients columns      | + last visit, doctor (PRD.md:68)                                                                              | no such columns (H:4459)                                                                         | P                      | no change                                                              |
| R9  | New patient fields    | include consent and first photos (PRD.md:69)                                                                  | only the quick-add form has them                                                                 | PRD                    | one drawer with both (Q-P2)                                            |
| R10 | File tabs             | no Overview, Visits or Reports (PRD.md:75)                                                                    | 11 sections (H:4685); Overview is the default (D19)                                              | You + P                | keep; the PRD list is a subset                                         |
| R11 | File access           | Accountant reads billing (PRD.md:74)                                                                          | Accountant has no Patients access (H:3392–3393)                                                  | PRD                    | Accountant reads Invoices and Payments (Q-F1)                          |
| R12 | Log feedback          | a dropdown (PRD.md:76)                                                                                        | a 560px picker drawer (H:4170)                                                                   | P                      | no change (B.9 F5)                                                     |
| R13 | Stock access          | Therapist, Front desk, Owner (PRD.md:88)                                                                      | Admin, Pharmacist; Accountant view-only (H:3392–3393)                                            | PRD + M                | Q-K2                                                                   |
| R14 | Stock tabs            | Items · Movements · Purchases · Vendors (PRD.md:89); vendors have name, phone, connections (PRD.md:161)       | no Vendors tab (H:1111–1174)                                                                     | PRD + M                | build a Vendors table (Q-K1)                                           |
| R15 | Use on next bill      | a Pending action (PRD.md:97)                                                                                  | `crAdjust` exists but is unreachable (H:4189, H:546)                                             | PRD                    | wire it (Q-G9)                                                         |
| R16 | Tasks                 | every role sees its own tasks, Owner sees all; new task (PRD.md:102, 104)                                     | Admin, Doctor, Front desk, Counsellor; Therapist view-only; no New task                          | PRD                    | every role, own tasks; build New task (Q-T4)                           |
| R17 | Offerings             | minimum price shown (PRD.md:110)                                                                              | a floor field behind the `floor` ability, no column (H:5258)                                     | P                      | no column                                                              |
| R18 | User drawer           | Profile → Access → Hours (PRD.md:118)                                                                         | 2 steps (H:3609–3610)                                                                            | P                      | no change (B.11 U2)                                                    |
| R19 | User fields           | no password (PRD.md:165)                                                                                      | a password field (H:4928)                                                                        | PRD + You              | invitation, no password (D17)                                          |
| R20 | "Save & sell"         | Flow 2 depends on it (PRD.md:132)                                                                             | dead (H:4571)                                                                                    | PRD                    | build it: save the Rx, then open the Medical sale prefilled            |
| R21 | Aftercare task        | Flow 3 creates it, then a call-back on a bad check-in (PRD.md:138–140)                                        | no aftercare task; the call-back exists (C report)                                               | PRD                    | yes (Q-F7)                                                             |
| R22 | Ids                   | Patient P-####; PAY-####, INV- / S-, CN-### (PRD.md:149–157)                                                  | #3508, PT-0412 (B report)                                                                        | PRD                    | Q-X4                                                                   |
| R23 | Appointment statuses  | no No show (PRD.md:150)                                                                                       | No show is a status (H:5655)                                                                     | P                      | keep No show                                                           |
| R24 | Invoice types         | Clinic, Medical (PRD.md:156)                                                                                  | plus Consultation (H:3397)                                                                       | P                      | keep three                                                             |
| R25 | Tablet                | row actions always visible, tap tooltips, 44px quick inputs (PRD.md:241)                                      | actions shown on touch (H:43); touch tooltip 1,400ms                                             | agree                  | §6.0                                                                   |
| R26 | Empty states          | every list offers its "New …" button (PRD.md:250)                                                             | missing in places (Offerings, G report)                                                          | PRD + M                | §7.1                                                                   |
| R27 | Sorting               | every list sorts (PRD.md:253)                                                                                 | the ledger and Branches sort nothing (H:4870, H:4960)                                            | P                      | no change                                                              |
| R28 | Appointment filters   | include type (PRD.md:253)                                                                                     | Appointed to, Status, Created, Follow-up (H:1822–1844)                                           | P                      | no change                                                              |
| R29 | Reschedule copy       | "a new reminder goes out on save" (PRD.md:252)                                                                | not confirmed in the booking drawer                                                              | AMBER                  | L-57                                                                   |
| R30 | Route schema          | `iterations/launch-2026-09-30-jxmr/schema-routes.md`, 93 routes (PRD.md:261)                                  | added 2026-10-01, after this plan; not yet read                                                  | —                      | reconcile §4 against it (L-61); §4 stands until then                   |
| R31 | Verify-email banner   | open question (PRD.md:217, 260)                                                                               | absent                                                                                           | plan                   | build it: a platform surface, relocate never delete (§3.2)             |
| R32 | Landing               | the splash fades into Today (PRD.md:41)                                                                       | opens Leads (H:4255)                                                                             | PRD + M                | Today (Q-T1)                                                           |
| R33 | Sample data           | realistic rows (PRD.md:168)                                                                                   | the prototype's seeds                                                                            | P                      | prototype seeds for screenshot parity; PRD rows added alongside (§3.6) |

## Appendix C — Readiness gate (RED / AMBER)

### C.1 Part B scoreboard

Scored against `design-intake-checklist.md` Part B, with the clinozy-fe rules.

- ✓ = complete;
- ~ = partial, resolved by a decision or AMBER;
- ✗ = unknown and blocking;
- — = n/a.

A2 is "~" on every screen because phone is D10, decided pending your
confirmation.

| Screen       | A1  | A2  | A3  | A4  | A5  | A6  | A7  | A8  | A9  | A10 | A11 | A12 | Score                                             |
| ------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ------------------------------------------------- |
| Preset       | —   | —   | —   | —   | —   | —   | —   | ✓   | ✓   | —   | —   | ✓   | 🟢 GREEN                                          |
| Shell        | ✓   | ~   | —   | —   | ✓   | —   | —   | ✓   | ✓   | ~   | ~   | ✓   | 🟡 AMBER (Q-S2, Q-S3)                             |
| Splash       | ✓   | ✓   | —   | —   | —   | —   | ✓   | —   | ✓   | ✓   | ~   | ✓   | 🟡 AMBER (Q-S1)                                   |
| Today        | ~   | ~   | ✓   | —   | ~   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER (D20; Q-T1, Q-T2)                        |
| Leads        | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ~   | ✓   | ✓   | 🟡 AMBER                                          |
| Appointments | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ~   | ✓   | ✓   | 🟡 AMBER                                          |
| Patients     | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER                                          |
| Patient file | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER (D18, D19)                               |
| Medical      | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER                                          |
| Clinic stock | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER                                          |
| Payments     | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER                                          |
| Tasks        | ✓   | ~   | ✓   | ~   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER (Q-T4)                                   |
| Offerings    | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   | ✓   | 🟡 AMBER                                          |
| Users        | ✓   | ~   | ✓   | ✓   | ✓   | ✓   | —   | ✓   | ✓   | ~   | ✓   | ✓   | 🟡 AMBER (D17)                                    |
| Visit sheet  | ~   | ✓   | ✓   | ✓   | ✓   | ✓   | —   | ~   | ✓   | ~   | ✓   | ✓   | 🟡 AMBER (D18; no md — the prototype is the spec) |

Totals: 1 GREEN, 14 AMBER, 0 RED (the four REDs were answered 2026-10-01). AMBER screens can be built now; each
AMBER item is a ledger row (L-57) or an Appendix D default.

### C.2 RED questions — answered 2026-10-01

**RED-1 · Users room vs the Settings members and roles panels.**

- **Evidence:**
  - The prototype's Users room has Team, Roles & access and Branches
    (H:905–1039).
  - Its user drawer sets a password and "Active · can sign in" (H:4928,
    H:4936); its invite code is dead (H:3123, H:5317–5318).
  - The platform already manages members, invitations, roles and role
    permissions in the `#settings/*` modal, backed by clinozy-be.
- **Options:**
  - **A.** The Users room becomes the one members surface. Team lists the
    backend members joined with fixture staff profiles. "New user" sends an
    invitation (no admin-set passwords). Roles & access edits the backend roles
    plus the fixture clinic matrix. Settings' Members and Roles sections become
    links into the room.
  - **B.** Settings stays the members surface. The Users room holds Branches and
    the clinic access matrix, and Team links to Settings.
  - **C.** Build the prototype as is, with admin-set passwords. This conflicts
    with the platform's invite and verification model; not recommended.
- **Recommendation: A.** **Answer: A** — locked as D17.

**RED-2 · Two visit workspaces.**

- **Evidence:** Today's Visit sheet (H:2258–2457) and the patient file's
  5-step visit flow (H:579, H:4762) are both live. Neither has an md, neither is
  linked to the appointment's check-in, and they share no data (both are
  static).
- **Options:**
  - **A.** One Visit model; both surfaces built as designed — the sheet from
    Today, the flow from the patient file. Check-in starts the visit, and
    completing the visit completes the appointment.
  - **B.** The sheet is the only workspace; "Start visit" opens it.
  - **C.** The flow is the only workspace; Today's lane actions open the patient
    file.
- **Recommendation: A** — ditto builds what's designed, on one model. **Answer: A** — locked as D18.

**RED-3 · Patient-file "Overview" and the default section.**

- **Evidence:**
  - "Overview" is a nav label (H:4685), but its bento (H:590–600) and timeline
    (H:4601–4625) can't be reached: the tab resolves to Clinical notes (H:4483)
    and `isTimeline` is never true (H:4762).
  - Opening a patient by name selects no tab (H:4246, H:4701).
  - `patient-file.md` names no default.
- **Options:**
  - **A.** Ship Overview (bento + timeline) as the default section.
  - **B.** Drop Overview; Clinical notes is the default, and the Overview slot
    shows the running visit, as the prototype does.
- **Recommendation: A** — it's designed, only unwired, and gives the file a summary landing. **Answer: A** — locked as D19.

**RED-4 · Today's stage machine.**

- **Evidence:**
  - `today.md:18` has 8 stages, including Done; the prototype has 7 lanes
    (H:398–475).
  - "Book" (enquiry) and "Dispense" (pharmacy) never move their cards out
    (H:4407, H:4420), so nothing says when those cards leave.
- **Proposed rules:**
  - An enquiry card leaves once its lead has an appointment; it then shows in
    Arriving on that day.
  - A pharmacy card leaves once its sale exists, paid or not.
  - A Done lane per the md: today's completed visits, collapsed by default.
- **Recommendation:** these rules, with the Done lane. **Answer: keep the prototype's behaviour** — 7 lanes, no Done lane, cards stay in their lanes; locked as D20.

**Also confirm D10** (phone): it turns every A2 "~" into ✓.

### C.3 AMBER — resolve before "done" (ledger L-57)

- the Visit sheet's icons and strings (H:2258–2457);
- the reschedule copy "a new reminder goes out on save" (PRD.md:252);
- `info` = sky tone (a plan choice);
- the 34 long-tail colours in Appendix E (ΔE above 0.03);
- icon export names (`FileIcon`, `ImageIcon`, `LinkIcon`);
- the 10 non-English locales (Q-X1);
- splash text before i18n loads (Q-S1);
- the "G · 1–9" copy (Q-S2).

## Appendix D — Open decisions, each with a proposed default

Confirm in bulk or amend by ID. A default applies once you confirm it.

### D.1 Platform, data and patterns

| ID   | Question                                                        | Evidence                             | Proposed default                                                                                                                                                                              |
| ---- | --------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-X1 | Source of the 10 non-English locale files                       | parity gate; D14                     | Machine-translated drafts per room in the same PR, flagged for native review; English authored verbatim                                                                                       |
| Q-X2 | Print and patient-message languages (English / ગુજરાતી / हिंदी) | Visit sheet Rx print; Blueprint      | English only in launch; Gujarati and Hindi templates later                                                                                                                                    |
| Q-X3 | Money precision in contracts                                    | `inrF` (H:3350); print `r2` (H:4176) | Integer paise; ₹ formatting at the edge                                                                                                                                                       |
| Q-X4 | ID display formats                                              | H:4174, H:4865, H:3809; B.13 R22     | The PRD's (PRD.md:149–157): Patient P-####, PAY-####, INV- / S-, CN-###; server-issued, mimicked by fixtures                                                                                  |
| Q-P1 | Drawer dirty rules                                              | B.3 P2; B.7 AP7–AP8                  | Edit: Save disabled until dirty. Create: Save enabled, validated on submit. Closing a dirty drawer asks "Discard changes?". The label stays "Cancel". The contact editor commits only on Done |
| Q-P2 | One patient-create form or two                                  | §6.5                                 | One drawer; consent and first photos join step 2; pickers open it as a child drawer                                                                                                           |
| Q-P3 | j/k row navigation                                              | Leads only (H:4271)                  | Every table                                                                                                                                                                                   |
| Q-P4 | What "In clinic today" means                                    | H:4454 vs H:3092                     | A visit in progress, or an appointment Checked in today                                                                                                                                       |
| Q-P5 | Upload size limits                                              | backend 10MB; prototype 15MB photos  | 10MB everywhere; copy updated                                                                                                                                                                 |
| Q-P6 | After creating a patient                                        | B.8 PT7                              | Stay on the list (prototype), with a toast action "Open file"                                                                                                                                 |
| Q-P7 | Duplicate detection by mobile (patients, leads, contacts)       | dead `dupe` (H:5407, H:5572)         | Warn when the mobile field loses focus — "Same mobile as ‹name› · #‹id›" — with "Use existing". Never merge on phone alone                                                                    |
| Q-P8 | Bulk actions (toast stubs today)                                | H:3962                               | Real CSV export; Message and Print hidden until messaging and list printing exist                                                                                                             |

### D.2 Shell, splash and Today

| ID   | Question                             | Evidence                         | Proposed default                                                                                                                                                  |
| ---- | ------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-S1 | Splash exit; text before i18n loads  | B.4 SP4; `src/lib/app-splash.ts` | Exit when boot resolves, never before the wordmark lands (≈2,050ms); reduced motion 500ms. The HTML frames carry no text; the greeting renders after i18n         |
| Q-S2 | "G · 1–9" shortcuts                  | B.2 S10                          | Build them: G, then 1–9, opens the nth pinned section; listed in Keyboard shortcuts                                                                               |
| Q-S3 | The Tasks shortcut's badge           | `shell.md:22`                    | Count of my open tasks                                                                                                                                            |
| Q-S4 | Lock appearance in production        | `VITE_THEME_LOCK`                | Lock it (one brand look); Light / Dark / System stays in the user menu                                                                                            |
| Q-T1 | Landing room; the template Dashboard | B.2 S12                          | Today for every role. The Dashboard leaves the clinic nav and stays for personal mode                                                                             |
| Q-T2 | "New booking" and "Walk-in"          | B.5 TD5                          | New booking → `/appointments/create`. Walk-in → patient quick-add, then check-in (the explainer's Walk-in journey: one form makes the contact, patient and visit) |
| Q-T3 | One task model, and where rules run  | B.5 TD7                          | One model; rules run on the server (a fixture job for now); Today's aside shows my due tasks                                                                      |
| Q-T4 | Manual "New task"                    | B.11 TK1                         | Build it, shaped like the unreachable 720px task drawer (H:1690–1703)                                                                                             |

### D.3 Leads and Appointments

| ID    | Question                                                                   | Evidence                                            | Proposed default                                                                                                                                  |
| ----- | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-L1  | Lead drawer on phone                                                       | B.6 L2; D10                                         | One full-width sheet with a "Details · Chat" switch                                                                                               |
| Q-L2  | Bulk bar                                                                   | B.6 L9                                              | Not in launch                                                                                                                                     |
| Q-L3  | Notes field on New lead                                                    | B.6 L10                                             | No; notes live in the chat's Note mode                                                                                                            |
| Q-L4  | Restrict status moves                                                      | H:5497–5498                                         | Unrestricted; every move logs a system message                                                                                                    |
| Q-L5  | Leads access                                                               | B.6 L13; B.13 R5                                    | Union of the prototype and the PRD: Admin, Doctor, Front desk, Counsellor and Marketing; Delete for Admin                                         |
| Q-L6  | The "Phone call" source                                                    | H:5911                                              | Add it to the source list                                                                                                                         |
| Q-L7  | Channels in launch                                                         | composer modes (H:5530)                             | Ship the composer with fixture delivery states; real WhatsApp / Instagram sending is backend work                                                 |
| Q-L9  | Owner activity resets the hold; replies auto-add involved people           | the copy (H:5498, H:1611) vs the code (H:5412–5416) | Yes — build what the copy promises                                                                                                                |
| Q-L10 | WhatsApp outage signal; message states                                     | H:4337, H:5833                                      | Fixture-driven; the outage line stays hidden until the backend sends a signal                                                                     |
| Q-L11 | Dead extras: stat rail, funnel, pipeline, re-target list, timeline filters | B.12                                                | Not built                                                                                                                                         |
| Q-A1  | Rooms and machines                                                         | B.7 AP2; B.13 R7                                    | An optional room or machine on each appointment in the contract (PRD.md:150); the calendar stays doctor-only, and resource views come later       |
| Q-A2  | Day view: merged, or one column per doctor                                 | B.7 AP3                                             | Merged, with the doctor filter                                                                                                                    |
| Q-A3  | Source of bookable hours                                                   | B.7 AP15                                            | Grid 9:00–22:00; slots from branch opening hours and the doctor's working days and hours (Users); clicks outside hours warn                       |
| Q-A4  | Conflict rule                                                              | B.7 AP16                                            | Same doctor, overlapping time                                                                                                                     |
| Q-A5  | One meaning of "Active"                                                    | H:5659 vs H:5680                                    | Scheduled, Confirmed and Checked in, everywhere                                                                                                   |
| Q-A6  | What Rebook does                                                           | H:5656, H:1939, H:4066                              | Creates a new appointment linked to the old one; final statuses stay final                                                                        |
| Q-A7  | Quick-view guards                                                          | H:5873 vs H:5729                                    | The same guards as the status popover                                                                                                             |
| Q-A8  | One cancel-reason set and field                                            | B.7 AP11                                            | Patient asked · Could not reach patient · Doctor unavailable · Machine or room unavailable · Booked by mistake · Other (note required); one field |
| Q-A9  | Persist type, package and Reason; notes on create                          | B.7 AP5                                             | Yes                                                                                                                                               |
| Q-A10 | Week start                                                                 | B.7 AP14                                            | Sunday everywhere, matching the board                                                                                                             |
| Q-A11 | The empty footer strip                                                     | H:1909                                              | Drop it                                                                                                                                           |
| Q-A12 | Search by "#ID"                                                            | H:5391                                              | Accept with or without "#"                                                                                                                        |
| Q-A13 | Reminder delivery and booking source                                       | reminder mode UI dead                               | Fixtures; the reminder is fixed at "1 day before, 16:00"; no mode picker                                                                          |
| Q-A15 | ⌘K "New appointment" and "New receipt"                                     | B.7 AP17                                            | Open their forms                                                                                                                                  |
| Q-A16 | Gate Edit and Cancel; close the alias bypass                               | H:3102                                              | Yes                                                                                                                                               |
| Q-A17 | Browsing past appointments in Agenda                                       | dead range dropdown (H:5721)                        | Agenda lists from the selected date; the Period control works in Agenda too                                                                       |
| Q-A19 | Single-line month chips                                                    | H:5695                                              | Yes                                                                                                                                               |

### D.4 Patient file, Medical and Stock

| ID   | Question                                 | Evidence                                | Proposed default                                                                                                                                                                                           |
| ---- | ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-F1 | Per-section access                       | B.9 F9; B.13 R11                        | Room-level access, plus the `clinical` ability for clinical sections; the Accountant reads Invoices and Payments in the file (PRD.md:74)                                                                   |
| Q-F2 | The rail on tablets                      | B.9 F3                                  | Prototype: the rail hides below 1000px (1280px with Activity); identity moves to the file bar                                                                                                              |
| Q-F3 | Record lifecycle                         | "What remove does" (H:2508–2512)        | Follow it: packages close, appointments cancel, sessions reverse, payments refund, invoices get a credit note, prescriptions stop, complaints / diagnosis / follow-ups delete, plans withdraw, photos hide |
| Q-F4 | Privacy masking scope                    | masked rail, unmasked tables (C report) | Mask money and phones across the whole file by default, tables included; reveal per session                                                                                                                |
| Q-F5 | The Private photo album                  | no protection in the prototype          | Visible only with the `clinical` ability                                                                                                                                                                   |
| Q-F6 | Activity for patients with no lead       | C report                                | Show the contact's thread; otherwise an empty state                                                                                                                                                        |
| Q-F7 | The aftercare call creates a task        | the copy says so; the code doesn't      | Yes                                                                                                                                                                                                        |
| Q-F8 | Esc navigates back                       | "Back to patients (Esc)"                | Yes, when no overlay is open                                                                                                                                                                               |
| Q-M1 | Two PO payment paths                     | H:4888–4894; F report                   | One path: "Pay ₹X" opens the Payments Pay drawer prefilled; both update the PO                                                                                                                             |
| Q-M2 | A void restores stock                    | F report                                | Yes                                                                                                                                                                                                        |
| Q-M3 | The near-expiry discount applies at sale | F report                                | Yes: the sale line uses MRP − 20%                                                                                                                                                                          |
| Q-M4 | Unknown medicines in an Rx               | C report                                | Added to Medical as "Needs MRP and composition" drafts                                                                                                                                                     |
| Q-M5 | Medical's default tab                    | B.10 M1                                 | Sales                                                                                                                                                                                                      |
| Q-M6 | "Send payment reminders"                 | a toast stub                            | Hidden until messaging exists                                                                                                                                                                              |
| Q-M7 | PO print                                 | a toast stub                            | Not in launch                                                                                                                                                                                              |
| Q-K1 | A Vendors tab                            | B.10 K1; B.13 R14                       | Build it (PRD.md:89, `clinic-stock.md:3`), modelled on Medical's Suppliers table: name, phone, connections (PRD.md:161)                                                                                    |
| Q-K2 | Stock access                             | B.10 K2; B.13 R13                       | PRD roles (PRD.md:88): Therapist and Front desk view and use stock; Admin full; Pharmacist and Accountant as the prototype                                                                                 |

### D.5 Payments, Offerings and Users

| ID    | Question                                                      | Evidence                         | Proposed default                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-G1  | Reopening a closed day; old days never closed                 | B.11 G5; H:4846 vs H:4875        | Reopening needs the `dayclose` ability; days past the grace period show "Auto-closed"                                                                                                                                             |
| Q-G2  | Auto-close after the grace period                             | copy only (`force` is never set) | A server job closes the day at midnight, cash taken as expected                                                                                                                                                                   |
| Q-G3  | Invoice and dues lists in Payments                            | dead (H:4780–4807)               | No; invoices stay in the patient file                                                                                                                                                                                             |
| Q-G4  | Access, including Pay and Day close                           | B.11 G9                          | Pay needs Payments Create; Day close needs the `dayclose` ability                                                                                                                                                                 |
| Q-G5  | Split payments in Day close                                   | H:4872                           | Each mode row counts under its mode; Credit separately                                                                                                                                                                            |
| Q-G6  | Branch scoping                                                | no record stores a branch        | Per branch, following the header branch                                                                                                                                                                                           |
| Q-G7  | Overall discount after GST                                    | H:3419                           | Before tax (the Blueprint's rule)                                                                                                                                                                                                 |
| Q-G9  | "Use on next bill"                                            | B.11 G8; B.13 R15                | Build it: wire the prototype's unreachable `crAdjust` (PRD.md:97)                                                                                                                                                                 |
| Q-G10 | Reversing settled payments                                    | dead Undo drawer                 | Not in launch                                                                                                                                                                                                                     |
| Q-G11 | Day-close review columns                                      | H:4900 bug                       | Ref · What · When · From/to · Mode · Amount · State · Checked                                                                                                                                                                     |
| Q-G12 | Dues ageing (7 / 30 days)                                     | H:3421 (dead)                    | Only on the rail's Due card                                                                                                                                                                                                       |
| Q-O1  | Offerings access; the `prices` ability                        | B.11 O4                          | Admin and `prices` holders edit; Counsellor views                                                                                                                                                                                 |
| Q-O2  | Offer stacking and the floor clamp                            | H:3376                           | The prototype's rules                                                                                                                                                                                                             |
| Q-O3  | GST-inclusive pricing                                         | an inert toggle (H:5257)         | Inclusive means the price includes GST; the base is back-computed                                                                                                                                                                 |
| Q-O4  | An automatic floor at 85%                                     | H:5268                           | No automatic floor                                                                                                                                                                                                                |
| Q-O5  | Per-branch price overrides                                    | —                                | No; branch-scoped offers cover it                                                                                                                                                                                                 |
| Q-O6  | Specialty in the offering drawer                              | seed data only (H:3334)          | Add Specialty chips; the appointment dropdown uses it                                                                                                                                                                             |
| Q-U2  | Role catalogue                                                | B.11 U4; B.13 R1                 | The 7 prototype roles plus a seeded Marketing role (PRD.md:23), and custom roles; "Owner" stays the platform's org owner, not a clinic role                                                                                       |
| Q-U5  | Team empty copy                                               | H:3890 vs H:4922                 | The md's: "No team members yet" / "Invite doctors, therapists and front desk so work can be assigned."                                                                                                                            |
| Q-U6  | Role edits: instant or saved; audit; deleting custom roles    | H:4943–4955                      | Instant, as the prototype, with an audit entry; a custom role can be deleted once it has no members                                                                                                                               |
| Q-U7  | The header branch: does it filter lists, and does it persist? | H:5869                           | It filters branch-bearing lists (appointments, payments, Day close) and persists per user                                                                                                                                         |
| Q-U8  | Which screens enforce the nine unused abilities               | H:3363                           | disc → the invoice discount cap · prices → offering edits · dayclose → Day close · refund → Give back · void → Void sale · allbr → "All branches" · clinical → clinical sections · export → bulk Export · reverse → not in launch |
| Q-U10 | Commission in launch                                          | §6.12                            | Keep the field (fixture); no payroll                                                                                                                                                                                              |
| Q-U11 | Exit preview; the palette under preview                       | H:4202                           | Stay on the current room if it's viewable, else go to the first viewable; the palette respects the preview                                                                                                                        |

## Appendix E — Colour map (every prototype colour variable)

Generated from H:11 (light) and H:12 (dark) against the planned tokens (§3.1).
ΔE is the OKLab distance, the larger of light and dark. "Exact" and "new token"
rows carry the value as is; "nearest" rows are within 0.03; "verify" rows are
farther and get a side-by-side check (L-57). One override: `--k111` (the
reviewed-row green) maps to `tone-sage-tint` rather than its nearest, `card`,
which would hide the checked state.

| Var      | Light                  | Dark                   | Uses | Token                          | ΔE    | Status           |
| -------- | ---------------------- | ---------------------- | ---- | ------------------------------ | ----- | ---------------- |
| `--z0`   | #ffffff                | #141417                | 1117 | `card`                         | 0     | exact            |
| `--z50`  | #fafafa                | #0e0e10                | 525  | `background`                   | 0     | exact            |
| `--z100` | #f4f4f5                | #1e1e22                | 730  | `muted`                        | 0     | exact            |
| `--z150` | #efeff1                | #232327                | 125  | `hover`                        | 0     | new token        |
| `--z200` | #e4e4e7                | #2c2c31                | 163  | `border`                       | 0     | exact            |
| `--z300` | #d4d4d8                | #3a3a40                | 241  | `border-strong`                | 0     | new token        |
| `--z400` | #a1a1aa                | #5b5b63                | 156  | `disabled`                     | 0     | new token        |
| `--z500` | #71717a                | #9d9da6                | 1184 | `muted-foreground`             | 0     | exact            |
| `--z600` | #52525b                | #b4b4bc                | 324  | `muted-foreground-strong`      | 0     | new token        |
| `--z700` | #3f3f46                | #d0d0d6                | 228  | `foreground-soft`              | 0     | new token        |
| `--z800` | #27272a                | #e4e4e7                | 85   | `foreground-strong`            | 0     | new token        |
| `--z900` | #18181b                | #f4f4f5                | 407  | `primary`                      | 0     | exact            |
| `--z950` | #09090b                | #fafafa                | 12   | `foreground`                   | 0     | exact            |
| `--k0`   | oklch(0.925 0.04 20)   | oklch(0.265 0.028 20)  | 15   | `tone-blush`                   | 0     | exact            |
| `--k1`   | oklch(0.38 0.1 20)     | oklch(0.855 0.075 20)  | 24   | `tone-blush-foreground`        | 0     | exact            |
| `--k2`   | oklch(0.83 0.06 20)    | oklch(0.4 0.048 20)    | 12   | `tone-blush-border`            | 0     | exact            |
| `--k3`   | oklch(0.72 0.14 150)   | oklch(0.72 0.14 150)   | 3    | `brand`                        | 0     | exact            |
| `--k4`   | oklch(0.6 0.14 150)    | oklch(0.6 0.14 150)    | 2    | `presence-online`              | 0.050 | nearest — verify |
| `--k5`   | oklch(0.53 0.2 25)     | oklch(0.67 0.2 25)     | 65   | `destructive`                  | 0     | exact            |
| `--k6`   | oklch(0.97 0.02 25)    | oklch(0.22 0.014 25)   | 15   | `destructive-tint`             | 0     | new token        |
| `--k7`   | oklch(0.42 0.07 150)   | oklch(0.835 0.053 150) | 1    | `tone-sage-foreground`         | 0.051 | nearest — verify |
| `--k8`   | oklch(0.52 0.12 150)   | oklch(0.66 0.12 150)   | 93   | `success`                      | 0     | exact            |
| `--k9`   | oklch(0.925 0.045 150) | oklch(0.265 0.032 150) | 34   | `tone-sage`                    | 0     | exact            |
| `--k10`  | oklch(0.37 0.08 150)   | oklch(0.86 0.06 150)   | 62   | `tone-sage-foreground`         | 0     | exact            |
| `--k11`  | oklch(0.975 0.012 150) | oklch(0.215 0.008 150) | 2    | `tone-sage-tint`               | 0.009 | nearest          |
| `--k12`  | oklch(0.925 0.045 295) | oklch(0.265 0.032 295) | 9    | `tone-lav`                     | 0     | exact            |
| `--k13`  | oklch(0.37 0.09 295)   | oklch(0.86 0.068 295)  | 16   | `tone-lav-foreground`          | 0     | exact            |
| `--k14`  | oklch(0.96 0.02 235)   | oklch(0.23 0.014 235)  | 2    | `channel-call-tint`            | 0     | new token        |
| `--k15`  | oklch(0.38 0.07 235)   | oklch(0.855 0.053 235) | 2    | `tone-sky-foreground`          | 0.014 | nearest          |
| `--k16`  | oklch(0.88 0.04 20)    | oklch(0.4 0.032 20)    | 1    | `destructive-border`           | 0.050 | nearest — verify |
| `--k17`  | oklch(0.985 0.008 20)  | oklch(0.205 0.006 20)  | 1    | `card`                         | 0.017 | nearest          |
| `--k18`  | oklch(0.45 0.1 20)     | oklch(0.82 0.075 20)   | 3    | `tone-blush-foreground`        | 0.070 | nearest — verify |
| `--k19`  | oklch(0.85 0.08 80)    | oklch(0.4 0.064 80)    | 8    | `tone-butter-border`           | 0     | exact            |
| `--k20`  | oklch(0.985 0.012 85)  | oklch(0.205 0.008 85)  | 3    | `card`                         | 0.019 | nearest          |
| `--k21`  | oklch(0.935 0.06 85)   | oklch(0.255 0.042 85)  | 10   | `tone-butter`                  | 0     | exact            |
| `--k22`  | oklch(0.38 0.085 65)   | oklch(0.855 0.064 65)  | 27   | `tone-butter-foreground`       | 0     | exact            |
| `--k23`  | oklch(0.42 0.08 150)   | oklch(0.835 0.06 150)  | 1    | `tone-sage-foreground`         | 0.050 | nearest — verify |
| `--k24`  | oklch(0.925 0.04 235)  | oklch(0.265 0.028 235) | 5    | `tone-sky`                     | 0     | exact            |
| `--k25`  | oklch(0.37 0.08 235)   | oklch(0.86 0.06 235)   | 12   | `tone-sky-foreground`          | 0     | exact            |
| `--k26`  | oklch(0.83 0.06 150)   | oklch(0.4 0.048 150)   | 8    | `tone-sage-border`             | 0     | exact            |
| `--k27`  | oklch(0.97 0.015 235)  | oklch(0.22 0.01 235)   | 1    | `channel-call-tint`            | 0.011 | nearest          |
| `--k28`  | oklch(0.45 0.14 25)    | oklch(0.82 0.105 25)   | 1    | `tone-blush-foreground`        | 0.081 | nearest — verify |
| `--k29`  | oklch(0.55 0.18 25)    | oklch(0.69 0.18 25)    | 14   | `destructive`                  | 0.028 | nearest          |
| `--k30`  | oklch(0.5 0.14 295)    | oklch(0.64 0.14 295)   | 4    | `assist`                       | 0     | new token        |
| `--k31`  | oklch(0.75 0.1 80)     | oklch(0.75 0.1 80)     | 4    | `tone-butter-dot`              | 0.017 | nearest          |
| `--k32`  | oklch(0.97 0.03 85)    | oklch(0.22 0.021 85)   | 4    | `tone-butter-tint`             | 0     | new token        |
| `--k33`  | oklch(0.94 0.04 295)   | oklch(0.25 0.028 295)  | 5    | `tone-lav`                     | 0.016 | nearest          |
| `--k34`  | oklch(0.94 0.08 95)    | oklch(0.25 0.056 95)   | 9    | `highlight`                    | 0     | new token        |
| `--k35`  | oklch(0.97 0.02 150)   | oklch(0.22 0.014 150)  | 17   | `tone-sage-tint`               | 0     | new token        |
| `--k36`  | oklch(0.93 0.04 150)   | oklch(0.26 0.028 150)  | 16   | `tone-sage`                    | 0.007 | nearest          |
| `--k37`  | oklch(0.52 0.21 25)    | oklch(0.66 0.21 25)    | 8    | `destructive`                  | 0.014 | nearest          |
| `--k38`  | oklch(0.5 0.15 25)     | oklch(0.64 0.15 25)    | 2    | `destructive`                  | 0.058 | nearest — verify |
| `--k39`  | oklch(0.42 0.1 150)    | oklch(0.835 0.075 150) | 3    | `success-strong`               | 0.036 | nearest — verify |
| `--k40`  | oklch(0.60 0.10 295)   | oklch(0.6 0.1 295)     | 3    | `tone-lav-dot`                 | 0.080 | nearest — verify |
| `--k41`  | oklch(0.83 0.06 295)   | oklch(0.4 0.048 295)   | 4    | `tone-lav-border`              | 0     | exact            |
| `--k42`  | oklch(0.74 0.11 75)    | oklch(0.74 0.11 75)    | 4    | `tone-butter-dot`              | 0     | exact            |
| `--k43`  | oklch(0.95 0.03 170)   | oklch(0.24 0.021 170)  | 1    | `channel-whatsapp-tint`        | 0.012 | nearest          |
| `--k44`  | oklch(0.40 0.07 170)   | oklch(0.845 0.053 170) | 1    | `tone-sage-foreground`         | 0.041 | nearest — verify |
| `--k45`  | oklch(0.36 0.07 150)   | oklch(0.865 0.053 150) | 5    | `tone-sage-foreground`         | 0.014 | nearest          |
| `--k46`  | oklch(0.62 0.18 25)    | oklch(0.62 0.18 25)    | 4    | `now-indicator`                | 0     | new token        |
| `--k47`  | oklch(0.37 0.07 195)   | oklch(0.86 0.053 195)  | 2    | `tone-mint-foreground`         | 0     | exact            |
| `--k48`  | oklch(0.4 0.1 50)      | oklch(0.845 0.075 50)  | 2    | `tone-peach-foreground`        | 0     | exact            |
| `--k49`  | oklch(0.38 0.1 330)    | oklch(0.855 0.075 330) | 2    | `tone-plum-foreground`         | 0     | exact            |
| `--k50`  | oklch(0.38 0.08 125)   | oklch(0.855 0.06 125)  | 2    | `tone-lime-foreground`         | 0     | exact            |
| `--k51`  | oklch(0.37 0.04 255)   | oklch(0.86 0.03 255)   | 2    | `tone-slate-foreground`        | 0     | exact            |
| `--k52`  | oklch(0.94 0.03 20)    | oklch(0.25 0.021 20)   | 1    | `tone-blush`                   | 0.018 | nearest          |
| `--k53`  | oklch(0.85 0.05 20)    | oklch(0.4 0.04 20)     | 1    | `tone-blush-border`            | 0.022 | nearest          |
| `--k54`  | oklch(0.945 0.03 150)  | oklch(0.245 0.021 150) | 1    | `channel-whatsapp-tint`        | 0.007 | nearest          |
| `--k55`  | oklch(0.85 0.05 150)   | oklch(0.4 0.04 150)    | 1    | `tone-sage-border`             | 0.022 | nearest          |
| `--k56`  | oklch(0.955 0.04 85)   | oklch(0.235 0.028 85)  | 1    | `tone-butter-tint`             | 0.018 | nearest          |
| `--k57`  | oklch(0.87 0.07 80)    | oklch(0.4 0.056 80)    | 1    | `tone-butter-border`           | 0.022 | nearest          |
| `--k58`  | oklch(0.68 0.1 295)    | oklch(0.68 0.1 295)    | 3    | `tone-lav-dot`                 | 0     | exact            |
| `--k59`  | oklch(0.66 0.1 150)    | oklch(0.66 0.1 150)    | 5    | `tone-sage-dot`                | 0     | exact            |
| `--k60`  | oklch(0.60 0.09 150)   | oklch(0.6 0.09 150)    | 2    | `tone-sage-dot`                | 0.061 | nearest — verify |
| `--k61`  | oklch(0.70 0.08 150)   | oklch(0.7 0.08 150)    | 1    | `tone-sage-dot`                | 0.045 | nearest — verify |
| `--k62`  | oklch(0.83 0.055 235)  | oklch(0.4 0.044 235)   | 2    | `tone-sky-border`              | 0     | exact            |
| `--k63`  | oklch(0.88 0.06 25)    | oklch(0.4 0.048 25)    | 3    | `destructive-border`           | 0.036 | nearest — verify |
| `--k64`  | oklch(0.975 0.015 25)  | oklch(0.215 0.01 25)   | 2    | `destructive-tint`             | 0.007 | nearest          |
| `--k65`  | oklch(0.45 0.16 25)    | oklch(0.82 0.12 25)    | 2    | `tone-blush-foreground`        | 0.093 | nearest — verify |
| `--k66`  | oklch(0.68 0.09 235)   | oklch(0.68 0.09 235)   | 2    | `tone-sky-dot`                 | 0     | exact            |
| `--k67`  | oklch(0.68 0.1 20)     | oklch(0.68 0.1 20)     | 1    | `tone-blush-dot`               | 0     | exact            |
| `--k68`  | oklch(0.93 0.04 190)   | oklch(0.26 0.028 190)  | 1    | `tone-mint`                    | 0     | exact            |
| `--k69`  | oklch(0.83 0.055 190)  | oklch(0.4 0.044 190)   | 1    | `tone-mint-border`             | 0     | exact            |
| `--k70`  | oklch(0.68 0.08 190)   | oklch(0.68 0.08 190)   | 1    | `tone-mint-dot`                | 0     | exact            |
| `--k71`  | oklch(0.93 0.045 55)   | oklch(0.26 0.032 55)   | 1    | `tone-peach`                   | 0     | exact            |
| `--k72`  | oklch(0.84 0.07 55)    | oklch(0.4 0.056 55)    | 1    | `tone-peach-border`            | 0     | exact            |
| `--k73`  | oklch(0.72 0.12 55)    | oklch(0.72 0.12 55)    | 1    | `tone-peach-dot`               | 0     | exact            |
| `--k74`  | oklch(0.925 0.04 330)  | oklch(0.265 0.028 330) | 1    | `tone-plum`                    | 0     | exact            |
| `--k75`  | oklch(0.83 0.06 330)   | oklch(0.4 0.048 330)   | 1    | `tone-plum-border`             | 0     | exact            |
| `--k76`  | oklch(0.68 0.1 330)    | oklch(0.68 0.1 330)    | 1    | `tone-plum-dot`                | 0     | exact            |
| `--k77`  | oklch(0.935 0.055 120) | oklch(0.255 0.038 120) | 1    | `tone-lime`                    | 0     | exact            |
| `--k78`  | oklch(0.85 0.07 120)   | oklch(0.4 0.056 120)   | 1    | `tone-lime-border`             | 0     | exact            |
| `--k79`  | oklch(0.72 0.11 120)   | oklch(0.72 0.11 120)   | 1    | `tone-lime-dot`                | 0     | exact            |
| `--k80`  | oklch(0.925 0.02 255)  | oklch(0.265 0.014 255) | 1    | `tone-slate`                   | 0     | exact            |
| `--k81`  | oklch(0.83 0.03 255)   | oklch(0.4 0.024 255)   | 1    | `tone-slate-border`            | 0     | exact            |
| `--k82`  | oklch(0.66 0.05 255)   | oklch(0.66 0.05 255)   | 1    | `tone-slate-dot`               | 0     | exact            |
| `--k83`  | oklch(0.66 0.10 150)   | oklch(0.66 0.1 150)    | 2    | `tone-sage-dot`                | 0     | exact            |
| `--k84`  | oklch(0.72 0.09 150)   | oklch(0.72 0.09 150)   | 2    | `brand`                        | 0.050 | nearest — verify |
| `--k85`  | oklch(0.75 0.06 235)   | oklch(0.75 0.06 235)   | 1    | `tone-sky-dot`                 | 0.076 | nearest — verify |
| `--k86`  | oklch(0.85 0.08 25)    | oklch(0.4 0.064 25)    | 4    | `destructive-border`           | 0     | new token        |
| `--k87`  | oklch(0.55 0.2 25)     | oklch(0.69 0.2 25)     | 2    | `destructive`                  | 0.020 | nearest          |
| `--k88`  | oklch(0.65 0.14 150)   | oklch(0.65 0.14 150)   | 4    | `presence-online`              | 0     | new token        |
| `--k89`  | oklch(0.60 0.16 25)    | oklch(0.6 0.16 25)     | 3    | `now-indicator`                | 0.028 | nearest          |
| `--k90`  | oklch(0.5 0.19 25)     | oklch(0.64 0.19 25)    | 1    | `destructive`                  | 0.032 | nearest — verify |
| `--k91`  | oklch(0.955 0.03 25)   | oklch(0.235 0.021 25)  | 1    | `destructive-tint`             | 0.018 | nearest          |
| `--k92`  | oklch(0.92 0.05 25)    | oklch(0.27 0.035 25)   | 1    | `tone-blush`                   | 0.012 | nearest          |
| `--k93`  | oklch(0.45 0.2 25)     | oklch(0.82 0.15 25)    | 1    | `tone-blush-foreground`        | 0.123 | nearest — verify |
| `--k94`  | oklch(0.78 0.14 25)    | oklch(0.78 0.14 25)    | 1    | `tone-peach-dot`               | 0.092 | nearest — verify |
| `--k95`  | oklch(0.50 0.19 25)    | oklch(0.64 0.19 25)    | 2    | `destructive`                  | 0.032 | nearest — verify |
| `--k96`  | oklch(0.55 0.13 150)   | oklch(0.69 0.13 150)   | 2    | `channel-whatsapp`             | 0.030 | nearest — verify |
| `--k97`  | oklch(0.6 0.16 340)    | oklch(0.6 0.16 340)    | 1    | `channel-instagram`            | 0.087 | nearest — verify |
| `--k98`  | oklch(0.55 0.1 235)    | oklch(0.69 0.1 235)    | 1    | `channel-call`                 | 0.054 | nearest — verify |
| `--k99`  | oklch(0.5 0.1 65)      | oklch(0.64 0.1 65)     | 1    | `channel-note`                 | 0.024 | nearest          |
| `--k100` | oklch(0.5 0.08 255)    | oklch(0.64 0.08 255)   | 1    | `channel-call`                 | 0.053 | nearest — verify |
| `--k101` | oklch(0.45 0.12 150)   | oklch(0.82 0.09 150)   | 4    | `success-strong`               | 0     | new token        |
| `--k102` | oklch(0.95 0.035 150)  | oklch(0.24 0.025 150)  | 1    | `channel-whatsapp-tint`        | 0     | new token        |
| `--k103` | oklch(0.40 0.08 235)   | oklch(0.845 0.06 235)  | 1    | `channel-call-foreground`      | 0     | new token        |
| `--k104` | oklch(0.95 0.03 350)   | oklch(0.24 0.021 350)  | 1    | `channel-instagram-tint`       | 0     | new token        |
| `--k105` | oklch(0.48 0.13 350)   | oklch(0.62 0.13 350)   | 1    | `channel-instagram-foreground` | 0     | new token        |
| `--k106` | oklch(0.96 0.02 280)   | oklch(0.23 0.014 280)  | 1    | `channel-call-tint`            | 0.015 | nearest          |
| `--k107` | oklch(0.42 0.09 280)   | oklch(0.835 0.068 280) | 1    | `tone-lav-foreground`          | 0.055 | nearest — verify |
| `--k108` | oklch(0.48 0.1 295)    | oklch(0.62 0.1 295)    | 1    | `assist`                       | 0.045 | nearest — verify |
| `--k109` | oklch(0.975 0.012 20)  | oklch(0.215 0.008 20)  | 1    | `destructive-tint`             | 0.010 | nearest          |
| `--k110` | oklch(0.93 0.035 150)  | oklch(0.26 0.025 150)  | 1    | `tone-sage`                    | 0.011 | nearest          |
| `--k111` | oklch(0.985 0.01 150)  | oklch(0.205 0.007 150) | 1    | `tone-sage-tint`               | 0.018 | nearest          |
| `--k112` | oklch(0.72 0.07 235)   | oklch(0.72 0.07 235)   | 1    | `tone-sky-dot`                 | 0.045 | nearest — verify |
| `--k113` | oklch(0.975 0.012 295) | oklch(0.215 0.008 295) | 1    | `tone-lav-tint`                | 0     | new token        |
| `--k114` | oklch(0.66 0.12 150)   | oklch(0.66 0.12 150)   | 4    | `tone-sage-dot`                | 0.020 | nearest          |
| `--k115` | oklch(0.62 0.10 170)   | oklch(0.62 0.1 170)    | 1    | `tone-sage-dot`                | 0.053 | nearest — verify |
| `--k116` | oklch(0.4 0.12 295)    | oklch(0.845 0.09 295)  | 1    | `tone-lav-foreground`          | 0.042 | nearest — verify |
| `--k117` | oklch(0.52 0.13 150)   | oklch(0.66 0.13 150)   | 4    | `channel-whatsapp`             | 0     | new token        |
| `--k118` | oklch(0.50 0.12 235)   | oklch(0.64 0.12 235)   | 2    | `channel-call`                 | 0     | new token        |
| `--k119` | oklch(0.52 0.11 70)    | oklch(0.66 0.11 70)    | 4    | `channel-note`                 | 0     | new token        |
| `--k120` | oklch(0.55 0.16 350)   | oklch(0.69 0.16 350)   | 1    | `channel-instagram-foreground` | 0.076 | nearest — verify |
| `--k121` | oklch(0.45 0.08 240)   | oklch(0.82 0.06 240)   | 2    | `channel-call-foreground`      | 0.050 | nearest — verify |
| `--k122` | oklch(0.45 0.08 255)   | oklch(0.82 0.06 255)   | 1    | `channel-call-foreground`      | 0.057 | nearest — verify |
| `--k123` | oklch(0.60 0.10 235)   | oklch(0.6 0.1 235)     | 1    | `tone-sky-dot`                 | 0.081 | nearest — verify |
| `--k124` | oklch(0.62 0.15 25)    | oklch(0.62 0.15 25)    | 2    | `now-indicator`                | 0.030 | nearest — verify |
| `--k125` | oklch(0.72 0.12 70)    | oklch(0.72 0.12 70)    | 2    | `tone-butter-dot`              | 0.025 | nearest          |
| `--k126` | oklch(0.50 0.12 295)   | oklch(0.64 0.12 295)   | 1    | `assist`                       | 0.020 | nearest          |

## Appendix F — Backend dependencies (for clinozy-be)

Every room ships on fixtures. Each row below unblocks its rooms in production
(D8, L-60). Fixtures follow the same contracts, so swapping one in changes no UI.

| Domain                      | Needed from clinozy-be                                                                                           | Unblocks                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Clinic permissions          | module × action codes and the 11 abilities in the permission catalog; role-permission assignment                 | in-room gating everywhere (D9)                              |
| Staff profiles              | colour, phone, working days and hours, commission, branches on each membership                                   | Users, Appointments (doctors, slots), Today                 |
| Branches                    | CRUD: address, opening hours, GSTIN, team, default people                                                        | Users, header branch picker, print identity, bookable hours |
| Contacts                    | CRUD with phones, handles, default channel, preferences, consent; lookup by phone                                | Leads, Patients, contact card, duplicate checks             |
| Patients                    | CRUD, cursor lists, the four views (in clinic today, dues, follow-up, recall)                                    | Patients, patient file, every picker                        |
| Leads and messaging         | CRUD, threads, WhatsApp / Instagram send, delivery states, outage signal                                         | Leads, Activity panel, Tasks                                |
| Appointments                | CRUD, guarded status transitions, conflict check, reminders                                                      | Appointments, Today, file Visits                            |
| Visits and clinical records | visits (check-in → complete), Rx, treatments, photos (albums, privacy), reports, packages, suggestions, feedback | patient file, Visit sheet, Today                            |
| Money                       | invoices (server totals, GST), receipts, expenses, credits, credit notes, day close (review, reopen, auto-close) | Payments, Medical sales, file billing                       |
| Offerings                   | offerings, offers, effective price                                                                               | Offerings, Invoice drawer, booking drawer                   |
| Tasks                       | tasks CRUD and the 13-rule job                                                                                   | Tasks, Today aside, lead panels                             |
| Medical                     | medicines, batches, FEFO sales, POs, goods receipts, suppliers, manufacturers, MRs, returns                      | Medical                                                     |
| Clinic stock                | items, movements, purchases, vendors, stock check                                                                | Clinic stock                                                |
| Uploads                     | the photo size limit (Q-P5)                                                                                      | photos, reports, bills                                      |

## Appendix G — Plan self-check (Step 5)

- [ ] **Coverage matrix:** open until `schema-routes.md`, added after this plan, is
      read (L-61). Every other file in `iterations/launch-2026-09-30-jxmr/` was read in full and is
      owned by a plan section (Appendix A; 5,929 of 5,929 prototype lines).
- [x] **Every index screen** has a spec, reconciliation rows, a plan block and
      ledger rows (12/12, plus the prototype-only Visit sheet).
- [x] **The four rebuild-forcing facts** are resolved for every screen, or a
      RED question is raised (C.1, C.2).
- [x] **Every reconciliation verdict** carries file:line evidence (Appendix B).
- [x] **Theme:** all four registration points are listed; contrast was
      recomputed locally (§3.1).
- [x] **Colours:** all 140 prototype colour variables are mapped to tokens
      (Appendix E); 34 long-tail ones are flagged for side-by-side checks.
- [x] **Four rebuild facts:** recorded per screen with evidence (B.0).
- [x] **Shell:** a new variant, the full relocation table, and the make-it-live
      contract (§3.2).
- [x] **Routes** follow the island conventions, with registrations listed (§4).
- [x] **State** is mapped per screen with no rule violations (§5).
- [x] **Timings** are numbers in ms, and **icons** are named exports.
  - Strings get their i18n keys at build, from the cited prototype lines into
    the namespaces fixed in §3.8.
  - The source of the 10 non-English locales is open (Q-X1).
- [x] **Deviations** name md-over-prototype and project-rules-over-source items
      (§7).
- [x] **The ledger** covers all the work: 61 rows, all open (§9).

**Stop.** Nothing is built until you confirm. RED-1–4 are answered (D17–D20). Next: confirm D10 and the rest of §2, and confirm or amend Appendix D. `fe-design-ditto` then starts at
L-02.
