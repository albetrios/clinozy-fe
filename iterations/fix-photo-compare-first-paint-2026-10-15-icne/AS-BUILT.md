# fix-photo-compare-first-paint-2026-10-15-icne — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Built 2026-10-15 on `feat/patient-overview-photos` (albetrios/clinozy-fe#80)
in `perf(patients): read ?compare= in the Photos page, not at start-up`.

## Rows

| #   | Ledger row | Planned                                               | Actually built                                                                                                                                                                                                                                                                                     | Difference                                                                                |
| --- | ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| #1  | L-1        | The validator stops reading `compare`; test; overview | `validatePatientImagesSearch` returns `album` and `appointment` only; `compare?: string` stays in `PatientImagesSearch` with a note that the router passes it through; `images.search.test.ts` asserts the validator leaves it; `IMAGES.OVERVIEW.md` says the page reads it                        | As planned                                                                                |
| #2  | L-2        | Gates, push, CI green                                 | The Photos family's tests (19 files / 122) and the gates pass (type-check, ESLint, Biome, `knip`, `tsdoc:check`, `docs:lint`, `sync:check`, `validate:structure`); a CI-identical build measures Initial JS 239,374 B (`main` 239,388 B, limit 239,400 B). CI on the pushed head is the merge gate | CI's own number comes from the pushed head; the pull request merges only when it is green |
| #3  | L-3        | Close                                                 | This file; Status `done`, then `frozen` in the last commit                                                                                                                                                                                                                                         | As planned                                                                                |

## Revisions to upcoming rows

None.

## Summary

- **Planned, not built:** —.
- **Planned, not kept:** —.
- **Built, not planned:** —.
- **Corrects:** `change-patient-overview-photos-2026-10-14-ysis` D19 — "`validateSearch` keeps `compare` as
  text" — now: it does not read `compare` at all (D3).
- **Follow-ups for the next iteration:** none.

## Standing deviations

From scratch there is no Baseline list to carry. Where the build differs from `BRIEF.md`: none.

| Item | The brief says | Built as | Since | Decision |
| ---- | -------------- | -------- | ----- | -------- |
| —    | —              | —        | —     | —        |
