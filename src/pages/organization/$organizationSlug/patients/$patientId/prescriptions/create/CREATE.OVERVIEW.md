# `pages/organization/$organizationSlug/patients/$patientId/prescriptions/create` — New prescription

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions/create` (`S:35`; KICKOFF §6.6 Drawers, D24) — New prescription — the 1040px Prescription drawer over Prescriptions.

A URL-driven dialog: the route renders nothing; the section page reads the URL (`../../shared/hooks/usePatientRecordRoute/`) and opens `PrescriptionDrawer` (`../components/PrescriptionDrawer/`) over itself. Writing a prescription is Doctor, Admin and the Owner (`S:35`); anyone else who follows the link lands back on Prescriptions with the permission toast.
Registered in `src/app/routes/routeTree.tsx` under the prescriptions route, through the file's one
lazy module (`../../patient-id.sections.ts`).

## Files

| File                      | Responsibility                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| `create.route.tsx`        | Route marker — exports `Component` rendering `NewPrescriptionPage`. |
| `create.manifest.ts`      | Manifest — `kind: 'leaf'`, test id `rx-drawer`.                     |
| `NewPrescriptionPage.tsx` | Renders nothing — the section opens the dialog.                     |

## Test ids

`rx-drawer` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
