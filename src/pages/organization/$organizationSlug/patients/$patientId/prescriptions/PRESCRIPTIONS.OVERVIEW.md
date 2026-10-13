# `pages/organization/$organizationSlug/patients/$patientId/prescriptions` — Prescriptions

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions` — a section of the
patient file (KICKOFF §6.6, D26; H:4753; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state, or the read's failure with Retry: ID · Date · Medicines (the names over their directions) · Notes (hidden) · Doctor · Status (Draft · Approved) · Updated (hidden; when only — the API names no author, G4); a row opens Edit prescription; Print, Preview, Copy prescription, Sell medicines (an approved one), Edit and Delete (a draft; "Delete this prescription?", Undo). Its URL-driven dialogs (L-45; `S:35–37`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens them over itself: `create/` and
`$prescriptionId/edit/` the Prescription drawer, `$prescriptionId/` the print preview; `create/`
takes `?medicines=` — the names the Overview's smart note recognised, each a line of the new Rx
(AMBER A-F5).

## Data — clinozy-be (api-integration §5.4)

- `GET /app/patients/:patient_id/prescriptions` (every page, `sort=prescription_date`, newest
  first), `GET …/:patient_prescription_id`, `POST`, `PATCH` (a draft, with `expected_updated_at`),
  `POST …/approve`, `DELETE` (a draft, with the confirm's reason) and `POST …/restore` (Undo) —
  `src/shared/api/app/prescriptions-api.ts`, its shapes in
  `src/shared/api/app/prescriptions-contracts.ts`, the hooks in
  `src/shared/hooks/usePrescriptions/`.
- **Draft until approved (Q19).** A member holding `patient_prescription:update` saves with
  "Save & approve" (the write, then `…/approve`); anyone else who writes (`…:create`) saves a
  draft. An approved prescription is final — read-only, no Delete — and only an approved one
  sells (a sale fills an approved Rx). Delete is `…:delete`. View-as previews by the role gate.
- **Kits:** the member's own (`GET /app/prescription-kits`) in Quick fill; a kit copies its lines.
- **Medicines:** `medicine_name` is free text. The drawer suggests the store's medicines
  (`GET /app/medicines`, `medicine:read`) with their stock, and the names the patient's own
  prescriptions carry with the patient's last line of each. No MRP until the rupee formatter
  (F10); no "Often prescribed" and no clinic-wide last dose (G4); the quick-create drafts go.
- **Print:** the browser prints the record as read (`components/RxPrintPreview/use-rx-sheet.tsx`):
  the patient from the file, the doctor from the team, the clinic from `GET /tenancy/organization`
  and the patient's home branch's phone and GSTIN from `GET /app/branches/:branch_id`
  (`branch:read` only). No server PDF, no share (§6 #26).

Gated by the file layout (membership, the `app-patients` module, the org status, the section's
`patient_prescription:read`); in-room access is `usePrescriptionAccess`. Registered in
`src/app/routes/routeTree.tsx` through the file's one lazy module (`../patient-id.sections.ts`).

## Files

| File                                                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prescriptions.route.tsx`                                | Route marker — exports `Component` rendering `PatientPrescriptionsPage`.                                                                                                                                                                                                                                                                                                                                                                                     |
| `prescriptions.manifest.ts`                              | Manifest — `kind: 'layout'` (children `create`, `$prescriptionId`), permission `organization:read`, module `app-patients`, title "Prescriptions".                                                                                                                                                                                                                                                                                                            |
| `prescriptions.constants.ts`                             | The drawer's and preview's copy keys, the status and kit tones, and root test ids.                                                                                                                                                                                                                                                                                                                                                                           |
| `PatientPrescriptionsPage.tsx`                           | The section, and the dialog its URL names: the drawer once the history, the medicines, the kits and the default doctor are read; the preview once the sheet's clinic is.                                                                                                                                                                                                                                                                                     |
| `hooks/usePrescriptionsTable/`                           | The columns (1100px): Date the primary, Medicines the phone key, Status a pill; Notes and Updated hidden; the people fold to nothing.                                                                                                                                                                                                                                                                                                                        |
| `hooks/usePrescriptionRowActions/`                       | A row's actions behind their gates: Print (the A4 sheet straight to the printer), Preview, Copy prescription (today's draft), Sell medicines (an approved one — New sale on the Rx and its patient, `?prescription=&customer=`, the section behind it), Edit and Delete (a draft).                                                                                                                                                                           |
| `components/PrescriptionDrawer/`                         | The 1040px drawer: "Prescription" (Date, Doctor — the team) → "Medicines" (the quick line + Browse on the shared `QuickLine`, the Rx parser `components/PrescriptionDrawer/rx-quick-line.ts`, the medicines table) → "Clinical notes"; Quick fill Print / Repeat last / the member's kits; "Save & approve" or a draft's save, the server's field errors on their rows, Reload on a stale save; "Save & sell" (New sale on the approved Rx and its patient). |
| `components/RxPrintPreview/`                             | The print preview: an 820px panel holding the shared A4 sheet (`PrescriptionPrint`), fitted to its width; "Print / Save PDF" — and `components/RxPrintPreview/use-rx-sheet.tsx`, the sheet's parts and the print.                                                                                                                                                                                                                                            |
| `create/` · `$prescriptionId/` · `$prescriptionId/edit/` | The dialog routes (each renders nothing).                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `__tests__/integration/`                                 | `__tests__/integration/prescription-doubles.ts` (records and an in-memory stand-in for the prescriptions API) and `__tests__/integration/prescriptions-test-router.tsx` (the section with its dialog routes) for this island's suites.                                                                                                                                                                                                                       |

## Test ids

`patient-section-prescriptions` — the section's root; `patient-prescriptions-table`, its rows and `patient-prescriptions-row-action-<id>`; `rx-drawer`, `rx-drawer-approved` (an approved one's note), `rx-drawer-quick-fill-kit-<kit id>`, `rx-print-preview` and their parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
