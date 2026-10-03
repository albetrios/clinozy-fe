# `pages/organization/$organizationSlug/medical/sales` — Medical › Sales

Route: `/organization/$organizationSlug/medical/sales` — /medical/sales — the room opens on Sales (D25). Same gates as
the Medical room. Scaffolded with the route plumbing (L-12a); its screen is
built in its own ledger row.

## Files

| File                 | Responsibility                                                                      |
| -------------------- | ----------------------------------------------------------------------------------- |
| `sales.route.tsx`    | Route marker — exports `Component` rendering `SalesPage`.                           |
| `sales.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-medical`. |
| `sales.constants.ts` | `MEDICAL_SALES_NS` / `MEDICAL_SALES_KEYS` (the `medical` namespace).                |
| `SalesPage.tsx`      | Tab page. Owns `data-testid="medical-sales-page"`.                                  |
