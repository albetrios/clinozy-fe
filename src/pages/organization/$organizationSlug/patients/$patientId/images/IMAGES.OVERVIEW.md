# `pages/organization/$organizationSlug/patients/$patientId/images` — Photos

Route: `/organization/$organizationSlug/patients/$patientId/images` — a section of the patient
file (KICKOFF §6.6, D26; H:827–832; `iterations/launch-2026-09-30-jxmr/intake-files/patient-file.md`).
It renders in the file layout's content column through the family's section frame
(`../shared/components/PatientSection/`). Search (`images.search.ts`): `album` (`private` ·
`lhr`; General when absent) and `appointment` (a visit id, or `none`; every photo when absent).

Gated by the file layout (membership, the `clinic-patients` module, the org status, the
section's `patient:clinical_record:read`); in-room access is `useClinicAccess` through
`shared/hooks/usePhotoAccess/`: the Private album by `patient:private_album:read`
(`passesPatientFileGate(access, 'privateAlbum')`; View-as previews it for Doctor, Admin and
Owner) — a member without it following `?album=private` gets the permission toast and General —
and every write (upload, Photo details, delete, restore) by `patient:update`.
Registered in `src/app/routes/routeTree.tsx` through the file's one lazy module
(`../patient-id.sections.ts`).

## Data (clinozy-be, api-integration §5.4)

- **Read:** `GET /app/patients/:patient_id/images?album=&appointment_id=` (or
  `has_appointment=false` for "Not attached to a visit"), cursor pages of 12
  (`@/shared/hooks/usePatientPhotos/`, `shared/photo-view.ts` `photoListParamsOf`). The section
  and the viewer ask for the same params, so they share one cached list. The tabs' counts are the
  server's `meta.album_counts` (Private only for a member with its code); "3 photos" and "Load
  more · 4 left" read `meta.pagination.estimated_total`. One photo: `GET …/images/:id`.
- **Visits** (the filter, Photo details): the person's bookings (`usePersonAppointments`) that
  were checked in or completed — the only ones the API files a photo under.
- **Writes:** `POST …/images` per uploaded JPG / PNG, `PATCH …/images/:id` with
  `expected_updated_at`, `DELETE …?reason=&note=`, `POST …/restore` (the toast's Undo).
- **B1 (Q4):** nothing turns a `file_key` into a URL, so a tile shows the image glyph
  (`../shared/components/PhotoThumb/`), the photo's name and day, its body part and stage — never
  its pixels.

## The section (L-44)

- **Toolbar** (`components/PhotoToolbar/`): the album tabs General · Private · LHR on the shared
  segmented track, each with the server's count, "3 photos", the visit filter "All photos ⌄"
  ("All photos" · "Not attached to a visit" · each visit a photo can be filed under, "#2790 ·
  Completed"), the S / M / L radios — the size is a device pref
  (`useDevicePrefsStore.photoSize`). The design's per-visit photo count goes: the API counts by
  album only (G4).
- **Grid** (`components/PhotoGrid/`): a group per day, named by the rooms' one time rule
  (`useClinicClock().day`: "Today", "Yesterday", "Mon", "24 Sep") with its visit's service, square
  tiles at 110 / 160 / 230px with the body-part and stage pills and the caption bar (always shown;
  Edit and Delete at M and L). The design's "3 photos · …" per day goes (a day can run across
  pages). A tile opens the viewer (`$imageId/`), Edit opens Photo details (`$imageId/edit/`),
  Delete the reason confirm ("Wrong patient" → `mistake` · "Blurry / retake" → `not_needed`, Q24 ·
  "Duplicate" · "Other" with its note; "Photo deleted" with Undo).
- **Paging:** a page of 12, then "Load more · 4 left" reads the next page.
- **Upload:** files dropped on the section (the dashed outline 8px inside), "Upload images" and
  the Add menu's "Photo" go through the shared upload tray into the album on screen —
  "2 photos uploaded to General" (`../shared/hooks/usePatientPhotoUpload/`). A drop with no JPG
  or PNG says "Drop image files" (the API files no other type).
- **Empty / failed:** "No photos in General yet" · "Drag photos here or upload from your
  computer." · "Upload images"; a first read that fails says so with Retry (and the list toast).

## Files

| File                                    | Responsibility                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `images.route.tsx`                      | Route marker — exports `Component` rendering `PatientImagesPage`.                                                                   |
| `images.manifest.ts`                    | Manifest — `kind: 'layout'` over `$imageId`, permission `organization:read`, title "Photos".                                        |
| `images.search.ts`                      | URL schema (`validateSearch`): `album`, `appointment`. Rides the entry chunk.                                                       |
| `PatientImagesPage.tsx`                 | The section: toolbar, grid, paging, drop, the delete confirm; hosts the dialogs' `Outlet`.                                          |
| `components/PhotoToolbar/`              | Album tabs, count, visit filter, size radios.                                                                                       |
| `components/PhotoGrid/`                 | Day groups and tiles.                                                                                                               |
| `shared/photo-looks.ts`                 | Album icons and tones, body-part and stage tones, the S / M / L looks.                                                              |
| `shared/photo-view.ts`                  | The read's params, the visit filter, day groups, the filter's visits, stepping a list.                                              |
| `shared/components/PhotoDeleteConfirm/` | "Delete this photo?" with its reasons and Undo.                                                                                     |
| `shared/hooks/usePhotoAccess/`          | What the member may do with the photos.                                                                                             |
| `shared/hooks/usePhotoVisits/`          | The visits a photo can be filed under.                                                                                              |
| `shared/hooks/useMissingPhoto/`         | "Photo not found" (or the failure) for a photo the API does not answer.                                                             |
| `$imageId/`                             | The photo viewer — see its overview.                                                                                                |
| `__tests__/integration/`                | The tests' router (`__tests__/integration/photos-test-router.tsx`) and in-memory API (`__tests__/integration/photo-api-double.ts`). |

A tile's photo is the family's `../shared/components/PhotoThumb/` (the viewer's stage and the
Overview's Photos card show it too).

## Test ids

`patient-section-images` — the section's root; `patient-photos` (the drop zone),
`patient-photos-tab-<album>`, `patient-photos-visit-filter`, `patient-photos-size-<size>`,
`patient-photos-day`, `patient-photo-tile`, `patient-photo-edit`, `patient-photo-delete`,
`patient-photos-load-more`, `patient-photos-empty`, `patient-photos-input`; the delete's
`confirm-reason-<mistake|not-needed|duplicate|other>` (`docs/reference/e2e-testids-inventory.md` ›
Patient file).
