# `pages/organization/$organizationSlug/patients/$patientId/prescriptions` — Prescriptions

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions` — a section of the
patient file (KICKOFF §6.6, D26; H:4753; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: ID · Date · Medicines (the names over their directions) · Notes (hidden) · Doctor · Updated (hidden); a row opens Edit prescription; Print, Preview, Copy prescription, Sell medicines, Edit and Delete ("Delete this prescription?", Undo). Its URL-driven dialogs (L-45; `S:35–37`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens them over itself: `create/` and
`$prescriptionId/edit/` the Prescription drawer, `$prescriptionId/` the print preview. Writing one
is the Doctor and Admin gate (`S:35, 37`; the Owner always passes) — anyone else following a create
link lands back here with the permission toast, and reads an edit view only.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                                                     | Responsibility                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prescriptions.route.tsx`                                | Route marker — exports `Component` rendering `PatientPrescriptionsPage`.                                                                                                                                                                                                                                                                               |
| `prescriptions.manifest.ts`                              | Manifest — `kind: 'layout'` (children `create`, `$prescriptionId`), permission `organization:read`, module `clinic-patients`, title "Prescriptions".                                                                                                                                                                                                   |
| `prescriptions.constants.ts`                             | The drawer's and preview's copy keys and root test ids.                                                                                                                                                                                                                                                                                                |
| `PatientPrescriptionsPage.tsx`                           | The section, and the dialog its URL names: the drawer once the history, catalog and default doctor are read; the preview once the sheet's context is.                                                                                                                                                                                                  |
| `hooks/usePrescriptionsTable/`                           | The columns (1100px): Date the primary, Medicines the phone key; Notes and Updated hidden; the people fold to nothing.                                                                                                                                                                                                                                 |
| `hooks/usePrescriptionRowActions/`                       | A row's actions behind their gates: Print (the A4 sheet straight to the printer), Preview, Copy prescription (today's copy), Sell medicines (the sale with the Rx, the section behind it), Edit, Delete.                                                                                                                                               |
| `components/PrescriptionDrawer/`                         | The 1040px drawer: "Prescription" (Date, Doctor) → "Medicines" (the quick line + Browse on the shared `QuickLine`, the Rx parser `components/PrescriptionDrawer/rx-quick-line.ts`, the medicines table) → "Clinical notes"; Quick fill Print / Repeat last / the three kits; "Save & sell" hands the saved Rx to `medical/sales/create?prescription=`. |
| `components/RxPrintPreview/`                             | The print preview: an 820px panel holding the shared A4 sheet (`PrescriptionPrint`), fitted to its width; "Print / Save PDF".                                                                                                                                                                                                                          |
| `create/` · `$prescriptionId/` · `$prescriptionId/edit/` | The dialog routes (each renders nothing).                                                                                                                                                                                                                                                                                                              |

## Test ids

`patient-section-prescriptions` — the section's root; `patient-prescriptions-table`, its rows and `patient-prescriptions-row-action-<id>`; `rx-drawer`, `rx-print-preview` and their parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
