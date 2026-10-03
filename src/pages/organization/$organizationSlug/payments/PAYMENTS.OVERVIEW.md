# `pages/organization/$organizationSlug/payments` — Payments

Route: `/organization/$organizationSlug/payments`. Collections, invoices and dues (KICKOFF §6.9).

Gated like every clinic room: membership (`organization:read`) and the `clinic-payments`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                    | Responsibility                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `payments.route.tsx`    | Route marker — exports `Component` rendering `PaymentsPage`.                                                 |
| `payments.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-payments`, nav section `payments`. |
| `payments.constants.ts` | `PAYMENTS_NS` / `PAYMENTS_KEYS` (the `payments` namespace).                                                  |
| `PaymentsPage.tsx`      | Room page. Owns `data-testid="payments-page"`.                                                               |
