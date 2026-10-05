# `pages/organization/$organizationSlug/patients/$patientId/treatments` — Treatments

Route: `/organization/$organizationSlug/patients/$patientId/treatments` — a section of the
patient file (KICKOFF §6.6, D26; H:4757; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the table lands with L-43b. Its URL-driven dialogs (L-45; `S:38–39`) render nothing — the section
reads the URL (`../shared/hooks/usePatientRecordRoute/`) and opens the Treatment drawer over
itself: `create/` and `$treatmentId/edit/` (show is edit). Recording one is the Doctor and
Therapist gate (`S:38`; the Owner always passes) — anyone else reads it.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                             | Responsibility                                                                                                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `treatments.route.tsx`           | Route marker — exports `Component` rendering `PatientTreatmentsPage`.                                                                                                                                                                                 |
| `treatments.manifest.ts`         | Manifest — `kind: 'layout'` (children `create`, `$treatmentId`), permission `organization:read`, module `clinic-patients`, title "Treatments".                                                                                                        |
| `treatments.constants.ts`        | The drawer's copy keys and root test id.                                                                                                                                                                                                              |
| `PatientTreatmentsPage.tsx`      | The section, and the drawer its URL names — once the history, the packages and the default doctor and therapist are read; the name chips are the first four offerings.                                                                                |
| `components/TreatmentDrawer/`    | The 680px drawer: the Type switch, "Session" → "<template> details" (by `treatment_template`: Skin · laser, Dental with FDI teeth, Physio, Gynac, General) → "Aftercare"; Quick fill "Next session of …" and one chip per package; "Treatment saved". |
| `create/` · `$treatmentId/edit/` | The dialog routes (each renders nothing).                                                                                                                                                                                                             |

## Test ids

`patient-section-treatments` — the section's root; `treatment-drawer` and its parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
