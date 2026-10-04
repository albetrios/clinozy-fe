# `pages/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit` — Edit check-in

Route: `/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit` — a URL-driven dialog over
the patient file (KICKOFF §6.6 Drawers, D24; `S:45`). It renders the section it opened from — `?from=<section>`, Clinical notes when `from`
names none, as the schema has it — taken from the file's sections module
(`../../../patient-id.sections.ts`) through `../../../shared/hooks/usePatientFileDialog/`, and the
check-in drawer, prefilled, over it (`../../../shared/components/CheckInDrawer/`) — it keeps
the record's visit, treatment, context and day. An id that names no check-in goes back with
"Check-in not found · it may have been deleted" (`useDialogRouteRecord`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
Patients edit is `useClinicAccess` — anyone without it who follows the link lands back on the
section with the permission toast.
Registered in `src/app/routes/routeTree.tsx` as a file-level drawer route, through the
file's one lazy module (`../../../patient-id.sections.ts`).

## Files

| File                  | Responsibility                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| `edit.route.tsx`      | Route marker — exports `Component` rendering `EditCheckInPage`.              |
| `edit.manifest.ts`    | Manifest — `kind: 'leaf'`, test id `check-in-drawer`, title "Edit check-in". |
| `EditCheckInPage.tsx` | The section behind, and the saved check-in over it.                          |

## Test ids

`check-in-drawer` — the drawer (`docs/reference/e2e-testids-inventory.md` › Patient file feedback).
The route renders no element of its own (`tooling/validate/test-ids-allowlist.txt`).
