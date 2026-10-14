# `pages/organization/$organizationSlug/patients/$patientId/check-ins/create` — New check-in

Route: `/organization/$organizationSlug/patients/$patientId/check-ins/create` — a URL-driven dialog over
the patient file (KICKOFF §6.6 Drawers, D24; `S:44`). It renders the section it opened from — `?from=<section>`, Clinical notes when `from`
names none, as the schema has it — taken from the file's sections module
(`../../patient-id.sections.ts`) through `../../shared/hooks/usePatientFileDialog/`, and the
family-shared check-in drawer over it (`../../shared/components/CheckInDrawer/`): an aftercare
check-in when `?treatment=` names the treatment it follows, tied to the visit `?appointment=`
names. When the patient's previous check-in advised a plan, "Details" offers "Use the advised plan"
and "Next plan" offers "Same plan as last time" — chips that write it in (`DrawerTextarea`
`suggestions`, feat-write-less, D12). Saving or closing goes back to that section. The params are parsed by
`validatePatientFeedbackSearch` in `../../patient-id.dialog-search.ts`.

Data: clinozy-be — the drawer saves with `POST /app/patients/{patient_id}/check-ins`
(`createCheckIn`, `@/shared/api/app/feedback-api.ts`; `patient:update`, an idempotency key).
A score is required, 1–10 (Q18). The server words the check-in's `context`, puts its next
offerings in the plan and, for Worse or a score of 4 or less, opens the doctor call-back — the
client does neither (api-integration §5.4).

Gated by the file layout (membership, the `app-patients` module, the org status); in-room
Patients edit is `useAppAccess` — anyone without it who follows the link lands back on the
section with the permission toast.
Registered in `src/app/routes/routeTree.tsx` as a file-level drawer route, through the
file's one lazy module (`../../patient-id.sections.ts`).

## Files

| File                 | Responsibility                                                              |
| -------------------- | --------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewCheckInPage`.              |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, test id `check-in-drawer`, title "New check-in". |
| `NewCheckInPage.tsx` | The section behind, and a new check-in over it.                             |

## Test ids

`check-in-drawer` — the drawer (`docs/reference/e2e-testids-inventory.md` › Patient file feedback).
The route renders no element of its own (`tooling/validate/test-ids-allowlist.txt`).
