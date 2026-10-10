# `pages/organization/$organizationSlug/patients/$patientId/images/$imageId` — Photo viewer

Route: `/organization/$organizationSlug/patients/$patientId/images/$imageId` (`S:40`; KICKOFF
§6.6 Photo viewer) — a full-screen dialog over the Photos section, keeping its
`?album=&appointment=`.

Gated by the file layout (membership, the `clinic-patients` module, the org status); the photo's
read (`GET /app/patients/:patient_id/images/:patient_image_id`, standing in with a cached page's
copy while it runs) answers 404 for a deleted or unknown photo and for one in the Private album
without `patient:private_album:read` — "Photo not found · it may have been deleted" — and the
viewer goes back to Photos (any other failure: its own message). Registered in `src/app/routes/routeTree.tsx` under the Photos
route, through the file's one lazy module (`../../patient-id.sections.ts`).

## The viewer (L-44)

Full screen on `overlay/94`, fading in 150ms, in the light-pinned scope (it keeps the light ramp
in dark mode): the 56px bar — the photo's name over "Face · Before · 24 Sep · General", "2 of 6"
(the server's total), Edit details and Delete photo (40px round, `patient:update`), Close — then
the stage `min(92%, 1100px) × 92%`, then the 64px hint row ("← → browse" · "Esc close"). It
browses the photo's album under the section's visit filter (its whole album when the filter
leaves it out) — the section's cached pages; ‹ › and ← → replace the URL with the next photo; a
step past the photos read reads the next page first; the ends wrap once every page is read. Esc
and × close back to Photos; a click outside does not. Delete runs the reason confirm and the
viewer leaves once it lands.

**B1 (Q4):** nothing turns a `file_key` into a URL, so the stage shows the image glyph
(`../../shared/components/PhotoThumb/`), the file's name and "Preview not available" — the photo
is known by its names and dates only. With no pixels there is nothing to zoom, pan, pinch or
swipe: no zoom group, no `+ − 0` keys and no hints for them.

## Files

| File                         | Responsibility                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `image-id.route.tsx`         | Route marker — exports `Component` rendering `PatientPhotoViewerPage`.                      |
| `image-id.manifest.ts`       | Manifest — `kind: 'layout'` over `edit` (Photo details, registered beside it under Photos). |
| `PatientPhotoViewerPage.tsx` | The photo the URL names, its list, the links, the missing photo, the delete.                |
| `components/PhotoViewer/`    | The overlay: bar, the stage, ‹ ›, hints, keys.                                              |
| `edit/`                      | Photo details — see its overview.                                                           |

## Test ids

`patient-photo-viewer` and its parts `patient-photo-viewer-<stage|previous|next|edit|delete|close>`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
