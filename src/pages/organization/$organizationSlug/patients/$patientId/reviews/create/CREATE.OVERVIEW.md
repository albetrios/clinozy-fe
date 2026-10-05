# `pages/organization/$organizationSlug/patients/$patientId/reviews/create` — Log a review

Route: `/organization/$organizationSlug/patients/$patientId/reviews/create` — a URL-driven dialog over
the patient file (KICKOFF §6.6 Drawers, D24; `S:46`). It renders the section it opened from — `?from=<section>`, Clinical notes when `from`
names none, as the schema has it — taken from the file's sections module
(`../../patient-id.sections.ts`) through `../../shared/hooks/usePatientFileDialog/`, and the
family-shared review drawer over it (`../../shared/components/ReviewDrawer/`), on the source
`?source=` names (Google when none) and tied to the visit `?appointment=` names. Saving or
closing goes back to that section. The params are parsed by `validatePatientFeedbackSearch`
in `../../patient-id.dialog-search.ts`.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
Patients edit is `useClinicAccess` — anyone without it who follows the link lands back on the
section with the permission toast.
Registered in `src/app/routes/routeTree.tsx` as a file-level drawer route, through the
file's one lazy module (`../../patient-id.sections.ts`).

## Files

| File                 | Responsibility                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewReviewPage`.             |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, test id `review-drawer`, title "Log a review". |
| `NewReviewPage.tsx`  | The section behind, and a new review over it.                             |

## Test ids

`review-drawer` — the drawer (`docs/reference/e2e-testids-inventory.md` › Patient file feedback).
The route renders no element of its own (`tooling/validate/test-ids-allowlist.txt`).
