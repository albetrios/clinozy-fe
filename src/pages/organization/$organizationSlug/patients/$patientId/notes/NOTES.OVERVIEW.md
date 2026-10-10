# `pages/organization/$organizationSlug/patients/$patientId/notes` — Team notes

Route: `/organization/$organizationSlug/patients/$patientId/notes` — a section of the
patient file (KICKOFF §6.6, D26; H:834; `patient-file.md:81–90`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`); one column of at
most 760px (L-43b): the composer and the notes newest first — "Riya S. · Sep 24 · 15:39" — 25 a page
with "Load more"; "No notes yet". The section has no "New …" button.

A team note is a `note` entry of the person's activity on clinozy-be (§6 #3; route map §4 #3 — the
patient notes and their routes are gone): read with `GET /app/contacts/:contact_id/activities?type=note`
(`contact_activity:read`) and added with `POST …/activities/add-note` (`contact_activity:create`;
≤500 here, the route takes 1,000; an empty note does nothing) — `@/shared/hooks/useContactActivities/`.
The add is optimistic: the note tops the list at once as the signed-in member's, and a refused one comes
off again and back into the box (its error toasts). It shows in the Activity column and the Overview's
Team notes card too. There is no delete and so no Undo — the API has no route for either (G4). A View-as
preview reads by the role's Patients view and adds by its Patients create. The author is the entry's
member (`author_membership_id`, `../shared/hooks/useStaffLookup/`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                   | Responsibility                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `notes.route.tsx`      | Route marker — exports `Component` rendering `PatientNotesPage`.                                         |
| `notes.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Team notes". |
| `PatientNotesPage.tsx` | The section: the composer, the note cards and "Load more", on the person's stream.                       |
| `notes.constants.ts`   | The section's copy keys and test ids.                                                                    |

## Test ids

`patient-section-notes` — the section's root; `patient-notes-input`, `patient-notes-add`, `patient-note-<id>` and `patient-notes-more` (`docs/reference/e2e-testids-inventory.md` › Patient file).
