# KICKOFF — change-patient-overview-photos-2026-10-14-ysis

> The plan and the ordered ledger for a change from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-patient-overview-photos-2026-10-14-ysis`                                     |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D3](plans/decisions.md))              |
| Intake hash       | `cf9ea77fc01d` (gate passed 2026-10-14)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the Overview and Photos    |
| Date              | 2026-10-14                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…` in the code                            |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D4](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Type `change`.
2. **D2** — Baseline `none`; the current code is the truth for what is touched.
3. **D3** — Intake mode `brief`.
4. **D4** — clinozy-fe only; no sibling.
5. **D5** — Branch `feat/patient-overview-photos`; pushed, no PR until the user confirms.
6. **D6** — "Overview" is the `timeline` section; Clinical notes (`overview`) is not reshaped.
7. **D7** — Selection and comparison (2–8) are in scope, added by the user mid-request.
8. **D8** — Approved on the user's one-pass request; their review of the push and artifacts is the checkpoint.
9. **D9** — The Overview in fixed rows, every card in a row one height.
10. **D10** — Empty Overview cards: a dashed slot in the section's tone, the add action on it.
11. **D11** — The comparison is `?compare=<ids>` on the Photos URL, a dialog of the Photos page.
12. **D12** — `usePhotoZoom` and the viewer chrome move to the Photos family's `shared/`.
13. **D13** — Compare order: taken-on, oldest first; "Start" then "+N days".
14. **D14** — Paste: image files only, not in a field, not under a dialog, writers only.
15. **D15** — "Take photo": a `capture="environment"` input, touch devices only.
16. **D16** — The empty album becomes the drop zone with "Choose photos".
17. **D17** — Synthetic demo photos, uploaded locally for the screenshots and the video.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. Tones via `TONE_CLASSES` (`surface`, `fill`, `ring`), the neutrals
(`bg-card`, `bg-canvas`, `bg-muted`, `border-border-strong`), `primary` for selection, the viewer's
dark chrome (`bg-overlay/94`, `text-canvas`, `data-surface="light-pinned"`). Named radius steps; every
`rounded-full` surface carries `data-slot="pill"`.

### 3.2 Shell

Untouched. The file layout renders one more hidden input (the camera's) beside the picker.

### 3.3 Stores

None. Selection is page state (`useState` in a page hook); the comparison is URL state.

### 3.4 Icons

From `@/shared/icons/index.ts`; any export the registry lacks (a check-circle, a grid / columns
glyph, an image-plus) is added there as a named re-export.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                            | Kind               | Change                                                                                   |
| ------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `…/$patientId/timeline/components/OverviewBento/`                               | page units         | rows layout, card frame `h-full`, dashed empty slot, Clinical panels, Photos upload card |
| `…/$patientId/images/images.search.ts`                                          | URL state          | `compare` (2–8 public ids)                                                               |
| `…/$patientId/images/PatientImagesPage.tsx`                                     | page               | upload strip, drop veil, paste, selection, compare dialog                                |
| `…/$patientId/images/components/PhotoGrid/`                                     | page unit          | days flow inline; select mode; check circle                                              |
| `…/$patientId/images/components/PhotoToolbar/`                                  | page unit          | "Select" / "Done"                                                                        |
| `…/$patientId/images/components/PhotoUploadZone/` (new)                         | page unit          | the strip and the empty drop zone                                                        |
| `…/$patientId/images/components/PhotoSelectionBar/` (new)                       | page unit          | count, hint, Clear, Compare                                                              |
| `…/$patientId/images/components/PhotoCompare/` (new)                            | page unit (dialog) | the comparison                                                                           |
| `…/$patientId/images/hooks/usePhotoSelection/` (new)                            | page hook          | the selection (≤ 8)                                                                      |
| `…/$patientId/images/shared/photo-compare.ts` (new)                             | family module      | order, "+N days", columns per layout                                                     |
| `…/$patientId/images/shared/hooks/usePhotoZoom/` (moved from `$imageId/hooks/`) | family hook        | unchanged behaviour; the viewer and the comparison                                       |
| `…/$patientId/images/shared/components/PhotoChrome/` (new, from `PhotoViewer`)  | family unit        | the round button and the zoom group                                                      |
| `…/$patientId/shared/hooks/usePatientPhotoUpload/`                              | family hook        | `capture` + the camera input                                                             |
| `…/$patientId/shared/hooks/usePhotoPaste/` (new)                                | family hook        | the paste listener                                                                       |

## 5. State management map

| Surface              | Server state                                      | Client state                         | URL state             | Form state |
| -------------------- | ------------------------------------------------- | ------------------------------------ | --------------------- | ---------- |
| Overview rows        | the cards' existing Query hooks                   | —                                    | —                     | —          |
| Overview Photos card | `usePatientPhotos` (limit 8)                      | drag-over flag                       | —                     | —          |
| Photos upload        | the upload tray (`useUploadQueue`) → invalidation | drag-over flag                       | `?album` (the target) | —          |
| Selection            | photos as read                                    | `usePhotoSelection` (ids → photo)    | —                     | —          |
| Comparison           | `usePatientPhoto` per id (list pages stand in)    | shared zoom (`usePhotoZoom`), layout | `?compare=` (2–8 ids) | —          |

No API data enters a store; the comparison is shareable because its photos are in the URL.

## 6. Per-screen build notes

### 6.1 Overview rows — `frontend-design`, `web-design-guidelines`, `fe-test-generation`

```text
CONTENT COLUMN ≥ 1180px
┌────────────────────────────── Clinical (smart note · 4 list panels) ───────────────────────────┐
├──────── Visits ────────┬────── Treatments ──────┬─────── Packages ───────┬──── Prescriptions ───┤  one height
├──────────────── Photos (2/3: Add tile + 7 thumbs) ──────────────┬───────── Reports (1/3) ───────┤  one height
├──────────────────────── Billing ─────────────────┬───────────────── Team notes ────────────────┤  one height
└──────────────────────────────────────── Activity timeline ──────────────────────────────────────┘
560–1179px: Care 2 × 2 · Photos / Reports stacked below 900px · Billing | Notes from 640px
< 560px: one column, the same order
```

- Rows are separate grids (`items-stretch`), `gap-3`, `gap-3` between rows; the card is `h-full`
  and its body `flex-1` so an empty slot fills what is left (`BRIEF.md:5–15`).
- Clinical: four panels (`bg-canvas`, `rounded-lg`, `p-2.5`) — dot, name, count; chips wrap to two
  lines (`line-clamp-2`), "Nothing added yet" when empty; 1 / 2 (≥ 480px) / 4 (≥ 860px) columns.
- Empty slot (`BRIEF.md:16–18`): dashed `border-border-strong`, `rounded-lg`, `min-h-24`, centred
  32px tone tile + the existing empty line; a button when the card has its add (Visits → Book,
  Prescriptions / Treatments / Reports → their "New …", Photos → the picker), else a `div`.
  Test id `<card>-empty` kept.

### 6.2 Overview Photos card — `fe-resilient-interactions`

- Writer: first tile "Add photos" (dashed, `ImagePlus`), then up to 7 thumbs (8 without the tile).
- Drag over the card → dashed primary outline + `bg-primary/5`; drop → `photos.upload(files, 'general')`.
- No photos: the whole body is the drop zone (`BRIEF.md:21–22`), a button opening the picker.
- Paste on the Overview (`usePhotoPaste`, D14) uploads to General.

### 6.3 Photos upload — `fe-resilient-interactions`, `web-design-guidelines`

- `PhotoUploadZone variant="strip"` above the grid (writers): icon · "Drop photos here" · "or paste
  a copied image · Adds to General" · [Take photo] (coarse pointer) · [Choose photos].
- `variant="empty"`: the empty album — the Photos blush art, "No photos in General yet", the same
  line and buttons, larger; replaces `PhotosEmpty` for writers (readers keep the empty state).
- Drag veil: `drop.over` → an absolutely placed layer inside the section with "Drop to add to
  General" (pointer-events none), the existing outline kept.
- Paste: `usePhotoPaste(enabled, files => uploads.upload(files, album))`.

### 6.4 Photos grid — `frontend-design`

- Days: `flex flex-wrap gap-x-6 gap-y-4`; a day `max-w-full`, its tiles `flex flex-wrap` at the size's
  fixed tile width (S 6.875rem / M 10rem / L 14.375rem) and gap (`PHOTO_SIZE_LOOK`).
- Select mode (`selecting`): the tile button toggles (`aria-pressed`), the caption's Edit / Delete
  hide; selected → `ring-2 ring-primary ring-offset-2`, the check circle filled `bg-primary`.
- Check circle (top-end, 24px, `data-slot="pill"`): hover / focus-within when not selecting, always
  while selecting; disabled look at the limit for unselected tiles.

### 6.5 Selection — `fe-test-generation`

- `usePhotoSelection()`: `Map<id, PatientPhoto>` in pick order; `toggle(photo)` refuses the 9th with
  `notify.info("You can compare up to 8 photos at a time")`; `clear()`; `active` flag; Esc leaves.
- `PhotoSelectionBar`: sticky bottom inside the section scroller, `bg-card` with border and shadow,
  `rounded-xl`; "3 selected" · hint "Pick 2 to 8 photos to compare" · Clear · Compare (disabled < 2).

### 6.6 Comparison — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

```text
┌ Compare photos · 4 photos ──────────── [One row | Grid] [− 100% +] (×) ┐  3.5rem bar
│ ┌ 1 · 23 Jul ──┐ ┌ 2 · 13 Aug ──┐ ┌ 3 · 3 Sep ───┐ ┌ 4 · 15 Oct ──┐   │
│ │   photo      │ │   photo      │ │   photo      │ │   photo      │   │  shared zoom/pan
│ │ name  Start  │ │ name +21 days│ │ name +42 days│ │ name +84 days│   │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
└ Scroll or pinch to zoom every photo · Drag to move them together · Esc ┘  3rem hints
```

- Radix Dialog, `fixed inset-0 z-[96] bg-overlay/94`, like the viewer; no outside close; Esc closes.
- Columns: One row → n; Grid → 2 (n ≤ 4), 3 (n ≤ 6), 4 (n ≤ 8); default One row up to 4, Grid from
  5; phone → 2. Layout radios hidden for 2 photos.
- One `usePhotoZoom(key)` for all panels: each panel spreads `zoom.stage`; transforms identical.
- Panel: `figure` `rounded-lg bg-canvas/8 overflow-hidden`, the photo `fit="contain"`; index + day
  chip top-start; × top-end (n > 2); caption: name, pills, "Start" / "+N days".
- Close: `navigate({ to: '.', search: { …, compare: undefined }, hash: true })`.

## 7. Deviations

### 7.1 Brief over the current code

- The Overview's dense auto-placed grid (`grid-flow-row-dense`, `items-start`) becomes fixed rows.
- The bento empty states lose their art (D10); the empty album gains buttons (D16).
- "Compare is not built" (the Photos card's note, H:4766) — built now, as a comparison of the
  selection rather than the prototype's unrendered mode.

### 7.2 Project rules over the brief

- Semantic tokens, named radii, `data-slot="pill"`, logical properties (`start`/`end`, `ps`/`pe`).
- Every string an i18n key in all 11 locales (`pnpm validate:i18n-parity`).
- The zoom and the chrome are reused, not rebuilt (D12).

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                           | Proof                                                                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rows share one height, no gaps (`:78`)           | screenshots 1440 (Activity open and closed) · 390; `OverviewBento` tests                                                                                                      |
| empty slot, runs its add (`:79`)                 | `OverviewBento` / `bento-card` tests; screenshot                                                                                                                              |
| Overview Add photos / drop (`:80`)               | `PhotosBentoCard` tests; the video                                                                                                                                            |
| upload strip, choose, drop, paste (`:81–82`)     | `PhotoUploadZone`, `PatientImagesPage`, `usePhotoPaste` tests; the video                                                                                                      |
| single-photo days side by side (`:83`)           | screenshot; `PhotoGrid` test                                                                                                                                                  |
| select, count, the ninth refused (`:84`)         | `usePhotoSelection`, `PatientImagesPage` tests; the video                                                                                                                     |
| `?compare=` 2–8, oldest first, "+N days" (`:85`) | `images.search`, `photo-compare`, `PhotoCompare` tests; screenshots 2/4/8                                                                                                     |
| shared zoom/pan, ×, Esc (`:86`)                  | `PhotoCompare` tests; the video                                                                                                                                               |
| One row ↔ Grid; phone two columns (`:87`)        | `photo-compare` tests; screenshots 1440 · 390                                                                                                                                 |
| existing tests pass (`:88`)                      | `pnpm test`                                                                                                                                                                   |
| gates                                            | `pnpm type-check && pnpm lint && pnpm biome:check && pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm sync:check` |

## 9. The route — the ordered ledger

| #    | Work item                                                                               | Kind       | Depends on | Skill/driver                                             | Acceptance                          | Assignee | Status |
| ---- | --------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------- | ----------------------------------- | -------- | ------ |
| L-1  | Icons the change needs, in the registry                                                 | foundation | —          | fe-code-structure                                        | `pnpm type-check`                   | Claude   | open   |
| L-2  | Copy: the new `patient-file` keys in 11 locales + the constants                         | copy       | —          | fe-i18n-constants                                        | i18n parity                         | Claude   | open   |
| L-3  | Promote `usePhotoZoom` and the viewer chrome to the Photos family's `shared/`           | structural | —          | fe-component-promotion                                   | viewer tests unchanged              | Claude   | open   |
| L-4  | Overview rows, card frame, dashed empty slot, Clinical panels                           | structural | L-2        | frontend-design · fe-test-generation                     | §8 rows 1–2                         | Claude   | open   |
| L-5  | Upload plumbing: camera input (`capture`), `usePhotoPaste`                              | global     | L-2        | fe-resilient-interactions · fe-test-generation           | hook tests                          | Claude   | open   |
| L-6  | Overview Photos card as an upload target                                                | structural | L-4, L-5   | frontend-design · fe-test-generation                     | §8 row 3                            | Claude   | open   |
| L-7  | Photos: upload strip, empty drop zone, drag veil, paste                                 | structural | L-5        | frontend-design · web-design-guidelines                  | §8 row 4                            | Claude   | open   |
| L-8  | Photos grid: inline days, select mode, check circle; toolbar Select                     | structural | L-2        | frontend-design · fe-e2e-testids                         | §8 rows 5–6                         | Claude   | open   |
| L-9  | Selection hook + bar; `?compare=` in `images.search.ts`; `photo-compare.ts`             | structural | L-8        | fe-routing-tenancy · fe-test-generation                  | §8 rows 6–7                         | Claude   | open   |
| L-10 | The comparison dialog                                                                   | screen     | L-3, L-9   | frontend-design · web-design-guidelines · fe-e2e-testids | §8 rows 7–9                         | Claude   | open   |
| L-11 | Docs: `TIMELINE`, `IMAGES`, `IMAGE_ID` overviews, the test-id inventory                 | copy       | L-4–L-10   | fe-documentation-maintenance                             | `pnpm sync:check`, `pnpm docs:lint` | Claude   | open   |
| L-12 | Verify in the running app: screenshots 1440 / 390, the video                            | verify     | L-4–L-10   | fe-kickoff-iteration                                     | every §8 row proven                 | Claude   | open   |
| L-13 | Gates                                                                                   | gate       | L-12       | fe-before-commit-guard                                   | §8 last row                         | Claude   | open   |
| L-14 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`, then `frozen` | verify     | L-13       | fe-kickoff-iteration                                     | README Status `frozen`              | Claude   | open   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                | In plan at     |
| ---------------------- | ----------- | ---------- | ------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | six changes, rules, eleven criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact                | Brief says                                       | Code before says                                                                   | Winner | Action      |
| --- | ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------ | ----------- |
| R1  | Overview grid       | fixed rows, one height a row (`:5–15`)           | `OverviewBento.tsx`: one dense grid, `items-start`, wide cards spanning 2          | brief  | L-4         |
| R2  | empty cards         | dashed slot, no art (`:16–18`)                   | `bento-card.tsx` `BentoEmpty` → `EmptyState variant="compact"` with 48px art       | brief  | L-4 (D10)   |
| R3  | Clinical lists      | panels, chips wrap (`:7–9`)                      | `bento-clinical.tsx`: `TonePill … truncate`, "—" when empty                        | brief  | L-4         |
| R4  | Overview Photos     | add tile, drop, paste (`:19–22`)                 | `bento-files.tsx`: "Upload" button only                                            | brief  | L-6         |
| R5  | Photos upload       | strip, drop zone, veil, paste, camera (`:23–29`) | `PatientImagesPage.tsx`: header "Upload images", section drop with an outline only | brief  | L-5, L-7    |
| R6  | day groups          | flow inline (`:30–31`)                           | `PhotoGrid.tsx`: one section per day, a full-width grid each                       | brief  | L-8         |
| R7  | selection / compare | 2–8, shared zoom (`:32–46`)                      | none; `PhotosBentoCard` notes "Compare is not built"                               | brief  | L-8–L-10    |
| R8  | the viewer's zoom   | shared zoom (`:43–45`)                           | `$imageId/hooks/usePhotoZoom` — one photo                                          | code   | reused, L-3 |
