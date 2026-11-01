# feat-patient-image-thumbnails-2026-10-31-tibz — kickoff

## 1. Header

| Field     | Value                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Iteration | `feat-patient-image-thumbnails-2026-10-31-tibz`                                                        |
| Type      | feat                                                                                                   |
| Baseline  | none ([PF1](plans/decisions.md))                                                                       |
| Intake    | `brief` — `BRIEF.md`, Intake hash `11e6cc3b770e` ([PF1](plans/decisions.md))                           |
| Branch    | `feat/patient-image-thumbnails`                                                                        |
| Sibling   | clinozy-be's same-named iteration — the thumbnail job, `thumbnail_key`, `thumbnail_url` (its `plans/`) |

## 2. Goal and scope

Photo grids download full-size photos (up to 15 MB each). clinozy-be now answers each photo with
`thumbnail_url` — a 320 px WebP, or the full photo's link until the background job makes one. Here
the grids and tiles show `thumbnail_url`; an opened photo keeps `file_url`.

In scope: the photo wire and model (`patient-images-contracts.ts`), the regenerated API types, the
Photos grid and the overview's Photos card, their tests. Out of scope: the viewer and the compare
view (they stay full size — [PF2](plans/decisions.md)), any layout change.

## 3. ROUTE

| #   | Work item                                                                                       | Kind | Depends on | Skill/driver                         | Acceptance     | Assignee | Status |
| --- | ----------------------------------------------------------------------------------------------- | ---- | ---------- | ------------------------------------ | -------------- | -------- | ------ |
| 1   | The wire: `thumbnail_key`, `thumbnail_url` → `PatientPhoto.thumbnailUrl`; API types regenerated | code | —          | fe-api-contracts, fe-test-generation | § 4 lines 1, 3 | Claude   | done   |
| 2   | Grids and tiles show `thumbnailUrl`; the viewer and compare keep `fileUrl`                      | code | 1          | fe-test-generation                   | § 4 line 2     | Claude   | done   |

## 4. Definition of done

1. A photo read maps `thumbnail_url` to `thumbnailUrl` (the thumbnail's link once it exists, the
   photo's before), `file_url` to `fileUrl` unchanged.
2. The Photos grid tile and the overview's Photos card load `thumbnailUrl`; the viewer and the
   compare view load `fileUrl`.
3. `pnpm health` green; `pnpm api:types:check` in sync with clinozy-be's OpenAPI document.
