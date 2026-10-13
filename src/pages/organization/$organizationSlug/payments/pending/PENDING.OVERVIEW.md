# `pages/organization/$organizationSlug/payments/pending` — Pending

Route: `/organization/$organizationSlug/payments/pending` (`S:88`). The money the clinic
still has to give back or take — pending credits — as the Payments room's second tab
(KICKOFF §6.9), on clinozy-be (`/app/pending-credits`, ROUTE #136; D81).

A page of its own: a child folder of the Payments island on disk, registered as a **sibling** of
the ledger in `app/routes/routeTree.tsx` (`path: 'payments/pending'` under the org shell),
so the ledger never renders under it. Gated like the room — membership
(`organization:read`) and the `app-payments` module, then `requireOrgStatus`; in-room
access is the member's own `payment:*` codes (`usePaymentAccess`; a View-as preview reads
the previewed role's matrix).

## The screen (L-39)

The room's toolbar (`../shared/components/PaymentsToolbar/`) with Pending current: search
("Person, supplier or CR-" — `q` finds the person, a supplier's name or a `CR-` number, D81),
saved views, Filters (Which way · State · Created), Columns, "Day close", and "Add pending"
with a "⌄" menu — Give ("We pay a patient or party back") and Take ("A patient or party pays
us") — which opens Add pending on that way (`?direction=`), for `payment:create`. Under it the
shared `DataTable` over `useCreditList` (`GET /app/pending-credits`, 50 a page, infinite
scroll): Ref · Who · Which way · Amount · Why · Since · State · By, newest first, nothing
sorts; an open credit's edge is its way's tone (Give blush, Take sky), a settled one grey. Who
carries the meta line, Amount is the phone's key column; "₹50 adjusted" sits under a
part-settled amount (`settled_amount`). Why's sub line names the link the API serves —
"From a ledger entry" (`source_payment_id`), "For an invoice" (`invoice_id`), else "By hand":
the API serves the links' ids, not their numbers (PAY-G2), and Pending reads nothing per row.
State is "Open", "Returned", "Received" or "Adjusted", "· Today" for one settled today. By is
who added it — `created_by_membership_id` through the team directory, as the ledger's By.
Money is rupees as the API sends it (`useRupeeFormat`).

What a credit offers, by the codes: an open credit — Got it back (`payment:create`); Give back
and, for a patient's Give credit, Use on next bill — money going back, so `payment:create` and
`payment:delete` (clinozy-be D83 (1): Owner, Admin, Accountant; `usePaymentAccess().canGiveBack`);
while nothing of it is settled,
Edit (`payment:update`) and Delete (`payment:delete`) — the API keeps a credit as it is from
its first settlement (`409 credit_settled`). A click opens Edit pending on a credit nothing
has settled; a part-settled one answers "CR-1 · ₹50 settled · it can’t change now"; a
settled one stays. Delete is the shared reason confirm — "Delete this pending?", the party in
the grey pill — with Undo for 10s (`POST …/restore`). The filters and search live in the URL
(`pending.search.ts`); "Nothing pending" offers Add pending; a first read that fails shows
the error in place, with Retry.

## Dialog routes

Two URL-driven dialogs (D24), each rendering nothing — this page reads the URL
(`hooks/usePendingDialogRoute/`):

- `create/` — Add pending; Which way comes from Pending's own `direction` when it names
  one (`S:89`). Without `payment:create` the link lands back on Pending with the permission
  toast.
- `$creditId/edit/` — Edit pending while nothing of the credit is settled (view only without
  `payment:update`); a settled credit goes back with "CR-1 · Received", a part-settled one
  with "CR-1 · ₹50 settled · it can’t change now", an unknown one with "Pending not found ·
  it may have been deleted" (`S:115`).

**Add pending / Edit pending** (`components/CreditDrawer/`, L-39c) — 680px, stacked
("Back"), in the way's tone, in two steps: "Which way" — Give / Take (switching drops the
reason), Who (the clinic's people from `GET /app/contacts`, then its stock vendors and
Medical suppliers, or a typed name, "Add “q”" — a person is sent as `contact_id`, a supplier
as `party_name`), Amount (₹, sent in rupees) — and "Why" — the way's Reason chips (sent as the
chip's key; "Other" as its note's text), For invoice (the person's invoices, `GET
/app/invoices?contact_id=`; "optional · links the credit to a bill"), Settle by (a task falls
due that day), Note (required for "Other"). Save checks who, an amount, a reason and "Other"'s
note in that order: "CR-3 saved · give ₹500 to Tanvi Shah"; an edit sends only what changed
with the read's `updated_at` — "CR-1 updated". A save over a newer change (`409
record_changed`) offers Reload, which reads the credit again and starts the form over on it
(`useEditingRecord`); part of it settled meanwhile (`409 credit_settled`) turns the drawer
view only. The server's field errors land on their fields.

## Settling a credit

- **Give back / Got it back** — the shared `SettleCreditDrawer` (component state, no URL),
  840px: Branch (two or more open branches), Date (today; an earlier day must still be open
  at that branch) and the Mode · Amount rows, opening on everything left (`left_amount`) in
  UPI: "Return ₹500" / "Record ₹800", at most what is owed — `POST …/settle` `{method: money,
amount, branch_id, splits, paid_at?}`. A part leaves the rest open ("₹X adjusted"). A
  give-back on a credit for an invoice is a refund with its credit note (at most what the
  invoice has paid, `409 more_than_paid`). A closed day (`409 day_closed`) is said on the
  Date. The toast names the entry it wrote: "₹500 given back to Tanvi Shah · PAY-6 · CN-003".
- **Use on next bill** (`hooks/useCreditOnBill/`, Q-G9) — a patient's open Give credit goes
  on their oldest invoice with a due (read fresh), what is left at most the due, as a
  Credit-mode receipt — `{method: use_on_bill, amount, invoice_id}` only: it lands at that
  invoice's branch, now — "₹500 of CR-2 adjusted on invoice #5"; the row then "Adjusted" (or
  "₹X adjusted" in part). Nothing due says so and writes nothing. A closed day at that
  branch (`409 day_closed`), a due that changed (`more_than_due`) and a credit settled
  meanwhile (`credit_closed`) each say so in the room's words.

## Files

| File                              | Responsibility                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending.route.tsx`               | Route marker — exports `Component` rendering `PendingPage`.                                                                                                                                                                                 |
| `pending.manifest.ts`             | Manifest — `kind: 'layout'` over `create` and `$creditId/edit`, permission `organization:read`, module `app-payments`.                                                                                                                      |
| `pending.search.ts`               | URL schema (`validateSearch`): `direction`, `status`, `created`, `q`. Rides the entry chunk.                                                                                                                                                |
| `pending.constants.ts`            | The Filters fields (page-only, kept off the entry). The copy is the room's (`PAYMENTS_KEYS`).                                                                                                                                               |
| `PendingPage.tsx`                 | The Pending tab — toolbar, table, states (loading, empty, error in place), the row actions by code, the delete confirm and the settle drawer; reads the dialog routes and hosts their `Outlet`. Owns `data-testid="payments-pending-page"`. |
| `components/PendingCells/`        | The cells and their wording: Ref, Who, Which way, Amount with "adjusted", Why with its source, Since, State; whether a credit can still change and why not.                                                                                 |
| `components/CreditDeleteConfirm/` | Delete a credit: the reason confirm, the optimistic delete, its Undo, and the `credit_settled` refusal.                                                                                                                                     |
| `components/CreditDrawer/`        | Add pending / Edit pending: the form's rules (`components/CreditDrawer/credit-form.ts`), the Who and For invoice rows (`components/CreditDrawer/credit-options.ts`), the two steps' fields, the save, Reload and the refusals.              |
| `hooks/useCreditOnBill/`          | Use on next bill: which credits offer it, the fresh invoice read, the nothing-due check, the settle, its toast and its refusals.                                                                                                            |
| `hooks/usePendingTable/`          | The columns (tracks, folds, By), hidden columns, the row tone.                                                                                                                                                                              |
| `hooks/usePendingDialogRoute/`    | Which dialog the URL opens, the settled and permission refusals, the close back onto Pending with its own params.                                                                                                                           |
| `__tests__/integration/`          | `__tests__/integration/pending-test-router.tsx` — the Pending routes for the test member holding chosen `payment:*` codes (no View-as).                                                                                                     |
| `create/`, `$creditId/edit/`      | The dialog-route islands — see their overviews.                                                                                                                                                                                             |

## Test ids

`payments-pending-page`; the shared toolbar's and table's under the `payments-pending` table
id — `payments-pending-toolbar`, `payments-pending-tab-<ledger|pending>`,
`payments-pending-filters-trigger`, `payments-pending-add`, `payments-pending-new-menu`,
`payments-pending-table-row`, `payments-pending-row-action-<settle|use-on-bill|edit|delete>`;
the drawer the dialog routes open: `credit-drawer`; the give-back drawer:
`settle-credit-drawer` — with `-branch-<branchId>` and `-date`
(`docs/reference/e2e-testids-inventory.md` › Payments).
