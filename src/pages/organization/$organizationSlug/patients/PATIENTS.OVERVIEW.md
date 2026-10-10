# `pages/organization/$organizationSlug/patients` — Patients

Route: `/organization/$organizationSlug/patients`. Registered patients, with prescriptions, sessions and photos (KICKOFF §6.5).

Gated like every clinic room: membership (`organization:read`) and the `clinic-patients`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` — the member's own codes `patient:read|create|update|delete` (Patients is
on clinozy-be, D152): without Create the "New patient" button and the phone pill hide,
without Edit the row Edit goes, without Delete the row Delete goes.

## The screen (L-32)

The shared room toolbar (`RoomToolbar`): h1 · the three view tabs (All · Follow-up due ·
Recall) · search "Name, mobile or #ID" · saved views · Filters (Type · Status (one) ·
Conversion (one) · Created · Follow-up date) · Columns · "New patient", which floats as a
52px pill on a phone. Under it the shared `DataTable`: ID · Patient (contact card on hover)
· Gender · Type · Status · Conversion · Age · Follow-up · Updated (the time), Gender /
Conversion / Age hidden by default (a device pref); only ID and Follow-up sort; folds on a
tablet (4 columns at 820, 2 at 1024); selection and the bulk bar from `md` (Export as CSV
with the `export` ability); row actions Edit · Delete; infinite scroll over cursor pages,
"All patients loaded". In clinic today, With dues, the Gender filter, the other sorts, the
Due column and who saved the record go — the API has no read for them (G4, Q22); New
invoice and Collect come back with Payments on clinozy-be.

The view, search, filters and sort live in the URL (`patients.search.ts`); the list read
follows them — a view or sort change keeps the rows until the new page arrives, a search
or "Apply filter" shows the skeleton over the rows. A failed read keeps the last copy and
toasts "Retry". A row click opens the patient file (`$patientId/`, `activity` open from
`md`, closed on a phone).

## Dialog route

A layout island over one URL-driven dialog (D24, `S:31`): `create/` — New patient — whose
route renders nothing; this page reads the URL (`hooks/usePatientsDialogRoute/`) and opens
the shared `PatientDrawer` (`@/shared/components/PatientDrawer/`) over the list, prefilled
from `?name=&phone=&fromLead=` (`fromLead` a lead's public id: the file opens on its
person). The drawer creates the patient with a new person, or on the person the clinic
already knows on that mobile (`POST /app/patients` with `contact_id`). On create the drawer
closes, the list stays and refetches, and the toast "Patient #3509 created" offers "Open
file" (D28, Q-P6); "Create & add another" saves and restarts it empty. A member without
Create who follows the link lands back on the list with the permission toast. The same
drawer is Edit patient on the file's edit route (`$patientId/edit/`) — one save, two
writes: the person (`PATCH /app/contacts/:contact_id`) and the file
(`PATCH /app/patients/:patient_id`).

The data is the shared patients domain on clinozy-be: `@/shared/api/clinic/patients-api.ts`
(`/app/patients`, each list page joined with its people through `GET /app/contacts?ids=`),
its contracts beside it, and the hooks in `@/shared/hooks/usePatients/`. The rooms still on
fixtures (Payments, Medical, Tasks) read `@/shared/api/clinic/patients-fixture-api.ts` through
`@/shared/hooks/useFixturePatients/`. The delete confirm (a reason, Undo = restore) is
`@/shared/components/PatientDeleteConfirm/`.

## Files

| File                            | Responsibility                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patients.route.tsx`            | Route marker — exports `Component` rendering `PatientsPage`.                                                                                                                                                                             |
| `patients.manifest.ts`          | Manifest — `kind: 'layout'` over `create`, permission `organization:read`, module `clinic-patients`, nav section `patients`.                                                                                                             |
| `patients.search.ts`            | URL schemas (`validateSearch`): the list's `view`, `q`, `types`, one `status`, one `conversion`, `created`, `followUp`, `sort`. Rides the entry chunk; the list read doesn't.                                                            |
| `patients.dialog-search.ts`     | New patient's prefill (`name`, `phone`, `fromLead` — a lead's public id) — its route keeps the raw values, `usePatientsDialogRoute` parses them; loads with the room.                                                                    |
| `patients.params.ts`            | The list read from the URL — `patientListParamsOf` (defaults applied, the sort split) — off the entry chunk.                                                                                                                             |
| `patients.constants.ts`         | `PATIENTS_NS` / `PATIENTS_KEYS` (the `patients` namespace), the table id and the Filters fields (room-only, kept off the entry).                                                                                                         |
| `PatientsPage.tsx`              | Room page — toolbar, table, states, row and bulk actions, the delete confirm, the New patient drawer; hosts the dialog route's `Outlet`. Owns `data-testid="patients-page"`.                                                             |
| `components/PatientsToolbar/`   | The room toolbar's configuration: view tabs and their icons, the Filters copy and tones, Columns, "New patient".                                                                                                                         |
| `components/PatientCells/`      | The cells: ID pill, the patient chip with its contact card, badges, age, follow-up, updated.                                                                                                                                             |
| `hooks/usePatientsTable/`       | The columns (tracks, folds, the recommended set), sorting through the URL, hidden columns.                                                                                                                                               |
| `hooks/usePatientsDialogRoute/` | Which dialog the URL opens (New patient and its prefill), the permission refusal, and the close back onto the list.                                                                                                                      |
| `__tests__/integration/`        | The room end to end; `__tests__/integration/patients-test-router.tsx` mirrors the family's routes for the tests, `__tests__/integration/patients-test-data.ts` holds its seeded patients and an in-memory stand-in for the patients API. |
| `create/`                       | The New patient dialog-route island — see its overview.                                                                                                                                                                                  |
| `$patientId/`                   | The patient file — a layout island of its own (its sections, Edit patient) — see its overview.                                                                                                                                           |

## Test ids

`patients-page`; the shared toolbar's and table's, prefixed `patients` — `patients-toolbar`,
`patients-tab-<view>`, `patients-new` (the toolbar button and the phone pill),
`patients-table`, `patients-table-row`, `patients-row-action-<edit|delete>`,
`patients-table-bulk-export`; the drawer the dialog route opens: `patient-drawer` and its
parts (`docs/reference/e2e-testids-inventory.md` › Patient drawer).
