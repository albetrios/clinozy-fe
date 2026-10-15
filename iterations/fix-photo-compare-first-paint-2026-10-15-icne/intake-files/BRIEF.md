# Brief — the Photos route stops naming `?compare=` at start-up, so the first paint stays within budget

## What changes

The pull request carrying the photo comparison fails CI's bundle-size check: the first-paint
JavaScript ("Initial JS (entry + vendor)") measures 239.41 kB against its 239.4 kB limit — 6 bytes
over. The only code the branch still adds to the first paint is one line in the Photos route's
search validator (`validatePatientImagesSearch` in `images.search.ts`, which loads with the route
tree): `compare: textOf(search.compare) || undefined`.

1. The validator stops reading `compare`. The router passes an unvalidated search param through to
   the page (its search is not strict), and the page already reads the comparison's ids with
   `compareIdsOf`, which accepts any value.
2. `compare` stays in the route's search type, so links and navigation that open or close the
   comparison stay typed.

## Why

The size budget is a ratchet: it is lowered as the bundle shrinks and never raised to absorb growth.
`main` sits a few bytes under it, so the comparison must add nothing to the first paint.

## Affected screens, entities and routes

- Screens: the patient file's Photos comparison (`…/patients/$patientId/images?compare=`)
- Entities: none
- Routes: none

## Rules

- No behaviour changes: `?compare=` with 2–8 valid photo ids opens the comparison, anything else
  opens nothing, × and Close rewrite the param as before.
- The size limit is not raised.

## Acceptance criteria

- [ ] CI's `pnpm size` passes: Initial JS within 239.4 kB.
- [ ] The comparison opens, narrows and closes from the URL as before (the Photos page tests).
- [ ] The validator no longer returns `compare`; its test says so.

## Out of scope

Everything else in the comparison, the Overview, uploads and selection.
