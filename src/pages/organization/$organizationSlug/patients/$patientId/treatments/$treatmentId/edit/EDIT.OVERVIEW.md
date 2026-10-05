# `pages/organization/$organizationSlug/patients/$patientId/treatments/$treatmentId/edit` — Edit treatment

Route: `/organization/$organizationSlug/patients/$patientId/treatments/$treatmentId/edit` (`S:39`; KICKOFF §6.6 Drawers, D24) — Edit treatment — the Treatment drawer over Treatments (show = edit).

A URL-driven dialog: the route renders nothing; the section page reads the URL and opens `TreatmentDrawer` (`../../components/TreatmentDrawer/`) with the treatment and its check-ins. Doctor, Therapist and the Owner edit it (`S:39`); anyone else reads it.
Registered in `src/app/routes/routeTree.tsx` under the treatments route, through the file's one
lazy module (`../../../patient-id.sections.ts`).

## Files

| File                    | Responsibility                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `edit.route.tsx`        | Route marker — exports `Component` rendering `EditTreatmentPage`. |
| `edit.manifest.ts`      | Manifest — `kind: 'leaf'`, test id `treatment-drawer`.            |
| `EditTreatmentPage.tsx` | Renders nothing — the section opens the dialog.                   |

## Test ids

`treatment-drawer` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
