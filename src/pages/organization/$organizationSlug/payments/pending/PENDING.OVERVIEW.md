# `pages/organization/$organizationSlug/payments/pending` — Pending

Route: `/organization/$organizationSlug/payments/pending` (`S:88`). The money the clinic
still has to give back or take — pending credits — as the Payments room's second tab
(KICKOFF §6.9).

A page of its own: a child folder of the Payments island on disk, registered as a **sibling** of
the ledger in `app/routes/routeTree.tsx` (`path: 'payments/pending'` under the org shell),
so the ledger never renders under it. Gated like the room — membership
(`organization:read`) and the `clinic-payments` module, then `requireOrgStatus`; in-room
access is `useClinicAccess`.

## The screen (L-39)

The room's toolbar (`../shared/components/PaymentsToolbar/`) with Pending current: search,
saved views, Filters (Which way · State · Created), Columns, "Day close", and "Add pending"
with a "⌄" menu — Give ("We pay a patient or party back") and Take ("A patient or party
pays us") — which opens Add pending on that way (`?direction=`). Under it the shared
`DataTable`: Ref · Who · Which way · Amount · Why · Since · State, newest first, nothing
sorts; an open credit's edge is its way's tone (Give blush, Take sky), a settled one grey.
Who carries the meta line, Amount is the phone's key column; "₹200 adjusted" sits under a
part-settled amount.

An open credit opens Edit pending and offers Edit and Delete; a settled one stays. Delete
is the shared reason confirm — "Delete this pending?", the party in the grey pill — with
Undo for 10s. The filters and search live in the URL (`pending.search.ts`); "Nothing
pending" offers Add pending.

## Dialog routes

Two URL-driven dialogs (D24), each rendering nothing — this page reads the URL
(`hooks/usePendingDialogRoute/`):

- `create/` — Add pending; Which way comes from Pending's own `direction` when it names
  one (`S:89`).
- `$creditId/edit/` — Edit pending while the credit is open; a settled credit goes back
  with "CR-1 · Received", an unknown one with "Pending not found · it may have been deleted"
  (`S:115`).

The drawers land with L-39c; until then the routes open nothing.

## Files

| File                              | Responsibility                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pending.route.tsx`               | Route marker — exports `Component` rendering `PendingPage`.                                                                                                              |
| `pending.manifest.ts`             | Manifest — `kind: 'layout'` over `create` and `$creditId/edit`, permission `organization:read`, module `clinic-payments`.                                                |
| `pending.search.ts`               | URL schema (`validateSearch`): `direction`, `status`, `created`, `q`. Rides the entry chunk.                                                                             |
| `pending.constants.ts`            | The Filters fields (page-only, kept off the entry). The copy is the room's (`PAYMENTS_KEYS`).                                                                            |
| `PendingPage.tsx`                 | The Pending tab — toolbar, table, states, row actions, the delete confirm; reads the dialog routes and hosts their `Outlet`. Owns `data-testid="payments-pending-page"`. |
| `components/PendingCells/`        | The cells and their wording: Ref, Who, Which way, Amount with "adjusted", Why with its source, Since, State.                                                             |
| `components/CreditDeleteConfirm/` | Delete a credit: the reason confirm, the optimistic delete and its Undo.                                                                                                 |
| `hooks/usePendingTable/`          | The columns (tracks, folds), hidden columns, the row tone.                                                                                                               |
| `hooks/usePendingDialogRoute/`    | Which dialog the URL opens, the settled and permission refusals, the close back onto Pending with its own params.                                                        |
| `create/`, `$creditId/edit/`      | The dialog-route islands — see their overviews.                                                                                                                          |

## Test ids

`payments-pending-page`; the shared toolbar's and table's under the `payments-pending` table
id — `payments-pending-toolbar`, `payments-pending-tab-<ledger|pending>`,
`payments-pending-filters-trigger`, `payments-pending-add`, `payments-pending-new-menu`,
`payments-pending-table-row`, `payments-pending-row-action-<edit|delete>`; the drawer the
dialog routes open: `credit-drawer` (`docs/reference/e2e-testids-inventory.md` › Payments).
