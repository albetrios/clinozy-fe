# `pages/organization` — Organization picker

Route: `/organization`. Lists the signed-in user's organizations; selecting one enters
its home, `/organization/$organizationSlug` (the member's role home). The `/` resolver
redirects here when the user has organizations but no (valid) last-used one, and when the
active workspace is personal — a personal workspace has no clinic (D44), so the list and
"Create organization" are its way in. Spec: `docs/reference/routing-and-tenancy.md`.

## Files

| File                         | Responsibility                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organization.route.tsx`     | Route marker — exports `Component` rendering `OrganizationPickerPage`.                                                                                                                                                               |
| `organization.manifest.ts`   | Manifest — `kind: 'leaf'`, `children: []`, `permission: null` (bespoke guards in routeTree).                                                                                                                                         |
| `OrganizationPickerPage.tsx` | Picker UI — the signed-out canvas (`PublicFrame`) and its 360px card: the organizations as All sections rows (tone tile, name, slug; the active one is the current row) + the create drawer. Owns `data-testid="organization-page"`. |

## Children

The manifest is `kind: 'leaf'` with `children: []` — the picker has no route children.
`src/app/routes/routeTree.tsx` mounts the picker and the `$organizationSlug` shell as
**siblings**; the on-disk nesting below mirrors the **URL tree**, not the route component
tree. The layout boundary is `$organizationSlug/OrganizationLayout.tsx`.

| Segment             | URL                               | Relationship                                                                                 |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `$organizationSlug` | `/organization/$organizationSlug` | Sibling route in routeTree (disk nesting mirrors the URL tree, not the route component tree) |
