# `pages/organization/$organizationSlug/patients/$patientId/reports` — Reports

Route: `/organization/$organizationSlug/patients/$patientId/reports` — a section of the
patient file (KICKOFF §6.6, D26; H:4760; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: Report (the name over "PDF · shared with patient on request", or "0 files" before any lands) · Type · Date; a row opens nothing — Open shows the report, Delete asks "Delete this report?" with Undo. Its URL-driven dialogs (L-45; `S:42–43`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens them over itself: `create/`
Upload report (anyone else lands back here with the permission toast) and `$reportId/` Report
view (anyone who reads the file).

## Data (clinozy-be, api-integration §5.4)

- **Read:** `GET /app/patients/:patient_id/reports` — every page (`collectAllPages`, 100 a page,
  `sort=report_date&order=desc`), as the table shows them all; the footer's count is the
  server's `estimated_total` (`@/shared/hooks/usePatientReports/`). One report:
  `GET …/reports/:patient_report_id`.
- **Writes** (all `patient:update`): `POST …/reports` (Upload report), then a `PATCH` of
  `file_keys` per confirmed file; `DELETE …?reason=&note=` and `POST …/restore` (the toast's
  Undo).
- **Gone:** "Uploaded by" and Report view's "Added by" — the API does not say who added a report
  (G4); "Download" — no URL for a `file_key` (B1, Q4).

Gated by the file layout (membership, the `clinic-patients` module, the org status, the
section's `patient:clinical_record:read`); in-room access is `useClinicAccess` (`patient:update`
for every write). Registered in `src/app/routes/routeTree.tsx` through the file's one lazy
module (`../patient-id.sections.ts`).

## Files

| File                              | Responsibility                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reports.route.tsx`               | Route marker — exports `Component` rendering `PatientReportsPage`.                                                                                                                                   |
| `reports.manifest.ts`             | Manifest — `kind: 'layout'` (children `create`, `$reportId`), permission `organization:read`, module `clinic-patients`, title "Reports".                                                             |
| `reports.constants.ts`            | The drawers' copy keys, each type's tone, the File's types and the root test ids.                                                                                                                    |
| `PatientReportsPage.tsx`          | The section, and the dialog its URL names.                                                                                                                                                           |
| `report-file.ts`                  | A report's file formats ("PDF, JPG"), read off its `file_keys` by the view and the table.                                                                                                            |
| `hooks/useReportsTable/`          | The columns (580px): Report the primary, Type the phone key.                                                                                                                                         |
| `components/ReportDeleteConfirm/` | "Delete this report?": the report's name, the delete reasons, "Report deleted" with Undo.                                                                                                            |
| `components/ReportDrawer/`        | Upload report (560): "Report" (Type, Name) → "Details" (Date) → "Notes" (File, Note); a blank name → "Name the report"; the files go through the upload tray and attach as each is confirmed (§7.3). |
| `components/ReportView/`          | Report view (560, sky): read-only Type, Date, File ("2 files · PDF"), Notes.                                                                                                                         |
| `create/` · `$reportId/`          | The dialog routes (each renders nothing).                                                                                                                                                            |
| `__tests__/integration/`          | The tests' router (`__tests__/integration/reports-test-router.tsx`) and in-memory API (`__tests__/integration/report-api-double.ts`).                                                                |

## Test ids

`patient-section-reports` — the section's root; `patient-reports-table`, its rows and `patient-reports-row-action-<id>`; `report-drawer`, `report-view` and their parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
