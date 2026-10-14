# `pages/organization/$organizationSlug/users/branches/create` — New branch

Route: `/organization/$organizationSlug/users/branches/create` — a URL-driven dialog over
Users › Branches (KICKOFF §4, §6.12, D24; `S:109`). The route renders nothing: the Branches
page reads the URL and opens the branch drawer over the list, so a refresh or a shared link
reopens it. A new branch starts not main, Open, Mon–Sat 10:00–19:00, in the next of mint ·
lav · blush · peach · plum, with City and State copied from the main branch and you on its
team. The PIN's sixth digit fills City and State — and Area when the PIN has one area, or offers
its areas as chips — from the bundled directory (`usePinPlace` and `PinAreaChips`, as the clinic
setup does; feat-write-less, D13); an unknown PIN says so and fills nothing. Name, the address,
Area, City, a six-digit PIN code, Phone and Email are required, as clinozy-be requires them; the branch and its team go in one `POST /app/branches`, and a name
another branch has (409) outlines Name. Gated like Branches — `branch:read` and the
`app-users` module, then `requireOrgStatus`; "New branch" itself needs `branch:create` —
without it the link lands back on the list with the permission toast. The drawer is the family's
`../components/BranchDrawer/`, opened by the page through `../hooks/useBranchesDialogRoute/`.

## Files

| File                 | Responsibility                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewBranchPage`.                                |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `branch:read`, module `app-users`, title "New branch". |
| `NewBranchPage.tsx`  | Renders nothing — the dialog route's own UI. The drawer mounts on the Branches page.         |

## Test ids

`branch-drawer` — the drawer the Branches page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Branch drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
