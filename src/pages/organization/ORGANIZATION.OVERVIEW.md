# `pages/organization` — Organization picker

Route: `/organization`. Lists the signed-in user's organizations; selecting one enters
its home, `/organization/$organizationSlug` (the member's role home). The `/` resolver
redirects here when the user has organizations but no (valid) last-used one, and when the
active workspace is personal — a personal workspace has no clinic (D44), so the list and
"Create organization" are its way in. Spec: `docs/reference/routing-and-tenancy.md`.

**Invitations (clinozy-be launch D84).** Above the list, the person's pending invitations
(`GET /users/me/membership-invitations`): the clinic, the roles, who invited them and the
expiry, each with **Accept** (no token needed — the signed-in owner of the invited, verified
email) and **Decline** (after a confirm; the inviter is told). An invited person with no clinic
lands here **before** onboarding — the resolver sends them — and reads "You're invited", with
"Create my own organization instead" as the way out. A member of another clinic lands here too
while an invitation is pending (feat-choose-default-clinic), or reaches it from the switcher's
"Invited" rows. Accepting a first clinic hands off to `/`: onboarding's profile steps for
someone who has not finished it (never the create-a-clinic step), else the clinic's home.
Someone who already had a clinic stays here ("You joined …"), so they can choose which clinic
opens at sign-in and which to open now.

**The clinic that opens at sign-in (feat-choose-default-clinic).** With two or more clinics each
row carries a star before its chevron (`useSignInClinic`): it makes that clinic open at
sign-in, and on the default clinic — which also reads "Default" — goes back to the clinic used
last. A hint under the list says so. The row's link covers the whole row (`after:` layer); only
the star sits above it. A long clinic name wraps rather than being cut.

## Files

| File                         | Responsibility                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization.route.tsx`     | Route marker — exports `Component` rendering `OrganizationPickerPage`.                                                                                                                                                                                                                                                 |
| `organization.manifest.ts`   | Manifest — `kind: 'leaf'`, `children: []`, `permission: null` (bespoke guards in routeTree).                                                                                                                                                                                                                           |
| `OrganizationPickerPage.tsx` | Picker UI — the signed-out canvas (`PublicFrame`) and its 360px card: the pending invitations, the organizations as All sections rows (tone tile, name, slug, "Default" on the clinic that opens at sign-in, its star; the active one is the current row) + the create drawer. Owns `data-testid="organization-page"`. |
| `components/InvitationList/` | The pending invitations (D84): a row per invitation — clinic, roles · inviter, expiry, Accept / Decline (confirm) — and the accept / decline flow (`acceptInvitationAndOpenClinic`, `declineInvitation`).                                                                                                              |

## Children

The manifest is `kind: 'leaf'` with `children: []` — the picker has no route children.
`src/app/routes/routeTree.tsx` mounts the picker and the `$organizationSlug` shell as
**siblings**; the on-disk nesting below mirrors the **URL tree**, not the route component
tree. The layout boundary is `$organizationSlug/OrganizationLayout.tsx`.

| Segment             | URL                               | Relationship                                                                                 |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `$organizationSlug` | `/organization/$organizationSlug` | Sibling route in routeTree (disk nesting mirrors the URL tree, not the route component tree) |
