# KICKOFF — change-photo-compare-zoom-2026-10-15-funk

> The plan and the ordered ledger for a change from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-photo-compare-zoom-2026-10-15-funk`                                          |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D3](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D4](plans/decisions.md))              |
| Intake hash       | `197549697b4a` (gate passed 2026-10-15)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the comparison and viewer  |
| Date              | 2026-10-15                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…` in the code                            |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D4](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — A second iteration on the same branch: the first is `done` and cannot go back.
2. **D2** — Type `change`.
3. **D3** — Baseline `none`; the current code is the truth for what is touched.
4. **D4** — Intake mode `brief`; clinozy-fe only.
5. **D5** — Branch `feat/patient-overview-photos`; approved on the user's request; no PR until they confirm.
6. **D6** — Linked moves every photo by the same step from where it stands; the bar shows the first photo's level.
7. **D7** — Separate: a gesture moves its photo only; a zoom group per panel; the bar's group → "Reset all"; keys act on all.
8. **D8** — Remembered in `useDevicePrefsStore`: the mode, the picked layout, each comparison's framings (24 kept).
9. **D9** — Framings are remembered per comparison (its set of photo ids), not per photo.
10. **D10** — The comparison's pan is a share of the panel; the viewer keeps pixels.
11. **D11** — `usePhotoZoom` is generalized to many photos; the viewer uses it with one.
12. **D12** — Phone: icon-only mode radios; the panel zoom groups and "Reset all" show.
13. **D13** — `Unlink` joins the icon registry; only utilities the app already ships.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. The comparison's dark chrome (`bg-overlay/94`, `text-canvas`,
`border-canvas/20`, `hover:bg-canvas/10`), the panels' glass chips (`bg-overlay/60`,
`backdrop-blur-sm`); named radius steps; every `rounded-full` surface carries `data-slot="pill"`.

### 3.2 Shell

Untouched.

### 3.3 Stores

`useDevicePrefsStore` (this device) gains `photoCompareZoom`, `photoCompareLayout`,
`photoCompareFramings` and their setters (D8). New fields take their defaults on load (no version
bump).

### 3.4 Icons

`Unlink` (Lucide `unlink`) is added to `@/shared/icons/index.ts`; Linked uses `LinkIcon`.

## 4. Route / island map

| Unit                                                   | Kind          | Change                                                                       |
| ------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------- |
| `src/shared/store/useDevicePrefsStore/`                | global store  | mode, layout, framings per comparison                                        |
| `…/$patientId/images/shared/hooks/usePhotoZoom/`       | family hook   | many photos: `linked`, `initial`, `pan`, `of(id)`, `all`, `framings`         |
| `…/$patientId/images/shared/components/PhotoChrome/`   | family unit   | `PhotoZoomGroup` `variant="panel"` (the glass pill on a photo), a label prop |
| `…/$patientId/images/shared/photo-compare.ts`          | family module | `photoCompareKey(ids)`; the layout type from the store                       |
| `…/$patientId/images/components/PhotoCompare/`         | page unit     | the mode switch, panel zoom groups, Reset all, the remembered state          |
| `…/$patientId/images/$imageId/components/PhotoViewer/` | page unit     | calls the generalized hook with its one photo                                |

## 5. State management map

| Surface    | Server state                        | Client state                                                         | URL state             | Form state |
| ---------- | ----------------------------------- | -------------------------------------------------------------------- | --------------------- | ---------- |
| Comparison | `usePatientPhotosByIds` (unchanged) | framings (`usePhotoZoom`); mode, layout, framings remembered (store) | `?compare=` (2–8 ids) | —          |
| Viewer     | `usePatientPhoto` (unchanged)       | its one photo's framing (`usePhotoZoom`)                             | `$imageId`            | —          |

## 6. Per-screen build notes

### 6.1 The comparison — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

```text
┌ Compare photos · 4 photos ── [🔗 Linked | ⛓ Separate] [One row | Grid] [− 100% +] (×) ┐   Linked
┌ Compare photos · 4 photos ── [🔗 Linked | ⛓ Separate] [One row | Grid] [Reset all] (×) ┐   Separate
│ ┌ 1 · 23 Jul ──────── × ┐ ┌ 2 · 13 Aug ──────── × ┐ …                                    │
│ │        photo          │ │        photo          │                                      │
│ │            [− 125% +] │ │            [− 200% +] │   ← Separate only, bottom end corner │
│ │ name           Start  │ │ name        +21 days  │                                      │
└ Scroll or pinch on a photo to zoom only that one · Drag a photo to place it · Esc ───────┘
```

- The mode radios reuse the layout switch's look (one `CompareRadios` for both); below `md` their
  labels are `max-md:sr-only` (D12). Test ids `patient-photo-compare-zoom-mode-<linked|separate>`.
- Linked: the bar's `PhotoZoomGroup` shows the first photo's level and moves all (`all.*`).
- Separate: "Reset all" (`patient-photo-compare-reset-all`, bordered like the zoom group); each panel
  `PhotoZoomGroup variant="panel"` with `patient-photo-compare-panel-zoom-{out,reset,in}`.
- Panels render `--photo-x/--photo-y` as percentages of the full-size box (D10).
- The hint row follows the mode (`compare.hints.zoom` / `pan` vs `zoomEach` / `panEach`).
- On open: the framings remembered for `photoCompareKey(ids)`; on every change at rest (not mid-drag):
  remembered again. Mode and layout read from and written to the store.

### 6.2 The zoom hook — `fe-test-generation`

- State: framings by photo id (only moved ones; a framing at 100% centred is dropped), mirrored in a
  ref so a burst of events between renders computes from the latest value.
- A drag or a pinch snapshots the framings it moves at its start and computes each move from them.
- `linked` moves every `photoIds` entry; else the photo under the gesture. A mouse drags when a moved
  photo is zoomed; a touch drag at 100% is a swipe (`onSwipe`, the viewer).
- `pan: 'fraction'` divides a drag by the stage's size (1 when it has none, as in a test DOM).

## 7. Deviations

### 7.1 Brief over the current code

- The comparison's one shared zoom becomes Linked (relative, D6) or Separate (D7).
- The layout the user picks is remembered; until then it follows the count as before.

### 7.2 Project rules over the brief

- Every string an i18n key in all 11 locales (`pnpm validate:i18n-parity`).
- One zoom hook, reused by the viewer (D11); one radios component for both switches.

## 8. Verification

| Criterion (`BRIEF.md`)                            | Proof                                                                                                                                                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linked / Separate, Linked by default (`:57`)      | `PhotoCompare` tests; screenshots                                                                                                                                                                                |
| Separate moves one; Reset all (`:58–59`)          | `PhotoCompare`, `usePhotoZoom` tests; the video                                                                                                                                                                  |
| Separate → Linked keeps alignment (`:60–61`)      | `usePhotoZoom`, `PhotoCompare` tests; the video                                                                                                                                                                  |
| reopen restores framings; mode, layout (`:62–63`) | `PhotoCompare`, `useDevicePrefsStore` tests; the video                                                                                                                                                           |
| 100% forgotten, memory bounded (`:64`)            | `useDevicePrefsStore` tests                                                                                                                                                                                      |
| the viewer unchanged (`:65`)                      | `PhotoViewer`, `PatientPhotoViewerPage`, `usePhotoZoom` tests                                                                                                                                                    |
| existing tests, gates (`:66`)                     | `pnpm test:coverage`; `pnpm type-check && pnpm lint && pnpm biome:check && pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm sync:check`; `pnpm size` |

## 9. The route — the ordered ledger

| #   | Work item                                                                                | Kind       | Depends on | Skill/driver                                             | Acceptance                          | Assignee | Status |
| --- | ---------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------- | ----------------------------------- | -------- | ------ |
| L-1 | `Unlink` in the icon registry                                                            | foundation | —          | fe-code-structure                                        | `pnpm type-check`                   | Claude   | done   |
| L-2 | Copy: the new `patient-file` keys in 11 locales + constants and test ids                 | copy       | —          | fe-i18n-constants                                        | i18n parity                         | Claude   | done   |
| L-3 | `useDevicePrefsStore`: mode, layout, framings per comparison                             | foundation | —          | fe-state-management · fe-test-generation                 | §8 row 5                            | Claude   | done   |
| L-4 | `usePhotoZoom` for many photos; the viewer on it                                         | structural | L-3        | fe-component-promotion · fe-test-generation              | §8 rows 2, 3, 6                     | Claude   | done   |
| L-5 | The comparison: mode switch, panel zoom groups, Reset all, remembered state, percent pan | screen     | L-1–L-4    | frontend-design · web-design-guidelines · fe-e2e-testids | §8 rows 1–4                         | Claude   | done   |
| L-6 | Docs: `IMAGES`, `IMAGE_ID` overviews, the test-id inventory                              | copy       | L-5        | fe-documentation-maintenance                             | `pnpm sync:check`, `pnpm docs:lint` | Claude   | done   |
| L-7 | Verify in the running app: screenshots, the video                                        | verify     | L-5        | fe-kickoff-iteration                                     | every §8 row proven                 | Claude   | done   |
| L-8 | Gates                                                                                    | gate       | L-7        | fe-before-commit-guard                                   | §8 last row                         | Claude   | done   |
| L-9 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`, then `frozen`  | verify     | L-8        | fe-kickoff-iteration                                     | README Status `frozen`              | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                        | In plan at     |
| ---------------------- | ----------- | ---------- | --------------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | the two modes, memory, keys, rules, seven criteria, scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact           | Brief says                              | Code before says                                                      | Winner | Action    |
| --- | -------------- | --------------------------------------- | --------------------------------------------------------------------- | ------ | --------- |
| R1  | one zoom       | Linked or Separate (`:10–16`)           | `PhotoCompare.tsx`: one `usePhotoZoom(ids.join(','))` for every panel | brief  | L-4, L-5  |
| R2  | alignment      | survives the switch (`:17–19`)          | none                                                                  | brief  | L-4       |
| R3  | layout         | the picked one is remembered (`:21–22`) | `PhotoCompare.tsx`: `useState(defaultCompareLayout(ids.length))`      | brief  | L-3, L-5  |
| R4  | framings       | remembered per comparison (`:23–24`)    | none — every open starts at 100%                                      | brief  | L-3, L-5  |
| R5  | the pan's unit | a share of the panel (`:25–26`)         | `usePhotoZoom`: pixels                                                | brief  | L-4 (D10) |
| R6  | the viewer     | unchanged (`:44–45`)                    | `PhotoViewer.tsx`: `usePhotoZoom(photo.id, step)`                     | code   | L-4       |
