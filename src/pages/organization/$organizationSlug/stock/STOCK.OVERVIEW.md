# `pages/organization/$organizationSlug/stock` — Clinic stock

Route: `/organization/$organizationSlug/stock`. Clinic consumables and equipment used in procedures · not for sale (KICKOFF §6.8).

Gated like every clinic room: membership (`organization:read`) and the `clinic-stock`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                 | Responsibility                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `stock.route.tsx`    | Route marker — exports `Component` rendering `StockLayout`.                                              |
| `stock.manifest.ts`  | Manifest — `kind: 'layout'`, permission `organization:read`, module `clinic-stock`, nav section `stock`. |
| `stock.constants.ts` | `STOCK_NS` / `STOCK_KEYS` (the `clinic-stock` namespace).                                                |
| `StockLayout.tsx`    | Layout over the tab routes (`<Outlet />`).                                                               |
