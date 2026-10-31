# feat-patient-image-thumbnails-2026-10-31-tibz — as built

Baseline: none · KICKOFF.md approved 2026-10-31 ([PF6](plans/decisions.md))

## Rows

| #   | Planned                   | Actually built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Difference | Why | Decision | Commit        |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --- | -------- | ------------- |
| #1  | ROUTE 1 — the wire        | `src/core/http/openapi-types.d.ts` regenerated (`pnpm api:types`) from clinozy-be's document — the image routes gain `thumbnail_key` and `thumbnail_url` (it also carries the pharmacy fields clinozy-be's `main` gained in #182, generated alike). `patient-images-contracts.ts`: the wire reads `thumbnail_key` and `thumbnail_url`; `PatientPhoto.thumbnailUrl` = `stableFileUrl(thumbnail_key ?? file_key, thumbnail_url)`. Tests: `patient-images-api.test.ts` — the list maps the fallback (no thumbnail: the photo's link), and a read with a thumbnail maps `thumbnailUrl` to it while `fileUrl` stays the photo's | none       | —   | PF3      | (this commit) |
| #2  | ROUTE 2 — grids and tiles | `PhotoGrid` (the tile's `PhotoThumb` and its hover bar) and `bento-files` (the overview's Photos card) read `thumbnailUrl`; `PhotoViewer` and `PhotoCompare` keep `fileUrl`; the doc comments say which. Tests: `OverviewBento.test.tsx` (the card's thumb loads the thumbnail), the photo double gains `thumbnailUrl`; the patient file's suites 122 files / 921 tests green                                                                                                                                                                                                                                              | none       | —   | PF2      | (this commit) |

## Summary

- Planned, not built: none. Built, not planned: none.
- Follow-up: once clinozy-be is deployed and its backfill run, every grid shows thumbnails; until
  then a photo's `thumbnail_url` is its full photo — the screen looks as it does today.

## Standing deviations

Baseline `none` — none.

| Item | Design says | Built as | Since iteration | Decision |
| ---- | ----------- | -------- | --------------- | -------- |
| —    | —           | —        | —               | —        |
