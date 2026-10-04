# `pages/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit` — Edit review

Route: `/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit` — a URL-driven dialog over
the patient file (KICKOFF §6.6 Drawers, D24; `S:47`). It renders the section it opened from — `?from=<section>`, Clinical notes when `from`
names none, as the schema has it — taken from the file's sections module
(`../../../patient-id.sections.ts`) through `../../../shared/hooks/usePatientFileDialog/`, and the
review drawer, prefilled, over it (`../../../shared/components/ReviewDrawer/`) — it keeps the
record's visit and day. An id that names no review goes back with "Review not found · it may
have been deleted" (`useDialogRouteRecord`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
Patients edit is `useClinicAccess` — anyone without it who follows the link lands back on the
section with the permission toast.
Registered in `src/app/routes/routeTree.tsx` as a file-level drawer route, through the
file's one lazy module (`../../../patient-id.sections.ts`).

## Files

| File                 | Responsibility                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| `edit.route.tsx`     | Route marker — exports `Component` rendering `EditReviewPage`.           |
| `edit.manifest.ts`   | Manifest — `kind: 'leaf'`, test id `review-drawer`, title "Edit review". |
| `EditReviewPage.tsx` | The section behind, and the saved review over it.                        |

## Test ids

`review-drawer` — the drawer (`docs/reference/e2e-testids-inventory.md` › Patient file feedback).
The route renders no element of its own (`tooling/validate/test-ids-allowlist.txt`).
