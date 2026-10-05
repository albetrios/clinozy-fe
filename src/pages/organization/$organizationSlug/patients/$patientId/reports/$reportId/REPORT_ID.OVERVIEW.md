# `pages/organization/$organizationSlug/patients/$patientId/reports/$reportId` — Report

Route: `/organization/$organizationSlug/patients/$patientId/reports/$reportId` (`S:43`; KICKOFF §6.6 Drawers, D24) — the report viewer — Report view (560px, read only, "Download") over Reports.

A URL-driven dialog: the route renders nothing; the section page reads the URL and opens `ReportView` (`../components/ReportView/`) over itself; an id that names no report says "Report not found · it may have been deleted" and goes back. Anyone with Patients view reads it.
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
