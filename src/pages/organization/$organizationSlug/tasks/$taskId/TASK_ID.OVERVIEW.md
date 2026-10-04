# `pages/organization/$organizationSlug/tasks/$taskId` — Task drawer

Route: `/organization/$organizationSlug/tasks/$taskId` — a URL-driven dialog over the
Tasks list (KICKOFF §4, D24; `S:97`). Show **is** edit: a task is closed with an
outcome, snoozed or reassigned from the drawer — never edited. The route renders nothing:
the Tasks page reads the id, resolves the task through `useDialogRouteRecord` (in the
parent island's `useTasksDialogRoute`) and opens the task drawer over the list, so a refresh or a
shared link reopens it. An unknown id leaves the list in place, without a drawer, and
toasts "Task not found · it may have been deleted" (`S:115`). Gated like the room —
membership (`organization:read`) and the `clinic-tasks` module, then `requireOrgStatus`.

## Files

| File                  | Responsibility                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `task-id.route.tsx`   | Route marker — exports `Component` rendering `TaskPage`.                                        |
| `task-id.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-tasks`, title "Task". |
| `TaskPage.tsx`        | Renders nothing — the dialog route's own UI. The drawer mounts on the Tasks page.               |

## Test ids

`task-drawer` — the drawer the Tasks page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
