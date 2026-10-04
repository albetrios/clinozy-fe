# `pages/organization/$organizationSlug/patients/$patientId/notes` — Team notes

Route: `/organization/$organizationSlug/patients/$patientId/notes` — a section of the
patient file (KICKOFF §6.6, D26; H:834; `patient-file.md:81–90`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the composer and the notes land with L-43b; the section has no "New …" button.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                   | Responsibility                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `notes.route.tsx`      | Route marker — exports `Component` rendering `PatientNotesPage`.                                         |
| `notes.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Team notes". |
| `PatientNotesPage.tsx` | The section: `PatientSection` with its header and content.                                               |

## Test ids

`patient-section-notes` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
