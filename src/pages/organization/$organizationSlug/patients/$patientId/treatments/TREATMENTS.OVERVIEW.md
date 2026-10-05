# `pages/organization/$organizationSlug/patients/$patientId/treatments` — Treatments

Route: `/organization/$organizationSlug/patients/$patientId/treatments` — a section of the
patient file (KICKOFF §6.6, D26; H:4757; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: Treatment (the name over its template) · Area · Team (hidden) · Session · Details (hidden) · Feedback (the latest check-in, else the call still owed) · Date — no ID, a treatment has no display number; a row opens Edit treatment; Check-in (over the section), Copy as next session, Edit and Delete. Its URL-driven dialogs (L-45; `S:38–39`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens the Treatment drawer over
itself: `create/` and `$treatmentId/edit/` (show is edit). Recording one is the Doctor and
Therapist gate (`S:38`; the Owner always passes) — anyone else reads it.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                             | Responsibility                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `treatments.route.tsx`           | Route marker — exports `Component` rendering `PatientTreatmentsPage`.                                                                                                                                                                                                                                                                  |
| `treatments.manifest.ts`         | Manifest — `kind: 'layout'` (children `create`, `$treatmentId`), permission `organization:read`, module `clinic-patients`, title "Treatments".                                                                                                                                                                                         |
| `treatments.constants.ts`        | The drawer's copy keys and root test id.                                                                                                                                                                                                                                                                                               |
| `PatientTreatmentsPage.tsx`      | The section, and the drawer its URL names — once the history, the packages and the default doctor and therapist are read; the name chips are the first four offerings.                                                                                                                                                                 |
| `hooks/useTreatmentsTable/`      | The columns (1260px): Treatment the primary, Area the phone key (dental teeth "#11"), Details from the drawer's own template words, Feedback "Better · 7/10" or "Call next day".                                                                                                                                                       |
| `hooks/useTreatmentRowActions/`  | A row's actions behind their gates: Check-in (`check-ins/create?treatment=`), Copy as next session ("Session 2 added"), Edit, Delete.                                                                                                                                                                                                  |
| `components/TreatmentDrawer/`    | The 680px drawer: the Type switch, "Session" → "<template> details" (by `treatment_template`: Skin · laser, Dental with FDI teeth, Physio, Gynac, General) → "Aftercare"; Quick fill "Log check-in" (edit — the check-in drawer stacked over it, Back returns), "Next session of …" (new) and one chip per package; "Treatment saved". |
| `create/` · `$treatmentId/edit/` | The dialog routes (each renders nothing).                                                                                                                                                                                                                                                                                              |

## Test ids

`patient-section-treatments` — the section's root; `patient-treatments-table`, its rows and `patient-treatments-row-action-<id>`; `treatment-drawer` and its parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
