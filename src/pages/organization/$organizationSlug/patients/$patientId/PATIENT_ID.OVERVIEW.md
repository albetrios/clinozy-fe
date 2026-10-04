# `pages/organization/$organizationSlug/patients/$patientId` — Patient file

Route: `/organization/$organizationSlug/patients/$patientId` — one patient's file (KICKOFF
§6.6; `iterations/launch-2026-09-30-jxmr/intake-files/patient-file.md`). The bare URL and any unknown segment go to `timeline/`, the
Overview (`S:33`), keeping the search (the `activity` a Patients row or ⌘K sends).

Gated like the Patients room: membership (`organization:read`) and the `clinic-patients`
module, then `requireOrgStatus`, in `src/app/routes/routeTree.tsx`; in-room access is
`useClinicAccess`. The billing sections also need Payments view; an Accountant (billing
view, no Patients view — Q-F1, AMBER A-F14) is sent to `invoices/` and sees the rail's
identity only. A section the member may not open goes to the first one they may, or back to
the list with the permission toast.

## The screen (L-42)

A column on `canvas` inside the room gutter (`PatientFileLayout.tsx`):

- **File bar** (`components/PatientFileBar/`) — Back (Esc), the breadcrumb "Patients /
  name" while the rail shows or the identity block (the name over "#3508 · +91 ••••• •3212",
  always masked) otherwise, the folder button with the section popover, the pinned tabs
  (← / → move between them; an open unpinned section shows with its dot), "+" (the Add-to-
  record menu, hidden when the member may add nothing), "Start visit" and "Activity" with
  its unread badge. Below `md` a 3-column grid: Back · identity · the end cluster, then the
  folder and the tabs across.
- **Section popover** (`components/PatientSectionsPopover/`) — the four groups of tiles
  (Open now · Empty · Has records) with a pin each; the pins are a server preference
  (`usePreferences().patientFilePins`, default Clinical notes · Visits · Prescriptions ·
  Invoices — D26). A bottom sheet on a phone.
- **Main card** — the rail (`components/PatientRail/`, 288px: identity, Reach with masked
  numbers, About, Up next) and the open section. The rail and the breadcrumb show from `lg`
  while Activity is closed and from `xl` while open (D23) — CSS on `data-activity`, no
  width reads.
- **Activity** (`components/PatientActivity/`) — the shared chat column in its own card,
  the Leads chat's width. A link's `activity` decides and becomes the session's state
  (`useUIStore.fileActivityOpen`); with none, open from `md` and closed on a phone, where
  it replaces the main card (`hooks/usePatientFileActivity/`).

The file's money mask (Q-F4) is one flag held by the layout — masked by default, never
persisted, reset per patient — handed down with the file through
`shared/patient-file-context.ts`. Esc goes back to the list when no surface above takes it
(`hooks/useEscapeBack/`). A patient that is gone toasts "Patient not found · it may have been
deleted" and goes back to the list; another failure keeps the screen and toasts Retry.

The data is the shared patients domain: the file's read joins the patient with their next
visit, dues, credit, feedback, record counts and unread messages —
`@/shared/api/clinic/patient-file-api.ts` (fixture world, `REPLACE_WITH_API`) and
`@/shared/hooks/usePatientFile/`. The sections' slugs and role gates are
`@/shared/clinic/patient-file-sections.ts`; the links are
`@/lib/routes/patient-file-builders.ts` (kept off the entry chunk's route barrel).

## Children

Every section is a leaf island rendered through the family frame
`shared/components/PatientSection/` (its 50px header and the split "New …" + "⌄"):
`timeline/` (Overview), `overview/` (Clinical notes), `visits/`, `prescriptions/`,
`treatments/`, `images/` (Photos), `reports/`, `invoices/`, `payments/`, `packages/`,
`notes/` (Team notes). `edit/` is Edit patient over the section it opened from
(`?from=`, AMBER A-F1). `src/app/routes/routeTree.tsx` loads all of them through ONE lazy module,
`patient-id.sections.ts`, so the entry chunk carries one loader for the whole file.

## Files

| File                                  | Responsibility                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `patient-id.route.tsx`                | Route marker — exports `Component` rendering `PatientFileLayout`.                                                                       |
| `patient-id.manifest.ts`              | Manifest — `kind: 'layout'` over the eleven sections and `edit`, permission `organization:read`, module `clinic-patients`.              |
| `patient-id.search.ts`                | URL schemas: the file's `activity`, a file-level drawer's `from`. Rides the entry chunk.                                                |
| `patient-id.sections.ts`              | The lazy route components of the layout, every section and `edit`, behind one dynamic import.                                           |
| `patient-id.constants.ts`             | `PATIENT_FILE_LAYOUT_NS` / `PATIENT_FILE_LAYOUT_KEYS` — the not-found record and the loading label.                                     |
| `PatientFileLayout.tsx`               | The layout: bar, main card, Activity; the mask, the section guard, Esc, the load failure. Owns `data-testid="patient-file-layout"`.     |
| `components/PatientFileBar/`          | The file bar and its tab strip.                                                                                                         |
| `components/PatientSectionsPopover/`  | The section popover / phone sheet.                                                                                                      |
| `components/PatientRail/`             | The rail: identity, Reach, About, Up next; `components/PatientRail/patient-rail.ts` holds the tenure, birthday and masked-number rules. |
| `components/PatientActivity/`         | The Activity column's card around `ChatColumn`.                                                                                         |
| `hooks/usePatientFileActivity/`       | Whether Activity is open, and its toggle.                                                                                               |
| `hooks/usePatientFileNavigation/`     | The file's links: sections, the list, Start visit, Edit patient, Book / Reschedule, Collect, Feedback, history chips.                   |
| `hooks/useEscapeBack/`                | Esc back to the list when nothing else handled it.                                                                                      |
| `shared/patient-file-context.ts`      | The file's context for its sections and drawers (`usePatientFileContext`).                                                              |
| `shared/patient-file-nav.ts`          | Section tones, icons and groups; the tab strip; pin toggling; the section a URL shows.                                                  |
| `shared/patient-file.constants.ts`    | `PATIENT_FILE_NS` / `PATIENT_FILE_KEYS` — the section names.                                                                            |
| `shared/hooks/usePatientFileActions/` | The Add-to-record items the member may use and what each runs; each section's primary item.                                             |
| `shared/components/PatientAddMenu/`   | The Add-to-record menu ("+" and a section's "⌄").                                                                                       |
| `shared/components/PatientSection/`   | The section frame every child renders.                                                                                                  |
| `__tests__/integration/`              | `__tests__/integration/patient-file-test-router.tsx` mirrors the file's routes for the tests.                                           |

## Test ids

`patient-file-layout`; `patient-file-back`, `patient-file-sections` (panel
`patient-file-sections-panel`, tiles `patient-file-sections-tile-<section>`, pins
`patient-file-sections-pin-<section>`), `patient-file-tab-<section>`, `patient-file-add`,
`patient-file-add-menu` (items `patient-file-add-menu-<item>`), `patient-file-start-visit`,
`patient-file-activity`, `patient-file-activity-column`; `patient-rail`,
`patient-rail-copy-id`, `patient-rail-edit`, `patient-rail-book`, `patient-rail-due`,
`patient-rail-due-eye`, `patient-rail-collect`, `patient-rail-feedback`;
`patient-section-<section>`, `patient-section-primary`, `patient-section-more`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
