# `pages/organization/$organizationSlug/patients/$patientId` — Patient file

Route: `/organization/$organizationSlug/patients/$patientId` — one patient's file (KICKOFF
§6.6; `iterations/launch-2026-09-30-jxmr/intake-files/patient-file.md`). The bare URL and any unknown segment go to `timeline/`, the
Overview (`S:33`), keeping the search (the `activity` a Patients row or ⌘K sends).

Gated like the Patients room: membership (`organization:read`) and the `app-patients`
module, then `requireOrgStatus`, in `src/app/routes/routeTree.tsx`; in-room access is
`useAppAccess` — the member's own codes (D152): Patients view, and each section's read
code beside it — `patient:clinical_record:read` (Clinical notes, Photos, Reports),
`patient_prescription:read`, `patient_treatment:read` (`viewablePatientFileSections`); the
file's write gates are `patient_prescription:create`, `patient_treatment:create` and
`patient:private_album:read` (`passesPatientFileGate`; View-as previews by role). The
billing sections also need Payments view; an Accountant (billing
view, no Patients view — Q-F1, AMBER A-F14) is sent to `invoices/` and sees the rail's
identity only. A section the member may not open goes to the first one they may, or back to
the list with the permission toast.

## The screen (L-42)

A column on `canvas` inside the room gutter (`PatientFileLayout.tsx`):

- **File bar** (`components/PatientFileBar/`) — Back (Esc), the breadcrumb "Patients /
  name" while the rail shows or the identity block (the name over "#3508 · +91 ••••• •3212",
  always masked) otherwise, the folder button with the section popover, the pinned tabs
  (← / → move between them; an open unpinned section shows with its dot), "+" (the Add-to-
  record menu, hidden when the member may add nothing), "Start visit" (the patient's visit —
  today's booking checked in, or one without a booking — and its flow on
  `timeline?visit=open`, D18) or, while a visit is open and the flow isn't showing, the "Visit in
  progress · Resume" pill back to it, and "Activity" with a dot while the person's last
  message waits for a reply (`is_awaiting_reply` — no unread count, §6 #4). Below `md` a 3-column grid: Back · identity · the end cluster, then the
  folder and the tabs across.
- **Section popover** (`components/PatientSectionsPopover/`) — the four groups of tiles,
  "Open now" under the open one (no tile says Empty or Has records: the API counts no
  section's records — G4), with a pin each; the pins are a server preference
  (`usePreferences().patientFilePins`, default Clinical notes · Visits · Prescriptions ·
  Invoices — D26). A bottom sheet on a phone.
- **Main card** — the rail (`components/PatientRail/`, 288px: identity; Reach — the
  primary number, the person's other numbers and Instagram, masked; About — gender and age,
  birthday, the language tag, address, consents; Up next — the next visit, what she owes for a
  member who sees billing (the server's `meta.due_total`, masked with the file, its eye, and
  Collect — Receive payment, `payment:create` — or "All paid · nothing due"; no credit to give
  back — G-P8) and the feedback row) and the open section. The rail and the breadcrumb show from `lg`
  while Activity is closed and from `xl` while open (D23) — CSS on `data-activity`, no
  width reads.
- **Activity** (`components/PatientActivity/`) — the shared chat column in its own card,
  the Leads chat's width, on the person's activity (`person: { kind: 'contact' }`). A link's `activity` decides and becomes the session's state
  (`useUIStore.fileActivityOpen`); with none, open from `md` and closed on a phone, where
  it replaces the main card (`hooks/usePatientFileActivity/`).

The file's money mask (Q-F4) is one flag held by the layout — masked by default, never
persisted, reset per patient — handed down with the file through
`shared/patient-file-context.ts`: the Activity column and the Overview's timeline mask the
rupee amounts in the server's lines; the rail's due card and the Overview's Billing card toggle it.
Esc goes back to the list when no surface above takes it
(`hooks/useEscapeBack/`). A patient that is gone toasts "Patient not found · it may have been
deleted" and goes back to the list; another failure keeps the screen and toasts Retry.

The layout also renders the photo picker and the camera input once and hands the photo uploads down the context
(`shared/hooks/usePatientPhotoUpload/`): Photos' drop and "Upload images" and the Add menu's
"Photo" (General, then Photos) go through the shared upload tray — "2 photos uploaded to
General" once the last of a batch is filed.

The data is the shared patients domain on clinozy-be: the file's read is the patient
(`GET /app/patients/:patient_id`) with their person (`GET /app/contacts/:contact_id`), the
person's next booking (`…/preview`) and the newest check-in and review —
`@/shared/api/app/patient-file-api.ts` and `@/shared/hooks/usePatientFile/`. The team
(`GET /app/memberships`) is who a record names and who the staff pickers offer. The sections' slugs and role gates are
`@/shared/app/patient-file-sections.ts`; the links are
`@/lib/routes/patient-file-builders.ts` (kept off the entry chunk's route barrel).

## Children

Every section is a leaf island rendered through the family frame
`shared/components/PatientSection/` (its 50px header and the split "New …" + "⌄"):
`timeline/` (Overview), `overview/` (Clinical notes), `visits/`, `prescriptions/`,
`treatments/`, `images/` (Photos), `reports/`, `invoices/`, `payments/`, `packages/`,
`notes/` (Team notes). `edit/` is Edit patient over the section it opened from
(`?from=`, AMBER A-F1), and so are the check-in and review drawers — `check-ins/create/`,
`check-ins/$checkInId/edit/`, `reviews/create/`, `reviews/$reviewId/edit/` (`S:44–47`; L-43),
Clinical notes behind them by default (`shared/hooks/usePatientFileDialog/` reads `from` and
goes back). Prescriptions, Treatments and Reports carry their records' URL-driven
dialogs (`S:35–39, 42–43`; L-45), which render nothing — the section reads the URL
(`shared/hooks/usePatientRecordRoute/`) and opens its drawer. `src/app/routes/routeTree.tsx`
loads all of them through ONE lazy module, `patient-id.sections.ts`, so the entry chunk carries
one loader for the whole file.

## Files

| File                                     | Responsibility                                                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patient-id.route.tsx`                   | Route marker — exports `Component` rendering `PatientFileLayout`.                                                                                                                                                     |
| `patient-id.manifest.ts`                 | Manifest — `kind: 'layout'` over the eleven sections, `edit`, `check-ins` and `reviews`, permission `organization:read`, module `app-patients`.                                                                       |
| `patient-id.search.ts`                   | URL schema: the file's `activity` and `visit` (the flow) — entry chunk.                                                                                                                                               |
| `patient-id.dialog-search.ts`            | The file's dialog routes' params: a file-level drawer's `from`, the feedback drawers' visit, treatment and source, New prescription's medicines — parsed where they are read; loads with the file.                    |
| `patient-id.sections.ts`                 | The lazy route components of the layout, every section and the file-level drawers, behind one dynamic import.                                                                                                         |
| `patient-id.constants.ts`                | `PATIENT_FILE_LAYOUT_NS` / `PATIENT_FILE_LAYOUT_KEYS` — the not-found record and the loading label.                                                                                                                   |
| `PatientFileLayout.tsx`                  | The layout: bar, main card, Activity; the mask, the section guard, Esc, the load failure. Owns `data-testid="patient-file-layout"`.                                                                                   |
| `components/PatientFileBar/`             | The file bar and its tab strip.                                                                                                                                                                                       |
| `components/PatientSectionsPopover/`     | The section popover / phone sheet.                                                                                                                                                                                    |
| `components/PatientRail/`                | The rail: identity, Reach, About, Up next; `components/PatientRail/patient-rail.ts` holds the tenure, birthday and masked-number rules.                                                                               |
| `components/PatientActivity/`            | The Activity column's card around `ChatColumn`.                                                                                                                                                                       |
| `hooks/usePatientFileActivity/`          | Whether Activity is open, and its toggle.                                                                                                                                                                             |
| `hooks/usePatientFileNavigation/`        | The file's links: sections, the list, Start visit / Resume (the flow), Edit patient, Book / Reschedule, Collect (Receive payment), Feedback, history chips.                                                           |
| `hooks/useEscapeBack/`                   | Esc back to the list when nothing else handled it.                                                                                                                                                                    |
| `shared/patient-file-context.ts`         | The file's context for its sections and drawers (`usePatientFileContext`).                                                                                                                                            |
| `shared/patient-file-nav.ts`             | Section tones, icons and groups; the tab strip; pin toggling; the section a URL shows.                                                                                                                                |
| `shared/patient-file.constants.ts`       | `PATIENT_FILE_NS` / `PATIENT_FILE_KEYS` — the section names.                                                                                                                                                          |
| `shared/hooks/usePatientFileActions/`    | The Add-to-record items the member may use and what each runs (Invoice and Payment on `payment:create`; "Nothing due" from the server's due); each section's primary item.                                            |
| `shared/hooks/usePatientPhotoUpload/`    | The photo uploads and the hidden picker and camera: drop, paste, "Upload images", the strip, "Take photo", the Add menu's "Photo".                                                                                    |
| `shared/hooks/usePhotoDrop/`             | Files dragged over a photo drop target — Photos and the Overview's Photos card.                                                                                                                                       |
| `shared/hooks/usePhotoPaste/`            | Images pasted while Photos or the Overview is on screen (not in a field, not under a dialog).                                                                                                                         |
| `shared/patient-photos.constants.ts`     | `PATIENT_PHOTOS_NS` / `PATIENT_PHOTOS_KEYS` — Photos, the viewer and Photo details.                                                                                                                                   |
| `shared/components/PatientAddMenu/`      | The Add-to-record menu ("+" and a section's "⌄").                                                                                                                                                                     |
| `shared/components/PatientSection/`      | The section frame every child renders.                                                                                                                                                                                |
| `shared/components/PatientStaffPicker/`  | The record drawers' Doctor / Therapist picker over the team (no doctor or therapist roles to read — M41), and who a new record starts with (`useDefaultStaff`).                                                       |
| `shared/hooks/usePatientRecordRoute/`    | Which record dialog a section's URL opens (create · view · edit), the refusal and not-found returns, and the close.                                                                                                   |
| `shared/hooks/usePatientFileDialog/`     | A file-level drawer route's section behind it (`?from=`, Clinical notes by default), its way back, and its refusal.                                                                                                   |
| `shared/hooks/useVisitFlowReturn/`       | The visit flow's place in the URL (`?visit=open`, `from=today`): the open visit a drawer opened from the flow writes at, its way back to the flow, and the flow's exits (Today when Today opened it; L-64).           |
| `shared/components/CheckInDrawer/`       | Visit / Aftercare check-in (`check-ins/*`, L-43): its form, steps, head and save.                                                                                                                                     |
| `shared/components/ReviewDrawer/`        | Log a review (`reviews/*`, L-43): its form, steps and save with the files' upload.                                                                                                                                    |
| `shared/components/PatientSectionTable/` | The section tables' frame (L-43b): the shared table with Export (`patient:export`, a billing section's `payment:export`; View-as the role's `export` ability), the empty state, the people cells and the day formats. |
| `shared/hooks/useStaffLookup/`           | The team member a record names — its doctor, therapist, author — as a chip, by membership id; an optimistic write as the signed-in member.                                                                            |
| `shared/patient-feedback.ts`             | The feedback words and tones the rail, the Feedback card and the drawers share (counts, "Followed …", score and rating tones).                                                                                        |
| `shared/patient-clinical.ts`             | The four clinical lists, the note kind each holds (findings and safety checks have no card) and the chip shape — each chip one clinical note.                                                                         |
| `shared/hooks/useClinicalLists/`         | The chip cards' state on `useClinicalNotes`: one POST per chip, a delete with reason `not_needed` per removal with Undo = restore — the chip cards, the Overview's Clinical card and smart note.                      |
| `shared/components/PhotoThumb/`          | A photo from its `file_url` (D86), else — its upload gone, its link failing — the image glyph: Photos' tiles, the viewer and the Overview's Photos card.                                                              |
| `shared/patient-visit.ts`                | The next visit's day and time ("Today · 11:00 am") — the rail's Up next and the Overview's Visits card.                                                                                                               |
| `__tests__/integration/`                 | `__tests__/integration/patient-file-test-router.tsx` mirrors the file's routes for the tests.                                                                                                                         |

## Test ids

`patient-file-layout`; `patient-file-back`, `patient-file-sections` (panel
`patient-file-sections-panel`, tiles `patient-file-sections-tile-<section>`, pins
`patient-file-sections-pin-<section>`), `patient-file-tabs` (tabs `patient-file-tab-<section>`), `patient-file-add`,
`patient-file-add-menu` (items `patient-file-add-menu-<item>`), `patient-file-start-visit`,
`patient-file-activity` (its dot `patient-file-activity-awaiting`),
`patient-file-activity-column`; `patient-rail`, `patient-rail-copy-id`, `patient-rail-edit`,
`patient-rail-book`, `patient-rail-feedback`;
`patient-section-<section>`, `patient-section-primary`, `patient-section-more`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
