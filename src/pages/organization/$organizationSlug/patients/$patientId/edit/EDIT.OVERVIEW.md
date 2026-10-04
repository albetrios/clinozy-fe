# `pages/organization/$organizationSlug/patients/$patientId/edit` — Edit patient

Route: `/organization/$organizationSlug/patients/$patientId/edit` — a URL-driven dialog over
the patient file (KICKOFF §6.6, D24; `S:34`). It renders the section it opened from —
`?from=<section>` (AMBER A-F1: the rail's "Edit contact" is on every section), Clinical notes
when `from` names none, as the schema has it — taken from the file's sections module
(`../patient-id.sections.ts`), and the shared patient drawer in its edit mode over it
(`@/shared/components/PatientDrawer/`). Saving or closing goes back to that section; the
drawer's Delete ("Delete this record?", 10s Undo) goes back to the Patients list. `from` is
parsed by `validatePatientFileDialogSearch` in `../patient-id.search.ts` and checked here.

Gated by the file layout (membership, the `clinic-patients` module, the org status); without
Patients edit the drawer opens read-only ("View only · your role can’t change this").

## Files

| File                  | Responsibility                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`      | Route marker — exports `Component` rendering `PatientEditPage`.                                            |
| `edit.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Edit patient". |
| `PatientEditPage.tsx` | The section behind, and the patient drawer over it.                                                        |

## Test ids

`patient-drawer` — the shared drawer (`docs/reference/e2e-testids-inventory.md` › Patient
drawer). The route renders no element of its own (`tooling/validate/test-ids-allowlist.txt`).
