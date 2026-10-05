# `pages/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId` — Prescription

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId` (`S:36`; KICKOFF §6.6 Drawers, D24) — the prescription viewer — its print preview (820px, the shared A4 sheet, "Print / Save PDF") over Prescriptions.

A URL-driven dialog: the route renders nothing; the section page reads the URL and opens `RxPrintPreview` (`../components/RxPrintPreview/`) over itself; an id that names no prescription says "Prescription not found · it may have been deleted" and goes back. Anyone with Patients view reads it. Its child on disk is Edit prescription (`edit`), which `src/app/routes/routeTree.tsx` registers beside it under Prescriptions.
Registered in `src/app/routes/routeTree.tsx` under the prescriptions route, through the file's one
lazy module (`../../patient-id.sections.ts`).

## Files

| File                          | Responsibility                                                          |
| ----------------------------- | ----------------------------------------------------------------------- |
| `prescription-id.route.tsx`   | Route marker — exports `Component` rendering `PrescriptionPreviewPage`. |
| `prescription-id.manifest.ts` | Manifest — `kind: 'layout'`, test id `rx-print-preview`.                |
| `PrescriptionPreviewPage.tsx` | Renders nothing — the section opens the dialog.                         |

## Test ids

`rx-print-preview` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
