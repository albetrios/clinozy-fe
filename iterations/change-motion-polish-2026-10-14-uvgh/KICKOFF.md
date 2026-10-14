# KICKOFF — change-motion-polish-2026-10-14-uvgh

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-motion-polish-2026-10-14-uvgh`                                               |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D3](plans/decisions.md))              |
| Intake hash       | `80bac31a12d7` (gate passed 2026-10-14)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects       |
| Date              | 2026-10-14                                                                           |
| Evidence notation | `BRIEF.md` › change n in `intake-files/`, `src/…` in the code                        |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D5](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — What moves is chosen by the motion bar: only where it explains a change.
2. **D2** — Baseline `none`, from scratch.
3. **D3** — Intake mode `brief`, type `change`, topic `motion-polish`.
4. **D4** — Built on `feat/motion-polish`; pushed, no PR until the user's final confirmation.
5. **D5** — No clinozy-be sibling.
6. **D6** — Two named curves: `--ease-sheet` (existing, now named) and `--ease-out-strong` (new).
7. **D7** — One shared `SelectionGlide` for every measured selection; the phone lens keeps its CSS.
8. **D8** — No glide on rows whose tabs paint their own selected colours.
9. **D9** — The glide covers the selected segment only once it is placed; no layout keeps the old look.
10. **D10** — `RollingNumber` on Today's lane tiles; numbers inside sentences stay.
11. **D11** — One shell observer settles every `data-refreshing` subtree.
12. **D12** — Drawer exits, the command palette and page transitions are not touched.
13. **D13** — New rules ship in co-located stylesheets; `index.css` gains only the curves and the press.
14. **D14** — Approved under the user's instruction; closes at `done`, `frozen` at final confirmation.

## 3. Foundation (before any screen)

### 3.1 Theme

No colour, radius or font token changes. Two motion properties join `:root` in `src/index.css`:
`--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1)` and `--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1)`.
The five literal uses of the sheet curve (`--animate-drawer-in`, `-backdrop-in`, `-bulk-in`,
`-sheet-up`, the phone lens) read `var(--ease-sheet)`.

### 3.2 Shell

The app shell (`AppLayout`) mounts the refresh-settle observer once; the section bar's nav hosts the
pinned tabs' glide. No layout, slot or breakpoint changes.

### 3.3 Stores

None.

### 3.4 Icons

None.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                           | Kind                          | Change                                                          |
| -------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `src/shared/components/SelectionGlide/` (+ `.css`)             | shared unit (folder-per-unit) | new — the measured thumb / lens                                 |
| `src/shared/components/RollingNumber/` (+ `.css`)              | shared unit (folder-per-unit) | new — a number that rolls to its next value                     |
| `src/lib/animations/useRefreshSettle.ts`                       | lib hook                      | new — settles a subtree when `data-refreshing` leaves it        |
| `src/shared/components/RoomToolbar/RoomTabs/RoomTabs.tsx`      | shared unit                   | the track's thumb (room tabs, `look="track"` views)             |
| `src/shared/layouts/AppLayout/components/PinnedTabs/`          | layout unit                   | the section bar's tone lens                                     |
| `src/pages/…/today/components/{LaneTiles,LanePanel,WorkQueue}` | page units                    | rolling counts; tone crossfade + cascade; Mine · Everyone glide |
| `src/shared/components/ui/{button,checkbox,switch}.tsx`        | vendored primitives           | press; tick pop; switch curve                                   |
| `AllSections`, `PatientAddMenu`                                | menus                         | the Radix trigger origin instead of a fixed corner              |

## 5. State management map

| Surface        | Server state | Client state                                      | URL state | Form state |
| -------------- | ------------ | ------------------------------------------------- | --------- | ---------- |
| Glides         | —            | none — measured from the DOM each commit          | —         | —          |
| Rolling counts | —            | the previous value, in the component (`useState`) | —         | —          |
| Refresh settle | —            | none — a `MutationObserver` in the shell          | —         | —          |

No rule is under pressure: nothing is stored in a store or the URL; every motion reads the state
the screen already has.

## 6. Per-screen build notes

### 6.1 Curves and the press — `emil-design-eng`

- Press: `motion-safe:active:scale-[0.97]` on every `Button` variant but `link`; `scale` joins the
  button's transition list (Tailwind's 150ms; the transition already carries colours).
- Under reduced motion the press does not scale (`motion-safe:`), and the app's reduce rule holds.

### 6.2 `SelectionGlide` — `review-animations`, `fe-rtl-logical-css`

```text
the track (relative, isolate — set by :has(> [data-slot=selection-glide]))
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓ thumb (z −1, absolute, inline-start 0)│   translate: --glide-x --glide-y
│ [Agenda] [ Day ] [ Week ] [ Month ]           │   width/height: --glide-w / --glide-h
└─────────────────────────────────────────────┘
selection moves → data-glide="gliding": translate + size 280ms --ease-sheet, colour 280ms
resize / fonts  → data-glide="still":   placed at once
no selection    → data-glide="gone":    fades out 160ms
```

- Placement from rects (sub-pixel): `x = itemEdge − trackPaddingEdge + scrollLeft`, the edges being
  left in LTR and right in RTL (the thumb is anchored at `inset-inline-start: 0`).
- The selected item gets `data-glide-covered` once the thumb has a real size; the stylesheet then
  clears its background and shadow. Without a size (jsdom, `display: none`) nothing is covered.
- Re-measures on every commit and on a `ResizeObserver` of the track and the item; glides only
  when the selected element changes.

### 6.3 The section bar lens — `frontend-design`

The lens is the current room's `tone.bg` on a `rounded-lg` thumb under its `PinnedTab`
(`[aria-current="page"]`); its colour crossfades while it glides. A current room outside the pinned
tabs (opened from "All sections") fades it out.

### 6.4 Today — `frontend-design`, `review-animations`

- Lane tiles: the count is a `RollingNumber` (key on the value, previous kept as an `aria-hidden`
  layer while it leaves; up when it grows, down when it shrinks; `0.6em`, a 2px blur, 280ms
  `--ease-out-strong`; nothing on the first paint).
- Lane panel: `transition-[background-color,border-color]` 200ms; the card grid replays
  `lane-cascade` (`useReplayedAnimation`, keyed on the lane): 220ms, 4px, 25ms apart for the
  first six.
- Work queue: Mine · Everyone gets a `bg-muted` glide.

### 6.5 Refresh settle — `review-animations`

`useRefreshSettle()` in `AppLayout`: a `MutationObserver` on the shell with
`attributeFilter: ['data-refreshing']` and `attributeOldValue`; when the attribute leaves an
element, `element.animate([{ opacity: 0.5 }, { opacity: 1 }], 220ms, --ease-out-strong)`. Skipped
under reduced motion (`prefersReducedMotion()`).

### 6.6 Small controls — `shadcn`

Checkbox: the indicator pops (`checkbox-tick`, 160ms, `scale(0.65)` + opacity → none) from a
co-located `checkbox.css`. Switch: the root's `transition-all` becomes its colours and shadow; the
thumb travels 200ms on `--ease-out-strong`. `AllSections` and `PatientAddMenu` drop `origin-top-left`
/ `origin-top-right`, so the content's own `origin-(--radix-…-transform-origin)` applies.

## 7. Deviations

### 7.1 Brief over the design

From scratch there is no carried-forward design: the brief is the design for motion. Where the
code's earlier design said a thing does not move (drawer exits), the brief agrees (D12).

### 7.2 Project rules over the brief

- Semantic tokens only; no raw palette (`pnpm validate:tokens`); logical placement (`pnpm
validate:logical`) — the glide is anchored at `inset-inline-start`.
- Co-located stylesheets keep the first paint within budget (D13, `pnpm size`).

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)              | Proof                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| press                               | `button` test (the press class on every variant but `link`); the recording                       |
| track thumbs glide                  | `SelectionGlide` tests (placement, cover, glide vs still, RTL); `RoomTabs` tests; the recordings |
| section bar lens                    | `PinnedTabs` test (the lens's tone); the desktop recording                                       |
| counts roll; not on first paint     | `RollingNumber` tests; `LaneTiles` test; the recording (check-in, send-in)                       |
| lane panel crossfade + cascade      | `LanePanel` test (the cascade class); the recording                                              |
| refresh settles                     | `useRefreshSettle` tests                                                                         |
| tick pops; switch curve             | `checkbox` / `switch` class tests                                                                |
| Arabic                              | screenshot `ar` 1440 (Appointments' views, the section bar)                                      |
| reduced motion                      | `RollingNumber` / `useRefreshSettle` tests; screenshot with `prefers-reduced-motion: reduce`     |
| light + dark; no raw colours        | screenshots; `pnpm validate:tokens`                                                              |
| CSS budget; test ids and roles kept | `pnpm size` Initial CSS; `pnpm validate:testids`; the existing suites unchanged                  |
| gates                               | `pnpm health`                                                                                    |

## 9. The route — the ordered ledger

| #    | Work item                                                                                        | Kind       | Depends on | Skill/driver                              | Acceptance                          | Assignee | Status |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | ---------- | ----------------------------------------- | ----------------------------------- | -------- | ------ |
| L-1  | The two curves in `index.css`; the sheet curve's literals read `--ease-sheet`                    | global     | —          | emil-design-eng                           | §8 gates; `bottom-stack-css` test   | Claude   | done   |
| L-2  | The button's press                                                                               | global     | L-1        | shadcn · emil-design-eng                  | §8 row 1                            | Claude   | done   |
| L-3  | `SelectionGlide` unit + `selection-glide.css` + tests                                            | structural | L-1        | composition-patterns · fe-test-generation | §8 row 2                            | Claude   | done   |
| L-4  | The tracks: `RoomTabs`, `RoomViewTabs` (`track`), Today's Mine · Everyone                        | structural | L-3        | review-animations                         | §8 row 2                            | Claude   | done   |
| L-5  | The section bar's lens (`PinnedTabs`)                                                            | structural | L-3        | frontend-design                           | §8 row 3                            | Claude   | done   |
| L-6  | `RollingNumber` unit + `rolling-number.css` + tests; Today's lane tiles                          | structural | L-1        | review-animations · fe-test-generation    | §8 row 4                            | Claude   | done   |
| L-7  | Today's lane panel: tone crossfade + card cascade (`lane-panel.css`)                             | styling    | L-1        | frontend-design                           | §8 row 5                            | Claude   | done   |
| L-8  | `useRefreshSettle` + the shell mount + tests                                                     | structural | L-1        | review-animations · fe-test-generation    | §8 row 6                            | Claude   | done   |
| L-9  | Checkbox tick, switch curve, the two menus' origins                                              | styling    | L-1        | shadcn                                    | §8 row 7                            | Claude   | done   |
| L-10 | Docs: `design.md` Motion, overviews, the project tree                                            | copy       | L-1–L-9    | fe-documentation-maintenance              | `pnpm sync:check`, `pnpm docs:lint` | Claude   | done   |
| L-11 | Verify in the running app: recordings (desktop, phone), screenshots (light, dark, `ar`, reduced) | verify     | L-1–L-10   | fe-kickoff-iteration                      | every §8 row proven                 | Claude   | done   |
| L-12 | Gates: `pnpm health`                                                                             | gate       | L-11       | fe-before-commit-guard                    | §8 last row                         | Claude   | done   |
| L-13 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                         | verify     | L-12       | fe-kickoff-iteration                      | README Status `done`                | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                  | In plan at     |
| ---------------------- | ----------- | ---------- | --------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | eight changes, rules, eleven criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact              | Brief says                               | Code before says                                                         | Winner | Action   |
| --- | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------ | -------- |
| R1  | curves            | two named curves (change 1)              | the sheet curve as five literals; ad-hoc curves elsewhere                | brief  | L-1      |
| R2  | segment selection | one gliding thumb (change 3)             | each segment paints `bg-card` + ring on its own; selection jumps         | brief  | L-3, L-4 |
| R3  | section bar       | a gliding tone lens from `md` (change 4) | each `PinnedTab` paints `tone.surface`; the phone bar already has a lens | brief  | L-5      |
| R4  | Today counts      | roll on change (change 5)                | `formatNumber(cards.length)` swaps in place                              | brief  | L-6      |
| R5  | lane panel        | crossfade + cascade (change 6)           | the panel swaps tone and cards at once                                   | brief  | L-7      |
| R6  | refresh           | settle from half opacity (change 7)      | bars snap to text when `data-refreshing` leaves                          | brief  | L-8      |
| R7  | drawer exits      | out of scope                             | no exit motion by design (`record-drawer-chrome.tsx`)                    | code   | kept     |
