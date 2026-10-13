# KICKOFF — change-floating-tab-bar-2026-10-13-pkhy

> The plan and the ordered ledger for a small, incremental iteration from a written brief
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Iteration         | `change-floating-tab-bar-2026-10-13-pkhy`                                                                     |
| Mode              | incremental                                                                                                   |
| Baseline          | `launch-2026-09-30-jxmr` ([D2](plans/decisions.md)) — not chained to either later `change` iteration (D1)     |
| Intake mode       | brief — `BRIEF.md` received, 22 files carried forward from the Baseline                                       |
| Intake hash       | `bf1e340daaed` (gate passed 2026-10-13, Baseline `036cbb592ac5` unchanged)                                    |
| Schema-routes     | `5f90325208e1` — unchanged from the Baseline                                                                  |
| Sources           | `intake-files/BRIEF.md` (the change), `shell.md` and `_patterns.md` (carried forward), the current code       |
| Date              | 2026-10-13                                                                                                    |
| Evidence notation | `BRIEF.md:<line>`, `<spec>.md:<line>` in `intake-files/`, `src/…:<line>` in the code today                    |
| Repositories      | clinozy-fe only (D3)                                                                                          |
| Branch            | `feat/floating-tab-bar` (D4)                                                                                  |
| Planned by        | `fe-iteration-planning`                                                                                       |
| Built by          | `fe-kickoff-iteration` → `frontend-design`, `fe-theme-axis-audit`, `fe-rtl-logical-css`, `fe-test-generation` |

## 2. Locked decisions

| #   | Decision                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | A new `change` iteration on its own; no older iteration is its base or is edited ([D1](plans/decisions.md)); its snapshot rests on the launch's because `brief` needs one ([D2](plans/decisions.md))                    |
| K2  | The reference is the iOS 26 tab bar: floating capsule, glass, scroll-edge fade, sliding lens ([D5](plans/decisions.md)); minimize-on-scroll, a floating search button and refraction are out ([D6](plans/decisions.md)) |
| K3  | The capsule takes `data-slot="floating-edge"`, so Shape (Sharp) and Elevation own it unchanged ([D7](plans/decisions.md))                                                                                               |
| K4  | `--tab-bar-height` and `--tab-bar-gap` in `index.css` are the one source of the geometry; `--floating-bottom-offset` is derived from them ([D8](plans/decisions.md))                                                    |
| K5  | `nav[data-slot="mobile-nav"]` keeps its slot (the `:has()` hooks), its label and `md:hidden`; `data-testid="mobile-bottom-bar"` moves to the visible capsule, so a box measured by that id is the bar a person sees     |
| K6  | Approved on the user's standing instruction; the iteration stops at `done` and freezes after the user's final confirmation ([D9](plans/decisions.md))                                                                   |

## 3. Foundation (before any screen)

### 3.1 Theme — no new preset, no new colour token

The glass is mixed from existing semantic tokens, so every preset, base and dark mode follow it:

| Part             | Built from                                                                                                     | Light / dark                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Capsule fill     | `bg-card/95`; where `backdrop-filter` is supported `bg-card/72` + `backdrop-blur-xl` + `backdrop-saturate-150` | follows `--color-card`              |
| Capsule edge     | `border border-border/70`                                                                                      | follows `--color-border`            |
| Top highlight    | an inner sheen, `bg-linear-to-b from-card/80 to-transparent` over the top third, clipped by the capsule        | follows `--color-card`              |
| Shadow           | the `floating-edge` slot: zinc-pastel `--elevation-close`; the Elevation axis values when set (K3)             | as today for the drawer ×           |
| Scroll-edge fade | `bg-linear-to-t from-background via-background/70 to-transparent`                                              | follows `--color-background` (body) |
| Lens             | the current room's `TONE_CLASSES[tone].bg` (today's pill colour, `AppLayout.shared.tsx:119`)                   | the tone tokens already carry dark  |

Contrast — recompute locally, never trust a stated ratio: the slot inks do not change (current: tone
ink on tone bg, `shell.md:40`; others: `text-muted-foreground-strong`), and the capsule is at least
72% card, so against a white page the unselected label sits on the card colour it sits on today. The
check is done in L-6 on the running app, light and dark, with a dark photo row scrolled under it.

### 3.2 Shell

One design per surface: `MobileNav` (`src/shared/layouts/AppLayout/AppLayout.shared.tsx:198`) is
**replaced**, not given a variant. Nothing is relocated — the bar keeps the same five slots, the
same "More" → All sections sheet, the same `aria-*` and test ids (`shell.md:48`, K5).

| Platform surface                                                                          | Where it lives after this change                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Mobile tab bar                                                                            | the same `MobileNav`, restyled as the floating capsule                                         |
| All sections (phone)                                                                      | unchanged — "More" opens `AllSectionsSheet`                                                    |
| Notice pills, "New", tray, toasts, offline / update pills, consent card, feedback trigger | unchanged components; their clearance comes from the derived `--floating-bottom-offset` (§6.3) |
| Header (org switcher, branch picker, ⌘K, notifications, account menu, settings entry)     | untouched                                                                                      |

### 3.3 Stores

None — the lens position is derived from `nav.current` at render time.

### 3.4 Icons

None new: the room icons and `Compass` from `@/shared/icons/index.ts`, drawn at 22px (`size-5.5`).

## 4. Route / island map

n/a — no route, island or URL changes; the bar lives in `src/shared/layouts/AppLayout/`.

## 5. State management map

| Screen                | Server state                     | Client state                                                                   | URL state                                    | Form state |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ---------- |
| shell (phone tab bar) | none new (`useAppNav`, as today) | the All sections sheet's `sheetOpen` (`AppLayoutSectionBar.tsx:208`, as today) | the current room, from the router (as today) | none       |

## 6. Per-screen build notes

### 6.1 The capsule and its glass (`shell`, below `md`) — `frontend-design`, `fe-theme-axis-audit`

- `nav` (`data-slot="mobile-nav"`, aria-label "Sections", `md:hidden`): `fixed inset-x-0 bottom-0
z-40 pointer-events-none`, holding two children:
  - the **scroll-edge fade** — `aria-hidden`, full width, from the screen bottom to 24px above the
    capsule's top edge (`calc(var(--tab-bar-gap) + var(--tab-bar-height) + 1.5rem)`), the
    `--color-background` gradient of §3.1; takes no taps (the nav's `pointer-events-none`);
  - the **capsule** — `data-slot="floating-edge"`, `data-testid="mobile-bottom-bar"`,
    `pointer-events-auto`, `absolute inset-x-5 bottom-(--tab-bar-gap) mx-auto max-w-md
h-(--tab-bar-height)`, `rounded-full overflow-hidden p-1`, a 5-column grid, the glass of §3.1.
- Geometry (`BRIEF.md:5–9`): 62px tall (`--tab-bar-height: 3.875rem`); 20px sides (`inset-x-5`); at
  most 448px (`max-w-md`), centred; bottom `--tab-bar-gap: max(0.75rem, calc(env(safe-area-inset-bottom, 0px) - 0.75rem))`
  → 12px without an inset, 22px on a 34px inset.
- Under the Sharp shape the capsule is square through its slot (K3); the sheen and the lens are
  clipped by it, so they square with it.

### 6.2 Slots and the sliding lens — `frontend-design`, `fe-rtl-logical-css`, `fe-test-generation`

- **Slots** (`BRIEF.md:23–24`): `relative z-10` column, icon 22px over the 10.5px label
  (`text-tiny`, line-height 1.1, `WeightStableLabel` as today), gap 2px, 54px tall (the capsule's
  inner height), `rounded-full`, no tap highlight. Current: tone ink, label 600. Others: icon
  `text-muted-foreground`, label `text-muted-foreground-strong`, 500 (`shell.md:40`).
- **Press** (`BRIEF.md:24–25`): the slot's content (icon + label wrapper) `transition-transform
duration-100 motion-safe:group-active:scale-[0.92]` — reduced motion never scales.
- **Lens** (`BRIEF.md:16–22`): one `aria-hidden` element, `data-slot="pill"`, `absolute inset-y-1
start-1 w-[calc((100%-0.5rem)/5)] rounded-full`, the current tone's `bg`; positioned by a fixed
  class per slot index (`translate-x-0` … `translate-x-[400%]`, each with its `rtl:` negative so the
  slide mirrors); `transition-[translate,background-color,opacity] duration-320
ease-[cubic-bezier(0.32,0.72,0,1)]`. No current slot → `opacity-0` (it stays where it was and
  fades). "More" naming an unpinned current room → index 4 in that room's tone (`shell.md:48`).
  Reduced motion: the global rule (`index.css` reduced-motion block) cuts every transition, so it
  jumps.
- **"More" while its sheet is open** and not current (`shell.md:48`: "its pill turns z100 while the
  sheet is open"): the slot itself takes `bg-muted` as a pressed capsule, under the lens layer's
  absence (the lens is elsewhere or hidden).
- The lens only ever has one position: the index of the current slot among the five, computed from
  `nav.pinned.slice(0, 4)` and `elsewhere` exactly as `SectionTabBar` does today
  (`AppLayout.shared.tsx:131–145`).

### 6.3 The phone bottom stack — `fe-theme-axis-audit`, `fe-test-generation`

- `index.css` (`:1638–1646` today): under `:root:has([data-slot='mobile-nav'])` declare
  `--tab-bar-height`, `--tab-bar-gap` and
  `--floating-bottom-offset: calc(var(--tab-bar-gap) + var(--tab-bar-height) - env(safe-area-inset-bottom, 0px))`
  — the capsule's top edge less the inset, because every consumer adds the inset itself
  (`NoticeStack.tsx:76`, `RoomPrimary.tsx:160`, `UploadTray.tsx:159`, `AppToaster.tsx:17–20`,
  `OfflineIndicator.tsx:40`, `CriticalUpdateNotice.tsx:58`, `ConsentBanner.tsx:143–145`). From `md`
  the offset stays `0rem`. Result: 50px over a 34px inset (top edge 84px), 74px without (top edge
  74px), against 58px + inset today.
- The feedback trigger (`index.css:1682–1684`) is the one consumer that does not add the inset:
  give it `calc(var(--floating-bottom-offset, 0rem) + env(safe-area-inset-bottom, 0px))` so it
  clears the capsule on a phone with a home indicator too.
- The routed page's clearance: the flush `<main>` already ends at
  `offset + inset` (`AppLayout.shared.tsx:343`) — the capsule's top edge; the padded `<main>`'s
  `pb-20` / `sm:pb-20` (`:344`) and the phone rule `padding-bottom: calc(5rem + consent)`
  (`index.css:1674–1676`) become `offset + inset + 0.75rem` (+ the consent card's height in the phone
  rule), so the last row scrolls clear of the capsule with the same 12px air the consent card keeps.
- The pins of `bottom-stack-css.test.ts` move with it: the tab bar publishes the derived offset
  below `md` and `0rem` from `md`.

## 7. Deviations

### 7.1 Brief over the carried-forward specs

| Item          | Spec says                                                                                                                                                                           | Built as                                                                                                        | Why                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Tab bar shape | "grid of 5 equal columns, height calc(58px + env(safe-area-inset-bottom)), padding 4px 4px env(…), 1px top hairline, white, z 35" (`shell.md:48`; prototype `Clinozy.dc.html:2885`) | a floating 62px glass capsule, 20px from the sides, 12px / inset − 12px off the bottom, with a scroll-edge fade | `BRIEF.md:5–15`               |
| Current slot  | "icon pill (46×28, radius 999, background transition 160ms)" in the tone bg (`shell.md:40`, `:48`)                                                                                  | a lens behind icon and label together, sliding 320ms                                                            | `BRIEF.md:16–22`              |
| Icon size     | 16px, "More" 18px (`shell.md:48`; `_patterns.md:297`, `:300`)                                                                                                                       | 22px both                                                                                                       | `BRIEF.md:23`                 |
| Label gap     | 3px (`shell.md:48`)                                                                                                                                                                 | 2px                                                                                                             | `BRIEF.md:24`                 |
| Third app row | phone: "3-row grid header · main · bottom tab bar" (`shell.md:7`, `:71`)                                                                                                            | a fixed, floating bar over `main` (already a Standing deviation since the launch, D30)                          | the bar now floats on purpose |

### 7.2 Project rules over the source

- Semantic tokens only — the glass is `card` / `border` / `background` mixes, never a raw white.
- The theme axes own the bar: Shape squares it under Sharp, Elevation owns its shadow (K3); the
  brief's "fully rounded" holds on every other shape.
- Logical CSS: `inset-x-*`, `start-1` and `rtl:` translations — no `left-*` / `right-*`.
- No new string: "Sections", "All sections" and "More" keep their keys.

### 7.3 The Baseline's Standing deviations this change touches

| Item                | Design says              | Built as                                          | Since                  | Decision | This iteration                                                                         |
| ------------------- | ------------------------ | ------------------------------------------------- | ---------------------- | -------- | -------------------------------------------------------------------------------------- |
| Phone tab bar       | the app grid's third row | fixed `MobileNav`; main reserves 58px + safe area | launch-2026-09-30-jxmr | D30      | **changes**: fixed floating glass capsule; main reserves its top edge (offset + inset) |
| Tab-bar slot radius | 10px                     | `rounded-lg`                                      | launch-2026-09-30-jxmr | §7.2     | **changes**: `rounded-full` (the lens's shape), squared under Sharp                    |

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof, plus the baseline
set.

| Criterion (`BRIEF.md`)                                                      | Proof                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| capsule geometry; none from `md` (`:61–63`)                                 | measured in the running app at 390 × 844 and 375 × 667 with and without a 34px safe-area inset (the inset emulated by a test stylesheet), and at 820px (no bar); unit test on the classes                                                       |
| translucent glass, edge, shadow; opaque fallback (`:64–65`)                 | screenshots over a scrolled room, light and dark; class assertions (`supports-backdrop-filter:`)                                                                                                                                                |
| scroll-edge fade takes no taps (`:66–67`)                                   | `elementFromPoint` under the fade hits the page; class assertion `pointer-events-none`                                                                                                                                                          |
| one lens, slides 320ms, fades with no current, carries to "More" (`:68–70`) | unit tests on the lens index/opacity for a pinned room, an unpinned room and no room; a frame-sampled slide in the running app                                                                                                                  |
| 22px icons, 10.5px labels, 54px slots, no width change (`:71–72`)           | measured in the running app; `WeightStableLabel` unchanged                                                                                                                                                                                      |
| reduced motion (`:73`)                                                      | `prefers-reduced-motion: reduce` in the running app: the lens lands at once, no press scale                                                                                                                                                     |
| right-to-left (`:74`)                                                       | the running app with `dir="rtl"`: the first pin on the right, the lens under it, sliding left                                                                                                                                                   |
| Sharp shape (`:75`)                                                         | the running app with `data-shape="sharp"`: capsule and lens square                                                                                                                                                                              |
| the bottom stack clears the capsule (`:76–78`)                              | measured with the notice pill, "New", toast and consent card shown, with and without the inset; `bottom-stack-css.test.ts`                                                                                                                      |
| ids, roles, `aria-current`, sheet, axe (`:79–80`)                           | the existing `AppLayoutSectionBar` tab bar tests + axe, unchanged in intent                                                                                                                                                                     |
| gates and budgets (`:81`)                                                   | `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm validate:logical && pnpm type-check && pnpm lint && pnpm biome:check && pnpm test && pnpm build && pnpm build:check && pnpm size` |

Baseline set: the header at 1440 and 820 is unchanged; a room at 390 scrolls to its last row clear
of the capsule; the All sections sheet still opens from "More". Close: `AS-BUILT.md` with its
summary and Standing deviations, `pnpm iteration:status <it> done`; `frozen` waits for the user's
final confirmation (D9).

## 9. The route — the ordered ledger

| #   | Work item                                                                                                                            | Kind       | Depends on | Skill/driver                          | Acceptance                          | Assignee | Status                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------- | ------------------------------------- | ----------------------------------- | -------- | ---------------------------- |
| L-1 | Geometry tokens + derived `--floating-bottom-offset`, feedback trigger, page clearance (`index.css`, `AppMain`)                      | global     | —          | fe-theme-axis-audit                   | §6.3; `bottom-stack-css.test.ts`    | Claude   | done                         |
| L-2 | The capsule: nav container, scroll-edge fade, glass capsule on `floating-edge`                                                       | styling    | L-1        | frontend-design · fe-theme-axis-audit | §8 rows 1–3                         | Claude   | done (revised → AS-BUILT #2) |
| L-3 | Slots: 22px icons, 54px slots, press dip, "More" pressed state                                                                       | styling    | L-2        | frontend-design                       | §8 rows 5–6                         | Claude   | done                         |
| L-4 | The sliding lens (index, tone, fade, RTL, reduced motion)                                                                            | structural | L-3        | frontend-design · fe-rtl-logical-css  | §8 rows 4, 6, 7, 8                  | Claude   | done                         |
| L-5 | Tests: tab bar unit tests (lens index/opacity, capsule test id, fade), bottom-stack CSS pins                                         | verify     | L-1–L-4    | fe-test-generation                    | `pnpm test` green                   | Claude   | done                         |
| L-6 | Docs: the shell notes that describe the bar (`AppLayout` overview/layout docs, `docs/reference/design.md` screen tiers)              | copy       | L-1–L-4    | fe-documentation-maintenance          | `pnpm sync:check`, `pnpm docs:lint` | Claude   | done                         |
| L-7 | Verify: the BRIEF acceptance in the running app (measurements + screenshots, light/dark, inset/no inset, RTL, Sharp, reduced motion) | verify     | L-1–L-6    | fe-kickoff-iteration                  | every §8 row proven                 | Claude   | done                         |
| L-8 | Gates: static, unit, build, size                                                                                                     | gate       | L-7        | fe-before-commit-guard                | §8 last row green                   | Claude   | open                         |
| L-9 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                                                             | verify     | L-8        | fe-kickoff-iteration                  | README Status `done`                | Claude   | open                         |

## Appendix A — Coverage matrix

| File (`intake-files/`)                                                                    | Read fully?                                                                                 | Kind                        | Facts it owns here                                   | In plan at       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ---------------- |
| `BRIEF.md`                                                                                | yes                                                                                         | the change                  | six changes, rules, 11 criteria, out of scope        | §2, §6, §8, §9   |
| `shell.md`                                                                                | the rows it touches (`:7`, `:12`, `:40–41`, `:48`, `:64–65`, `:71–73`)                      | spec (carried forward)      | the tab bar's shape, slots, active treatment, "More" | §3.2, §6, §7.1   |
| `_patterns.md`                                                                            | icon rows (`:297`, `:300`); the phone offsets of the bottom-stack surfaces (`:235`, `:252`) | spec (carried forward)      | tab-bar icon sizes; what rides above the bar         | §6.2, §6.3, §7.1 |
| `Clinozy.dc.html`                                                                         | the tab bar (`:20`, `:149`, `:2885–2887`, `:4081`)                                          | prototype (carried forward) | the drawn bar: 58px + inset, hairline, white         | §7.1             |
| the other 19 files (screens, `support.js`, `schema-routes.md`, `PRD.md`, `_report.md`, …) | not re-read — unchanged since the Baseline (`iteration:diff`: only `BRIEF.md` added)        | carried forward             | none in this change                                  | —                |

## Appendix B — Reconciliation (BRIEF ↔ carried-forward specs ↔ code)

| #   | Fact                                                | Spec says                                                     | Code today                                                                                           | BRIEF says                                           | Winner                         | Action |
| --- | --------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------ | ------ |
| R1  | Bar shape                                           | 58px + inset, hairline, white (`shell.md:48`)                 | `bg-card fixed inset-x-0 bottom-0 … h-[calc(3.625rem+env(…))] border-t` (`AppLayout.shared.tsx:213`) | floating 62px glass capsule (`BRIEF.md:5–15`)        | BRIEF                          | L-2    |
| R2  | Current slot                                        | 46×28 tone pill behind the icon (`shell.md:40`)               | `tabPillClassName` `h-7 w-11.5 rounded-full` (`AppLayout.shared.tsx:86–87`)                          | lens behind icon + label, sliding (`BRIEF.md:16–22`) | BRIEF                          | L-4    |
| R3  | Icons                                               | 16px, "More" 18px (`shell.md:48`)                             | `size-4`, `size-4.5` (`AppLayout.shared.tsx:121`, `:171`)                                            | 22px (`BRIEF.md:23`)                                 | BRIEF                          | L-3    |
| R4  | Label width                                         | —                                                             | `WeightStableLabel` (`AppLayout.shared.tsx:123–126`)                                                 | no width change (`BRIEF.md:71–72`)                   | code (kept)                    | L-3    |
| R5  | "More" while open                                   | "its pill turns z100 while the sheet is open" (`shell.md:48`) | `bg-muted` pill (`AppLayout.shared.tsx:148`)                                                         | "a muted pressed capsule" (`BRIEF.md:21–22`)         | BRIEF (same token, whole slot) | L-3    |
| R6  | Reservation                                         | —                                                             | `--floating-bottom-offset: 3.625rem` (`index.css:1640`)                                              | the stack follows the capsule (`BRIEF.md:26–29`)     | BRIEF                          | L-1    |
| R7  | Mobile behaviour, popup shape, sequence, table/card | phone only; "More" → bottom sheet (`shell.md:65`)             | `AllSectionsSheet` (`AppLayoutSectionBar.tsx:212`)                                                   | unchanged (`BRIEF.md:46–49`)                         | all agree                      | none   |
