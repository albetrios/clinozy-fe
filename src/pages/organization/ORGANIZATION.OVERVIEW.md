# `pages/organization` — Organization picker

Route: `/organization`. Lists the signed-in user's organizations; selecting one enters
`/organization/$organizationSlug/dashboard`. The `/` resolver redirects here when the user has
organizations but no (valid) last-used one. Spec: `docs/reference/routing-and-tenancy.md`.

## Files

| File                         | Responsibility                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `organization.route.tsx`     | Route marker — exports `Component` rendering `OrganizationPickerPage`.                       |
| `organization.manifest.ts`   | Manifest — `kind: 'leaf'`, `children: []`, `permission: null` (bespoke guards in routeTree). |
| `OrganizationPickerPage.tsx` | Picker UI — organization cards + create dialog. Owns `data-testid="organization-page"`.      |

## Children

The manifest is `kind: 'leaf'` with `children: []` — the picker has no route children.
`src/app/routes/routeTree.tsx` mounts the picker and the `$organizationSlug` shell as
**siblings**; the on-disk nesting below mirrors the **URL tree**, not the route component
tree. The layout boundary is `$organizationSlug/OrganizationLayout.tsx`.

| Segment             | URL                               | Relationship                                                                                 |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `$organizationSlug` | `/organization/$organizationSlug` | Sibling route in routeTree (disk nesting mirrors the URL tree, not the route component tree) |
