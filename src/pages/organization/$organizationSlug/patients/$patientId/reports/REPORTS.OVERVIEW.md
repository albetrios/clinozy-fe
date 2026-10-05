# `pages/organization/$organizationSlug/patients/$patientId/reports` — Reports

Route: `/organization/$organizationSlug/patients/$patientId/reports` — a section of the
patient file (KICKOFF §6.6, D26; H:4760; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the table lands with L-43b. Its URL-driven dialogs (L-45; `S:42–43`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens them over itself: `create/`
Upload report (Patients edit; anyone else lands back here with the permission toast) and
`$reportId/` Report view (anyone who reads the file).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                       | Responsibility                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reports.route.tsx`        | Route marker — exports `Component` rendering `PatientReportsPage`.                                                                                                                                   |
| `reports.manifest.ts`      | Manifest — `kind: 'layout'` (children `create`, `$reportId`), permission `organization:read`, module `clinic-patients`, title "Reports".                                                             |
| `reports.constants.ts`     | The drawers' copy keys, each type's tone, the File's types and the root test ids.                                                                                                                    |
| `PatientReportsPage.tsx`   | The section, and the dialog its URL names.                                                                                                                                                           |
| `components/ReportDrawer/` | Upload report (560): "Report" (Type, Name) → "Details" (Date) → "Notes" (File, Note); a blank name → "Name the report"; the files go through the upload tray and attach as each is confirmed (§7.3). |
| `components/ReportView/`   | Report view (560, sky): read-only Type, Date, Added by, File, Notes; "Download" → "Downloading <name>".                                                                                              |
| `create/` · `$reportId/`   | The dialog routes (each renders nothing).                                                                                                                                                            |

## Test ids

`patient-section-reports` — the section's root; `report-drawer`, `report-view` and their parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
