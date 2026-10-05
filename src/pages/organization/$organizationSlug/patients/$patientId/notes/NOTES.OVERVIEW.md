# `pages/organization/$organizationSlug/patients/$patientId/notes` — Team notes

Route: `/organization/$organizationSlug/patients/$patientId/notes` — a section of the
patient file (KICKOFF §6.6, D26; H:834; `patient-file.md:81–90`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
one column of at most 760px (L-43b): the composer (Patients create; ≤500, an empty note does nothing) and the notes newest first — "Riya S. · Sep 24 · 15:39" — × deleting one at once (Patients delete) with "Note deleted" and Undo; "No notes yet". The section has no "New …" button.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                   | Responsibility                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `notes.route.tsx`      | Route marker — exports `Component` rendering `PatientNotesPage`.                                         |
| `notes.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Team notes". |
| `PatientNotesPage.tsx` | The section: the composer and the note cards.                                                            |
| `notes.constants.ts`   | The section's copy keys and test ids.                                                                    |

## Test ids

`patient-section-notes` — the section's root; `patient-notes-input`, `patient-notes-add`, `patient-note-<id>` and `patient-note-delete-<id>` (`docs/reference/e2e-testids-inventory.md` › Patient file).
