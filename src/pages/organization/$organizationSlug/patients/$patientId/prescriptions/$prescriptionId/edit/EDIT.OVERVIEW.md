# `pages/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId/edit` — Edit prescription

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId/edit` (`S:37`; KICKOFF §6.6 Drawers, D24) — Edit prescription — the Prescription drawer over Prescriptions.

A URL-driven dialog: the route renders nothing; the section page reads the URL and opens `PrescriptionDrawer` (`../../components/PrescriptionDrawer/`) with the prescription. Doctor, Admin and the Owner edit it (`S:37`); anyone else reads it ("View only · your role can’t change this").
Registered in `src/app/routes/routeTree.tsx` under the prescriptions route, through the file's one
lazy module (`../../../patient-id.sections.ts`).

## Files

| File                       | Responsibility                                                       |
| -------------------------- | -------------------------------------------------------------------- |
| `edit.route.tsx`           | Route marker — exports `Component` rendering `EditPrescriptionPage`. |
| `edit.manifest.ts`         | Manifest — `kind: 'leaf'`, test id `rx-drawer`.                      |
| `EditPrescriptionPage.tsx` | Renders nothing — the section opens the dialog.                      |

## Test ids

`rx-drawer` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
