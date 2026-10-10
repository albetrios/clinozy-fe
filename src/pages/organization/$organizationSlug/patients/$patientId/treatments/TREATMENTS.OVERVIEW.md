# `pages/organization/$organizationSlug/patients/$patientId/treatments` — Treatments

Route: `/organization/$organizationSlug/patients/$patientId/treatments` — a section of the
patient file (KICKOFF §6.6, D26; H:4757; `patient-file.md:34–46`), on clinozy-be
(`/app/patients/:patient_id/treatments`, api-integration §5.4). It renders in the file layout's
content column through the family's section frame (`../shared/components/PatientSection/`) — its
title and, when the member may add one, the split "New …" + "⌄"; the section's table (L-43b) on
the family's `../shared/components/PatientSectionTable/` — the shared data table with selection
and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and
"All … loaded", the section's empty state, or "Could not load data." with "Try again" when the read fails:
Treatment (the name over its template; struck through once reversed) · Area · Team (hidden) ·
Session · Details (hidden) · Feedback (the server's `latest_check_in`, else the call still owed;
"Reversed" with its reason on hover) · Date — no ID, a treatment has no number (N1). A row opens
Edit treatment; its actions are Check-in (over the section), Copy as next session, Edit and
Reverse. Its URL-driven dialogs (L-45; `S:38–39`) render nothing — the section reads the URL
(`../shared/hooks/usePatientRecordRoute/`) and opens the Treatment drawer over itself:
`create/` and `$treatmentId/edit/` (show is edit).

## Data

| Read / write                  | Route                                                                                    | Where                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| The sessions (every page)     | `GET …/treatments?sort=performed_at&order=desc`                                          | the table, the drawer's last session    |
| One session (the edit's read) | `GET …/treatments/:patient_treatment_id`                                                 | `usePatientRecordRoute`, a stale reload |
| "Feedback on this treatment"  | `GET …/check-ins?patient_treatment_id=` (one read for the open drawer)                   | `useTreatmentFeedback`                  |
| The patient's packages        | `GET …/offerings?is_package=true` (`usePatientPackages`)                                 | "From package", Quick fill, Copy        |
| The name chips                | `GET /app/offerings?category=treatment&is_active=true` (`useBookableTreatments`)         | the drawer's first four                 |
| Record / Copy as next session | `POST …/treatments` — on a package `patient_offering_id`, the server numbers it          | `useCreateTreatment`                    |
| Save changes                  | `PATCH …/treatments/:id` with `expected_updated_at` (a package session keeps its number) | `useUpdateTreatment`                    |
| Reverse                       | `POST …/treatments/:id/reverse {reason}` — the row stays, the session comes back         | `useReverseTreatment`                   |

The server spends and gives back package sessions and counts them (§6 #20, §7); the section
counts nothing. The design's Delete with Undo is Reverse — final, so its toast has no Undo (Q7).

## Gates

Read is the file's (`patient_treatment:read`, the layout's section gate). Recording one is
`patient_treatment:create`; changing or reversing one is `patient_treatment:update`; a check-in is
Patients Edit (`patient:update`). A View-as preview reads the role's gate (Doctor, Therapist, the
Owner). A reversed session reads only. Registered in `src/app/routes/routeTree.tsx` through the
file's one lazy module (`../patient-id.sections.ts`).

## Files

| File                             | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `treatments.route.tsx`           | Route marker — exports `Component` rendering `PatientTreatmentsPage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `treatments.manifest.ts`         | Manifest — `kind: 'layout'` (children `create`, `$treatmentId`), permission `organization:read`, module `clinic-patients`, title "Treatments".                                                                                                                                                                                                                                                                                                                                                                                                               |
| `treatments.constants.ts`        | The drawer's copy keys (the package and the reverse among them) and root test id.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PatientTreatmentsPage.tsx`      | The section and its gates, and the drawer its URL names — once the sessions, the packages and the default doctor and therapist are read.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `hooks/useTreatmentsTable/`      | The columns (1260px): Treatment the primary, Area the phone key (dental teeth "#11"), Details from the drawer's own template words, Feedback "Better · 7/10", "Call next day" or "Reversed".                                                                                                                                                                                                                                                                                                                                                                 |
| `hooks/useTreatmentRowActions/`  | A row's actions behind their gates: Check-in (`check-ins/create?treatment=`), Copy as next session (on its package while it can spend one; "Session 2 added" with the server's number), Edit, Reverse; none on a reversed session.                                                                                                                                                                                                                                                                                                                           |
| `components/TreatmentDrawer/`    | The 680px drawer: the Type switch, "Session" (with "From package") → "<template> details" (Skin · laser, Dental with FDI teeth, Physio, Gynac, General) → "Aftercare"; Quick fill "Log check-in" (edit, stacked check-in drawer), "Next session of …" (new) and one chip per package; the server's field errors on their fields; "Treatment saved"; Reverse — `components/TreatmentDrawer/treatment-reverse-confirm.tsx`, "Reverse this treatment?" with its reasons (Recorded by mistake · Wrong patient · Session not done · Other), "Treatment reversed". |
| `__tests__/integration/`         | The section's test router (`renderTreatments`, `renderInTreatments`) and its doubles: a session, a package, the team and an in-memory server.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `create/` · `$treatmentId/edit/` | The dialog routes (each renders nothing).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Test ids

`patient-section-treatments` — the section's root; `patient-treatments-table`, its rows and
`patient-treatments-row-action-<id>` (`check-in` · `copy` · `edit` · `reverse`); `treatment-drawer`
and its parts — `-package` ("From package"), `-session-numbered`, `-reverse` (the footer's
Reverse), `-reversed` (a reversed session's band) among them; the reverse's
`confirm-reason-<mistake|wrong-patient|not-done|other>` (`docs/reference/e2e-testids-inventory.md`
› Patient file records).
