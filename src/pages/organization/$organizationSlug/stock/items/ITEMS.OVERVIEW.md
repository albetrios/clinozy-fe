# `pages/organization/$organizationSlug/stock/items` — Clinic stock › Items

Route: `/organization/$organizationSlug/stock/items` — /stock/items — the room opens on Items. Same gates as
the Clinic stock room. Scaffolded with the route plumbing (L-12a); its screen is
built in its own ledger row.

## Files

| File                 | Responsibility                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| `items.route.tsx`    | Route marker — exports `Component` rendering `ItemsPage`.                         |
| `items.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-stock`. |
| `items.constants.ts` | `STOCK_ITEMS_NS` / `STOCK_ITEMS_KEYS` (the `clinic-stock` namespace).             |
| `ItemsPage.tsx`      | Tab page. Owns `data-testid="stock-items-page"`.                                  |
