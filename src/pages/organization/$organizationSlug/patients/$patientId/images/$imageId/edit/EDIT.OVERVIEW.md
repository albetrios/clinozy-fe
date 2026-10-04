# `pages/organization/$organizationSlug/patients/$patientId/images/$imageId/edit` — Photo details

Route: `/organization/$organizationSlug/patients/$patientId/images/$imageId/edit` (`S:42`;
KICKOFF §6.6 Drawers) — the 560px drawer over the Photos section, keeping its
`?album=&appointment=`.

Gated by the file layout; Photo details needs Patients edit — without it the drawer reads only. A
photo that is gone says "Photo not found · it may have been deleted" and goes back to Photos.
Registered in `src/app/routes/routeTree.tsx` beside the viewer under the Photos route, through
the file's one lazy module (`../../../patient-id.sections.ts`).

## The drawer (L-44)

"Photo details" with "Optional · name, date and body part help you find it later": Name (≤60,
"e.g. Left cheek before peel"; stored as the caption, shown over the file name; a blank one keeps
the old), Date, Album (General stone · Private lav · LHR blush — Private for Doctor, Admin and
Owner only), Body part (optional; the design's Face · Scalp · Chest · Back · Underarm · Arms · Legs —
its Neck and Hands wait for the contract's `body_part`, a backend request), Visit ("Not attached"
and the last 8 visits). "Save details" saves what changed — "Photo details saved" — and goes back
to Photos.

## Files

| File                          | Responsibility                                                          |
| ----------------------------- | ----------------------------------------------------------------------- |
| `edit.route.tsx`              | Route marker — exports `Component` rendering `PatientPhotoDetailsPage`. |
| `edit.manifest.ts`            | Manifest — `kind: 'leaf'`, test id `patient-photo-details`.             |
| `PatientPhotoDetailsPage.tsx` | The photo's read, the form, the save.                                   |

## Test ids

`patient-photo-details` (the shared drawer's root, its `-save`, `-close` …) and its fields
`patient-photo-details-<name|date|album-<album>|body-part-<part>|visit-<id|none>>`
(`docs/reference/e2e-testids-inventory.md` › Patient file).
