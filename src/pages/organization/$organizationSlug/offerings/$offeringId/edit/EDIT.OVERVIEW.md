# `pages/organization/$organizationSlug/offerings/$offeringId/edit` — Edit offering

Route: `/organization/$organizationSlug/offerings/$offeringId/edit` — a URL-driven dialog
over the Offerings tab (KICKOFF §4, D24; `S:100`). The route renders nothing: the Offerings
page reads the URL and opens the offering's drawer over the list, so a refresh or a shared
link reopens it. A row click and a row's Edit come here. The `$offeringId` segment has no
page of its own — its folder holds only this island. Gated like the room — membership
(`organization:read`) and the `clinic-offerings` module, then `requireOrgStatus`. The route
stays reachable for a viewer: without Offerings Edit the drawer is view only ("View only ·
your role can’t change this"), and without Offerings Delete it has no Delete. An id that names
no offering (a stale link, a deleted offering) goes back to the list in place with "Offering
not found · it may have been deleted" (`S:115`). The drawer is the room's `OfferingDrawer`
(`../../components/OfferingDrawer/`), opened by the page through
`../../hooks/useOfferingsDialogRoute/`; saving, deleting or closing it returns to the list with
the list's own params.

## Files

| File                   | Responsibility                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `edit.route.tsx`       | Route marker — exports `Component` rendering `EditOfferingPage`.                                             |
| `edit.manifest.ts`     | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-offerings`, title "Edit offering". |
| `EditOfferingPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Offerings page.                        |

## Test ids

`offering-drawer` — the drawer the Offerings page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Offering drawer. The route renders no element of
its own (`tooling/validate/test-ids-allowlist.txt`).
