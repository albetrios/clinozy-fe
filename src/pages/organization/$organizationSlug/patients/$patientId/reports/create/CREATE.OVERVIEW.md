# `pages/organization/$organizationSlug/patients/$patientId/reports/create` — Upload report

Route: `/organization/$organizationSlug/patients/$patientId/reports/create` (`S:42`; KICKOFF §6.6 Drawers, D24) — Upload report — the 560px Report drawer over Reports.

A URL-driven dialog: the route renders nothing; the section page reads the URL (`../../shared/hooks/usePatientRecordRoute/`) and opens `ReportDrawer` (`../components/ReportDrawer/`) over itself. Uploading needs Patients edit (`S:42`); anyone else who follows the link lands back on Reports with the permission toast.
Registered in `src/app/routes/routeTree.tsx` under the reports route, through the file's one
lazy module (`../../patient-id.sections.ts`).

## Files

| File                   | Responsibility                                                   |
| ---------------------- | ---------------------------------------------------------------- |
| `create.route.tsx`     | Route marker — exports `Component` rendering `UploadReportPage`. |
| `create.manifest.ts`   | Manifest — `kind: 'leaf'`, test id `report-drawer`.              |
| `UploadReportPage.tsx` | Renders nothing — the section opens the dialog.                  |

## Test ids

`report-drawer` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
