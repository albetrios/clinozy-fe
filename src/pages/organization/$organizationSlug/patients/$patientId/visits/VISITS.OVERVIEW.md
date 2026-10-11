# `pages/organization/$organizationSlug/patients/$patientId/visits` — Visits

Route: `/organization/$organizationSlug/patients/$patientId/visits` — a section of the
patient file (KICKOFF §6.6, D26; H:4746; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the person's bookings on clinozy-be, newest first (`GET /app/appointments?contact_id=`, every page — `usePersonAppointments`, `@/shared/hooks/useAppointments/`; a prototype-only section, D26) — the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: ID · When · Offering · Doctor · Status with the status's start bar; a row opens nothing. "New appointment" opens the appointment form for this person (`who=` their contact).

Gated by the file layout (membership, the `app-patients` module, the org status); in-room
access is `useAppAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                    | Responsibility                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `visits.route.tsx`      | Route marker — exports `Component` rendering `PatientVisitsPage`.                                    |
| `visits.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-patients`, title "Visits".    |
| `PatientVisitsPage.tsx` | The section: its Columns chooser and the table of the person's bookings.                             |
| `hooks/useVisitsTable/` | The columns (760px): When the primary, Offering the phone key, the doctor's pill folding to nothing. |

## Test ids

`patient-section-visits` — the section's root; `patient-visits-table` and its rows, `patient-visits-columns-trigger` (`docs/reference/e2e-testids-inventory.md` › Patient file).
