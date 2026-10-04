# `pages/organization/$organizationSlug/users/$userId/edit` — Edit user

Route: `/organization/$organizationSlug/users/$userId/edit` — the member drawer, a URL-driven
dialog over the Team (KICKOFF §4, §6.12, D24; `S:106`). `$userId` is the membership id:
clinozy-be keys every member write by membership (AMBER). The route renders nothing: the
Users page reads the URL and opens the drawer; an id the Team doesn't have — a stale link,
someone removed — leaves the Team with "User not found · it may have been deleted"
(`S:115`). The `$userId` folder has no page of its own: the schema has no `/users/$userId`
route.

Edit writes the membership's role (`useUpdateMemberRole` — Admin when picked, else the main
role's clinozy-be role, else Member; D47), its status (`useUpdateMemberStatus` — never the
owner's or your own) and the staff profile. An invited member shows "Invitation expires …"
with "Resend invitation"; Delete cancels the invitation instead (`useRevokeInvitation`). Gated
like the room; without `membership:manage` the drawer is view only.

## Files

| File               | Responsibility                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`   | Route marker — exports `Component` rendering `EditUserPage`.                                       |
| `edit.manifest.ts` | Manifest — `kind: 'leaf'`, permission `membership:read`, module `clinic-users`, title "Edit user". |
| `EditUserPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Users page.                  |

## Test ids

`user-drawer` — the drawer the Users page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › User drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
