# `pages/organization/$organizationSlug/patients` — Patients

Route: `/organization/$organizationSlug/patients`. Registered patients, with prescriptions, sessions and photos (KICKOFF §6.5).

Gated like every clinic room: membership (`organization:read`) and the `clinic-patients`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7): without Create the "New patient" button and the phone
pill hide, without Edit the row Edit goes, without Delete the row Delete goes, and the
row's New invoice / Collect follow Create in Payments.

## The screen (L-32)

The shared room toolbar (`RoomToolbar`): h1 · the five view tabs (All · In clinic today ·
With dues · Follow-up due · Recall) · search "Name, mobile or #ID" · saved views · Filters
(Gender · Type · Status · Conversion · Created · Follow-up date) · Columns · "New patient",
which floats as a 52px pill on a phone. Under it the shared `DataTable`: ID · Patient
(contact card on hover) · Gender · Type · Status · Conversion · Age · Follow-up · Due ·
Updated, Gender / Conversion / Age hidden by default (a device pref); folds on a tablet
(4 columns at 820, 2 at 1024); phone rows with Due as the key column; selection and the
bulk bar from `md` (Export as CSV with the `export` ability); row actions New invoice ·
Collect · Edit · Delete; infinite scroll over cursor pages, "All patients loaded".

The view, search, filters and sort live in the URL (`patients.search.ts`); the list read
follows them — a view or sort change keeps the rows until the new page arrives, a search
or "Apply filter" shows the skeleton over the rows. A failed read keeps the last copy and
toasts "Retry". A row click opens the patient file (`activity` open from `md`, closed on a
phone); the file, its Edit patient drawer route, the Invoice drawer and Receive land with their own
rows (L-42, L-40, L-39b) — until then those targets land on the org's not-found route.

## Dialog route

A layout island over one URL-driven dialog (D24, `S:31`): `create/` — New patient — whose
route renders nothing; this page reads the URL and opens the drawer over the list. The
drawer lands with its own row (L-32b).

The data is the shared patients domain: `@/shared/api/clinic/patients-api.ts` (fixture
world, `REPLACE_WITH_API`), its contracts beside it, and the hooks in
`@/shared/hooks/usePatients/`. The delete confirm is `@/shared/components/PatientDeleteConfirm/`.

## Files

| File                          | Responsibility                                                                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patients.route.tsx`          | Route marker — exports `Component` rendering `PatientsPage`.                                                                                                                                             |
| `patients.manifest.ts`        | Manifest — `kind: 'layout'` over `create`, permission `organization:read`, module `clinic-patients`, nav section `patients`.                                                                             |
| `patients.search.ts`          | URL schemas (`validateSearch`): the list's `view`, `q`, `types`, `status`, `gender`, `conversion`, `created`, `followUp`, `sort`; the New patient prefill; `patientListParamsOf`. Rides the entry chunk. |
| `patients.constants.ts`       | `PATIENTS_NS` / `PATIENTS_KEYS` (the `patients` namespace), the table id and the Filters fields (room-only, kept off the entry).                                                                         |
| `PatientsPage.tsx`            | Room page — toolbar, table, states, row and bulk actions, the delete confirm; hosts the dialog route's `Outlet`. Owns `data-testid="patients-page"`.                                                     |
| `components/PatientsToolbar/` | The room toolbar's configuration: view tabs and their icons, the Filters copy and tones, Columns, "New patient".                                                                                         |
| `components/PatientCells/`    | The cells: ID pill, the patient chip with its contact card, badges, age, follow-up, due, updated.                                                                                                        |
| `hooks/usePatientsTable/`     | The columns (tracks, folds, the recommended set), sorting through the URL, hidden columns.                                                                                                               |
| `__tests__/integration/`      | The room end to end; `__tests__/integration/patients-test-router.tsx` mirrors the family's routes for the tests.                                                                                         |
| `create/`                     | The New patient dialog-route island — see its overview.                                                                                                                                                  |

## Test ids

`patients-page`; the shared toolbar's and table's, prefixed `patients` — `patients-toolbar`,
`patients-tab-<view>`, `patients-new` (the toolbar button and the phone pill),
`patients-table`, `patients-table-row`, `patients-row-action-<new-invoice|collect|edit|delete>`,
`patients-table-bulk-export`; the drawer the dialog route opens: `patient-drawer` (L-32b).
