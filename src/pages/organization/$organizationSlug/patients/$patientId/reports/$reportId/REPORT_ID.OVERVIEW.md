# `pages/organization/$organizationSlug/patients/$patientId/reports/$reportId` — Report

Route: `/organization/$organizationSlug/patients/$patientId/reports/$reportId` (`S:43`; KICKOFF §6.6 Drawers, D24) — the report viewer — Report view (560px, read only) over Reports.

A URL-driven dialog: the route renders nothing; the section page reads the URL and opens `ReportView` (`../components/ReportView/`) over itself with the report's read (`GET /app/patients/:patient_id/reports/:patient_report_id`); an id that names no report says "Report not found · it may have been deleted" and goes back. Anyone who reads the file's clinical record (`patient:clinical_record:read`) reads it. No "Download": nothing turns a stored `file_key` into a URL (B1, Q4); no "Added by": the API does not say who added a report (G4).
Registered in `src/app/routes/routeTree.tsx` under the reports route, through the file's one
lazy module (`../../patient-id.sections.ts`).

## Files

| File                    | Responsibility                                                 |
| ----------------------- | -------------------------------------------------------------- |
| `report-id.route.tsx`   | Route marker — exports `Component` rendering `ReportViewPage`. |
| `report-id.manifest.ts` | Manifest — `kind: 'leaf'`, test id `report-view`.              |
| `ReportViewPage.tsx`    | Renders nothing — the section opens the dialog.                |

## Test ids

`report-view` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
