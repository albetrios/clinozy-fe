# `pages/organization/$organizationSlug/patients/$patientId/images` — Photos

Route: `/organization/$organizationSlug/patients/$patientId/images` — a section of the patient
file (KICKOFF §6.6, D26; H:827–832; `iterations/launch-2026-09-30-jxmr/intake-files/patient-file.md`).
It renders in the file layout's content column through the family's section frame
(`../shared/components/PatientSection/`). Search (`images.search.ts`): `album` (`private` ·
`lhr`; General when absent) and `appointment` (a visit id, or `none`; every photo when absent).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess` through `shared/hooks/usePhotoAccess/`: the Private album for Doctor,
Admin and Owner (`S:40`; AMBER A-F9) — a member without it following `?album=private` gets the
permission toast and General — upload by Patients create, Photo details by edit, delete by delete.
Registered in `src/app/routes/routeTree.tsx` through the file's one lazy module
(`../patient-id.sections.ts`).

## The section (L-44)

- **Toolbar** (`components/PhotoToolbar/`): the album tabs General · Private · LHR on the shared
  segmented track, "3 photos", the visit filter "All photos ⌄" ("All photos" · "Not attached to a
  visit" · each visit with photos), the S / M / L radios — the size is a device pref
  (`useDevicePrefsStore.photoSize`).
- **Grid** (`components/PhotoGrid/`): a group per day ("24 Sep" / "Today", "3 photos · 24 Sep ·
  Hydrafacial"), square tiles at 110 / 160 / 230px with the body-part pill and the caption bar
  (Edit and Delete at M and L; shown on hover where hover exists). A tile opens the viewer
  (`$imageId/`), Edit opens Photo details (`$imageId/edit/`), Delete the reason confirm ("Wrong
  patient" · "Blurry / retake" · "Duplicate" · "Other"; "Photo deleted" with Undo).
- **Paging:** 12 per album, then "Load more · 4 left" adds 12. The contract pages by 60 and has
  no per-album totals (a backend request), so the read is the patient's photos at once
  (`@/shared/hooks/usePatientPhotos/`).
- **Upload:** files dropped on the section (the dashed outline 8px inside), "Upload images" and
  the Add menu's "Photo" go through the shared upload tray into the album on screen —
  "2 photos uploaded to General" (`../shared/hooks/usePatientPhotoUpload/`). A drop with no image
  says "Drop image files".
- **Empty:** "No photos in General yet" · "Drag photos here or upload from your computer." ·
  "Upload images" (create only).

## Files

| File                                    | Responsibility                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `images.route.tsx`                      | Route marker — exports `Component` rendering `PatientImagesPage`.                            |
| `images.manifest.ts`                    | Manifest — `kind: 'layout'` over `$imageId`, permission `organization:read`, title "Photos". |
| `images.search.ts`                      | URL schema (`validateSearch`): `album`, `appointment`. Rides the entry chunk.                |
| `PatientImagesPage.tsx`                 | The section: toolbar, grid, paging, drop, the delete confirm; hosts the dialogs' `Outlet`.   |
| `components/PhotoToolbar/`              | Album tabs, count, visit filter, size radios.                                                |
| `components/PhotoGrid/`                 | Day groups and tiles.                                                                        |
| `shared/photo-looks.ts`                 | Album icons and tones, body-part tones, the S / M / L looks.                                 |
| `shared/photo-view.ts`                  | Album and visit filtering, day groups, the filter's visits, stepping through a list.         |
| `shared/components/PhotoThumb/`         | A photo, or its glyph when there is no file to show.                                         |
| `shared/components/PhotoDeleteConfirm/` | "Delete this photo?" with its reasons and Undo.                                              |
| `shared/hooks/usePhotoAccess/`          | What the member may do with the photos.                                                      |
| `shared/hooks/usePhotoDayLabel/`        | "Today" / "24 Sep" / "24 Sep 2025".                                                          |
| `shared/hooks/useMissingPhoto/`         | "Photo not found" for a photo that is gone.                                                  |
| `$imageId/`                             | The photo viewer — see its overview.                                                         |

## Test ids

`patient-section-images` — the section's root; `patient-photos` (the drop zone),
`patient-photos-tab-<album>`, `patient-photos-visit-filter`, `patient-photos-size-<size>`,
`patient-photos-day`, `patient-photo-tile`, `patient-photo-edit`, `patient-photo-delete`,
`patient-photos-load-more`, `patient-photos-empty`, `patient-photos-input`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
