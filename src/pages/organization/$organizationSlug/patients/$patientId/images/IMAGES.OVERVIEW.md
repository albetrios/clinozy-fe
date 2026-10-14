# `pages/organization/$organizationSlug/patients/$patientId/images` — Photos

Route: `/organization/$organizationSlug/patients/$patientId/images` — a section of the patient
file (KICKOFF §6.6, D26; H:827–832; `iterations/launch-2026-09-30-jxmr/intake-files/patient-file.md`).
It renders in the file layout's content column through the family's section frame
(`../shared/components/PatientSection/`). Search (`images.search.ts`): `album` (`private` ·
`lhr`; General when absent), `appointment` (a visit id, or `none`; every photo when absent) and
`compare` (2–8 photo ids, comma-joined — the comparison; fewer than two drop it, more than eight
keep the first eight).

Gated by the file layout (membership, the `app-patients` module, the org status, the
section's `patient:clinical_record:read`); in-room access is `useAppAccess` through
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
- **The photo (clinozy-be D86):** each tile shows the photo from its `file_url`
  (`../shared/components/PhotoThumb/`) under its body part and stage, its name and day fading in on
  hover; a link lives 15 minutes, so the list reads again every 5 and on the tab's return, keeping
  a link while it has life left (`@/shared/api/app/file-links.ts`). A photo whose upload is gone
  shows the image glyph with its name and day always on.

## The section (L-44)

- **Toolbar** (`components/PhotoToolbar/`): the album tabs General · Private · LHR on the shared
  segmented track, each with the server's count, "3 photos", the visit filter "All photos ⌄"
  ("All photos" · "Not attached to a visit" · each visit a photo can be filed under, "#2790 ·
  Completed"), the S / M / L radios — the size is a device pref
  (`useDevicePrefsStore.photoSize`). The design's per-visit photo count goes: the API counts by
  album only (G4).
- **Grid** (`components/PhotoGrid/`): a group per day, named by the rooms' one time rule
  (`useAppClock().day`: "Today", "Yesterday", "Mon", "24 Sep") with its visit's service, square
  tiles at 110 / 160 / 230px with the body-part and stage pills, a check circle at the top end
  and the caption bar (always shown; Edit and Delete at M and L). The groups flow side by side
  and wrap, each only as wide as its photos, so single-photo visits share a row
  (change-patient-overview-photos). The design's "3 photos · …" per day goes (a day can run across
  pages). A tile opens the viewer (`$imageId/`), Edit opens Photo details (`$imageId/edit/`),
  Delete the reason confirm ("Wrong patient" → `mistake` · "Blurry / retake" → `not_needed`, Q24 ·
  "Duplicate" · "Other" with its note; "Photo deleted" with Undo).
- **Paging:** a page of 12, then "Load more · 4 left" reads the next page.
- **Upload** (change-patient-overview-photos): for a member who uploads, the strip above the
  grid (`components/PhotoUploadZone/`) — "Drop photos here", "or paste a copied image · JPG or PNG
  up to 10 MB · Adds to General", "Choose photos" and, on a touch device, "Take photo" (the
  camera input, `capture="environment"`). Files dropped on the section (the dashed outline 8px
  inside and the veil "Drop to add to General", `../shared/hooks/usePhotoDrop/`), an image pasted
  on it outside a field and a dialog (`../shared/hooks/usePhotoPaste/`), "Upload images" and the
  Add menu's "Photo" go through the shared upload tray into the album on screen — "2 photos
  uploaded to General" (`../shared/hooks/usePatientPhotoUpload/`). A drop with no JPG or PNG says
  "Drop image files" (the API files no other type).
- **Selection** (`hooks/usePhotoSelection/`, `components/PhotoSelectionBar/`): "Select" in the
  toolbar or a tile's check circle turns it on; a tap then picks (a ring and a filled check) and
  Edit / Delete step aside. At most eight — the ninth says "You can compare up to 8 photos at a
  time". The bar pinned to the bottom (above the phone's tab bar): × , "3 selected", "Pick 2 to 8
  photos to compare", Clear, Compare (from two). Esc or "Done" leaves.
- **Comparison** (`components/PhotoCompare/`, `?compare=`): full screen on the viewer's dark
  chrome — "Compare photos", "4 photos · 23 Jul – Today", One row ↔ Grid (one row up to four, a
  grid from five; a phone shows two columns), the zoom group and Close; the photos oldest first
  (`shared/photo-compare.ts`), each with its place and day, its pills and "Start" / "+21 days"
  from the first. **One zoom for every panel** (`shared/hooks/usePhotoZoom/`): the wheel, the
  buttons, a double-click, a pinch or a drag on any panel moves them all. × takes one out while
  more than two remain; Esc and Back close it. Each photo is read by its id
  (`usePatientPhotosByIds`, the viewer's query and cache).
- **Empty / failed:** for a member who uploads, the empty album is the drop zone — the Photos art,
  "No photos in General yet", the upload line and "Choose photos"; for a reader, "No photos in
  General yet" · "Drag photos here or upload from your computer."; a first read that fails says
  so with Retry (and the list toast).

## Files

| File                                    | Responsibility                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `images.route.tsx`                      | Route marker — exports `Component` rendering `PatientImagesPage`.                                                                    |
| `images.manifest.ts`                    | Manifest — `kind: 'layout'` over `$imageId`, permission `organization:read`, title "Photos".                                         |
| `images.search.ts`                      | URL schema (`validateSearch`): `album`, `appointment`, `compare` (`compareIdsOf`, `PHOTO_COMPARE`). Rides the entry chunk.           |
| `PatientImagesPage.tsx`                 | The section: toolbar, upload, grid, paging, drop, paste, selection, the delete confirm, the comparison; hosts the dialogs' `Outlet`. |
| `components/PhotoToolbar/`              | Album tabs, count, visit filter, Select / Done, size radios.                                                                         |
| `components/PhotoGrid/`                 | Day groups (side by side) and tiles, with the check circle and select mode.                                                          |
| `components/PhotoUploadZone/`           | The upload strip and the empty album's drop zone.                                                                                    |
| `components/PhotoSelectionBar/`         | The selection bar: count, hint, Clear, Compare.                                                                                      |
| `components/PhotoCompare/`              | The comparison (`?compare=`): panels, One row ↔ Grid, the shared zoom.                                                               |
| `hooks/usePhotoSelection/`              | The picks (at most eight), Esc to leave.                                                                                             |
| `shared/photo-looks.ts`                 | Album icons and tones, body-part and stage tones, the S / M / L looks.                                                               |
| `shared/photo-compare.ts`               | The comparison's order, "+N days", layouts and columns.                                                                              |
| `shared/components/PhotoChrome/`        | The dark chrome's round button and zoom group (the viewer's and the comparison's).                                                   |
| `shared/hooks/usePhotoZoom/`            | Zoom and pan — one photo in the viewer, every panel at once in the comparison.                                                       |
| `shared/photo-view.ts`                  | The read's params, the visit filter, day groups, the filter's visits, stepping a list.                                               |
| `shared/components/PhotoDeleteConfirm/` | "Delete this photo?" with its reasons and Undo.                                                                                      |
| `shared/hooks/usePhotoAccess/`          | What the member may do with the photos.                                                                                              |
| `shared/hooks/usePhotoVisits/`          | The visits a photo can be filed under.                                                                                               |
| `shared/hooks/useMissingPhoto/`         | "Photo not found" (or the failure) for a photo the API does not answer.                                                              |
| `$imageId/`                             | The photo viewer — see its overview.                                                                                                 |
| `__tests__/integration/`                | The tests' router (`__tests__/integration/photos-test-router.tsx`) and in-memory API (`__tests__/integration/photo-api-double.ts`).  |

A tile's photo is the family's `../shared/components/PhotoThumb/` (the viewer's stage and the
Overview's Photos card show it too).

## Test ids

`patient-section-images` — the section's root; `patient-photos` (the drop zone),
`patient-photos-tab-<album>`, `patient-photos-visit-filter`, `patient-photos-size-<size>`,
`patient-photos-day`, `patient-photo-tile`, `patient-photo-edit`, `patient-photo-delete`,
`patient-photos-load-more`, `patient-photos-empty`, `patient-photos-input`, `patient-photos-camera`;
the upload's `patient-photos-upload`, `patient-photos-choose`, `patient-photos-take`,
`patient-photos-drop-veil`; selection's `patient-photos-select`, `patient-photo-check`,
`patient-photos-selection` (`-count`, `-clear`, `-done`), `patient-photos-compare`; the
comparison's `patient-photo-compare` (`-stage`, `-panel`, `-pending`, `-since`, `-remove`,
`-layout`, `-layout-<row|grid>`, `-zoom-out`, `-zoom-reset`, `-zoom-in`, `-close`); the delete's
`confirm-reason-<mistake|not-needed|duplicate|other>` (`docs/reference/e2e-testids-inventory.md` ›
Patient file).
