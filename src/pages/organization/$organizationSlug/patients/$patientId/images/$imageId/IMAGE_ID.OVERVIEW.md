# `pages/organization/$organizationSlug/patients/$patientId/images/$imageId` — Photo viewer

Route: `/organization/$organizationSlug/patients/$patientId/images/$imageId` (`S:40`; KICKOFF
§6.6 Photo viewer) — a full-screen dialog over the Photos section, keeping its
`?album=&appointment=`.

Gated by the file layout (membership, the `clinic-patients` module, the org status); the photo
read leaves the Private album out for a member who can't open it (Doctor, Admin, Owner; `S:40`),
so such a photo — like a deleted or unknown one — says "Photo not found · it may have been
deleted" and goes back to Photos. Registered in `src/app/routes/routeTree.tsx` under the Photos
route, through the file's one lazy module (`../../patient-id.sections.ts`).

## The viewer (L-44)

Full screen on `overlay/94`, fading in 150ms, in the light-pinned scope (it keeps the light ramp
in dark mode): the 56px bar — the photo's name over "Face · 24 Sep · General", "2 of 6", the zoom
group "−" · "100%" · "+", Edit details and Delete photo (40px round, by Patients edit / delete),
Close — then the photo `min(92%, 1100px) × 92%`, then the 64px hint row. It browses the photo's
album under the section's visit filter (its whole album when the filter leaves it out); ‹ › and
← → replace the URL with the next photo, wrapping. Zoom 100–600%: ×1.25 a step, the wheel ×1.12,
double-click 100% ↔ 200%, `0` resets; a drag pans once zoomed. On touch the build adds a
two-finger pinch and a one-finger swipe that browses at 100% (AMBER A-F10). Esc and × close back
to Photos; a click outside does not. Delete runs the reason confirm and the viewer leaves once it
lands.

## Files

| File                         | Responsibility                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `image-id.route.tsx`         | Route marker — exports `Component` rendering `PatientPhotoViewerPage`.                      |
| `image-id.manifest.ts`       | Manifest — `kind: 'layout'` over `edit` (Photo details, registered beside it under Photos). |
| `PatientPhotoViewerPage.tsx` | The photo the URL names, its list, the links, the missing photo, the delete.                |
| `components/PhotoViewer/`    | The overlay: bar, zoom group, photo, ‹ ›, hints, keys.                                      |
| `hooks/usePhotoZoom/`        | Zoom, pan, wheel, double-click, pinch and swipe.                                            |
| `edit/`                      | Photo details — see its overview.                                                           |

## Test ids

`patient-photo-viewer` and its parts `patient-photo-viewer-<stage|previous|next|zoom-out|zoom-reset|zoom-in|edit|delete|close>`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
