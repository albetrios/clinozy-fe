# `pages/organization/$organizationSlug/tasks/create` — New task

Route: `/organization/$organizationSlug/tasks/create` — a URL-driven dialog over the Tasks
list (KICKOFF §4, D24; `S:96`; Q-T4 — the design's 720px task drawer was unreachable, so the
plan gives it this route). The route renders nothing: the Tasks page reads the URL and opens
the New task drawer over the list, so a refresh or a shared link reopens it. `?lead=lead_…` /
`?contact=con_…` name whom the task is for when it is opened from a lead or a person (a plan
addition, AMBER) — parsed by `validateTaskCreateSearch` in the parent's
`../tasks.dialog-search.ts` (a public id of that kind, else nothing); from the toolbar the
drawer's "For" field is the shared contact picker in a field (`ContactQuickPickField`): Recent,
then the clinic's people (`GET /app/contacts?q=`), ↵ the first; its quick add makes a contact for
someone not on file (`POST /app/contacts`, the mobile looked up first). It may stay empty — a task
can be about no one.

On clinozy-be: the drawer writes `POST /app/tasks` (`task:create`) — title (empty with a
person: "Follow up · <first name>"), why (Notes), `due_at` (the picked clinic day and time),
`owner_membership_id` (a member who holds `task:read`, `GET /app/memberships?holds=task:read`)
or `owner_role` (a role queue), `contact_id`, a lead's `lead_id`, `priority` (Normal · High).
The default assignee is the person's open lead's owner (`GET /app/leads/:lead_id`), else the
member. Type and "Remind 15 min before" are gone (no such fields, route map §4 #22). A
refusal outlines the field the server named and opens its step.

Gated like the room — membership (`organization:read`) and the `app-tasks` module, then
`requireOrgStatus`; in-room Create is the member's `task:create` code — without it the list
offers no New task, the link goes back with the permission toast, and the drawer writes
nothing. The drawer is the parent's `../components/NewTaskDrawer/`, opened by the page through
`../hooks/useTasksDialogRoute/`; saving or closing it returns to the list with the list's own
params, the prefill dropped — the list stays and toasts "Task added for {owner} · {due}" (D28),
with Undo for a member with `task:delete` (`DELETE /app/tasks/:task_id?reason=mistake`).

## Files

| File                 | Responsibility                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewTaskPage`.                                      |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-tasks`, title "New task". |
| `NewTaskPage.tsx`    | Renders nothing — the dialog route's own UI. The drawer mounts on the Tasks page.                |

## Test ids

`new-task-drawer` — the drawer the Tasks page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Tasks room. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
