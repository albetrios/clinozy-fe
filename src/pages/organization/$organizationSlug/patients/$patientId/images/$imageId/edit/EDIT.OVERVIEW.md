# `pages/organization/$organizationSlug/patients/$patientId/images/$imageId/edit` — Photo details

Route: `/organization/$organizationSlug/patients/$patientId/images/$imageId/edit` (`S:41`;
KICKOFF §6.6 Drawers) — the 560px drawer over the Photos section, keeping its
`?album=&appointment=`.

Gated by the file layout; Photo details needs `patient:update` — without it the drawer reads only
(it opens once access has answered). A photo the API does not answer says "Photo not found · it
may have been deleted" and goes back to Photos.
Registered in `src/app/routes/routeTree.tsx` beside the viewer under the Photos route, through
the file's one lazy module (`../../../patient-id.sections.ts`).

## The drawer (L-44)

"Photo details" with "Optional · name, date and body part help you find it later": Name (≤60,
"e.g. Left cheek before peel"; stored as the `caption`, shown over the filed name; a blank one
keeps the old), Date (`taken_on`, none in the future), Album (General stone · Private lav · LHR
blush — Private with `patient:private_album:read`), Stage (Before · After, optional — the API's
`stage`), Body part (optional; the API's fifteen `body_part` values, M33), Visit ("Not attached"
and the last 8 checked-in or completed visits — the only ones the API takes). "Save details" sends
what changed — `PATCH /app/patients/:patient_id/images/:patient_image_id` with the read's
`updated_at` — "Photo details saved" — and goes back to Photos. A 400 outlines its field; a stale
save (`409 record_changed`) offers "Reload", which reads the photo again and starts the form from
it.

## Files

| File                          | Responsibility                                                          |
| ----------------------------- | ----------------------------------------------------------------------- |
| `edit.route.tsx`              | Route marker — exports `Component` rendering `PatientPhotoDetailsPage`. |
| `edit.manifest.ts`            | Manifest — `kind: 'leaf'`, test id `patient-photo-details`.             |
| `PatientPhotoDetailsPage.tsx` | The photo's read, the form, the save.                                   |

## Test ids

`patient-photo-details` (the shared drawer's root, its `-save`, `-close` …) and its fields
`patient-photo-details-<name|date|album-<album>|stage-<stage>|body-part-<part>|visit-<id|none>>`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
