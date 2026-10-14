# `pages/organization/$organizationSlug/medical/sales/$saleId/return` — Return from patient

Route: `/organization/$organizationSlug/medical/sales/$saleId/return` — a URL-driven dialog over Medical › Sales (KICKOFF §4,
D24): Return from patient (`S:52`): what is coming back, the reason and the refund — or Store credit (MD33); only on a sale paid in full (MD24), for `payment:delete` (MD23). The route renders nothing: the Sales page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                 | Responsibility                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `return.route.tsx`   | Route marker — exports `Component` rendering `SaleReturnPage`.                                                |
| `return.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-medical`, title "Return from patient". |
| `SaleReturnPage.tsx` | Renders nothing — the drawer mounts on the Sales page.                                                        |

## Test ids

`sale-return-drawer` — the drawer the Sales page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
