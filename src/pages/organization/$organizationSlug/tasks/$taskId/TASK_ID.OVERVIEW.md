# `pages/organization/$organizationSlug/tasks/$taskId` — Task drawer

Route: `/organization/$organizationSlug/tasks/$taskId` — a URL-driven dialog over the
Tasks list (KICKOFF §4, D24; `S:97`). Show **is** edit: a task is closed with an
outcome, snoozed, reassigned or (made by hand) deleted from the drawer — never edited. The
route renders nothing: the Tasks page reads the id, and the parent island's
`useTasksDialogRoute` reads the task through `useDialogRouteRecord` — once the member's
codes are known, `fetchTask(id, canCode)` under `taskQueryKeys.detail(org, id)`: the task with
its person, the record it points at and the message it quotes, each part only under its
read code — and opens the task drawer over the list, so a refresh or a shared link reopens it.
An id that is no task's public id (`task_` + 21; a link from the fixture days) is never read,
and an unknown one (a 404) leaves the list in place without a drawer, toasting "Task not
found · it may have been deleted" (`S:115`); any other failed read keeps the drawer open with
the error and Retry in place. Gated like the room — membership (`organization:read`) and the
`clinic-tasks` module, then `requireOrgStatus`; every action inside by the member's clinozy-be
codes (all false under View-as: a preview reads the drawer and changes nothing).

The drawer (L-47c) is the parent's `../components/TaskDrawer/`, on the record drawer: from `md`
two columns in `min(900px, 100vw − 40px)` — the task column and the person's chat column,
split by `taskDrawerColumns` (1440: 480 + 420; 820: 409 + 371) — and on a phone the task
column alone. The task column: header (the type's tile, "Created by Clinozy · <rule>" or
"Added by hand", the due label over the member / role queue / "Anyone"), who and the source
button ("Open lead", "Open appointment", "Open treatment", "Open check-in", "Open review",
"Open invoice", else "Open patient" — each under its read code), "1 · What" (the why line,
the quoted message, a closed task's result), the record's context tiles (a lead's, a visit's,
a treatment's; staff names from the team directory), "2 · How", the outcomes the member's codes
can run (`taskOutcomeCodes`, `taskOutcomeFitsPerson`) and their note, and a footer with
Snooze (`task:update`), Assigned (the team who can work tasks, then the role queues;
`taskReassignCodes` — a lead's task needs `lead:update`), "Was A → B", Delete for a task made
by hand (`task:delete`: the reason confirm, then "<task> removed" with Undo = restore) and
Close. The chat column is the person's contact stream (`ChatColumn` `{ kind: 'contact' }`,
`contact_activity:read`); a message sent there asks for a re-read once the server's rules have
run (`useRefreshTasksAfterRules`, D81 T7), and the drawer closes itself when that closes the
task. Its writes, toasts (no Undo — the API has no way back), the room's refusal words
(`409 transition_not_allowed`, `403 missing_permission` on a lead), follow-on screens and the
380ms "What’s next" are the parent's `../hooks/useTaskActions/`; "What’s next" is
`../components/WhatsNextSheet/` — the close's second step, `POST /app/tasks` for the closed
task's person and record.

## Files

| File                  | Responsibility                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `task-id.route.tsx`   | Route marker — exports `Component` rendering `TaskPage`.                                        |
| `task-id.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-tasks`, title "Task". |
| `TaskPage.tsx`        | Renders nothing — the dialog route's own UI. The drawer mounts on the Tasks page.               |

## Test ids

`task-drawer` — the drawer the Tasks page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`). Its parts: `task-drawer-title`,
`-due`, `-owner`, `-person`, `-source`, `-quote`, `-tiles`, `-how`, `-outcome-<outcome>`,
`-note`, `-snooze` (`-panel`), `-assign` (`-panel`), `-was`, `-delete`, `-dismiss`, `-chat`.
