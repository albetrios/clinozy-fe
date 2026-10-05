# `pages/organization/$organizationSlug/tasks/create` — New task

Route: `/organization/$organizationSlug/tasks/create` — a URL-driven dialog over the Tasks
list (KICKOFF §4, D24; `S:96`; Q-T4 — the design's 720px task drawer was unreachable, so the
plan gives it this route). The route renders nothing: the Tasks page reads the URL and opens
the New task drawer over the list, so a refresh or a shared link reopens it. `?lead=` /
`?patient=` name whom the task is for when it is opened from a lead or a patient (a plan
addition, AMBER) — parsed by `validateTaskCreateSearch` in the parent's `../tasks.dialog-search.ts`
(a record id, else nothing); from the toolbar the drawer's "For" field picks the person.
Gated like the room — membership (`organization:read`) and the `clinic-tasks` module, then
`requireOrgStatus`; in-room Create is `useClinicAccess` (`tasks.create`) — without it the
list sends the link back with the permission toast. The drawer is the parent's
`../components/NewTaskDrawer/`, opened by the page through `../hooks/useTasksDialogRoute/`;
saving or closing it returns to the list with the list's own params, the prefill dropped —
the list stays and toasts "Task added for {owner} · {due}" with Undo (D28).

## Files

| File                 | Responsibility                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewTaskPage`.                                         |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-tasks`, title "New task". |
| `NewTaskPage.tsx`    | Renders nothing — the dialog route's own UI. The drawer mounts on the Tasks page.                   |

## Test ids

`new-task-drawer` — the drawer the Tasks page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Tasks room. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
