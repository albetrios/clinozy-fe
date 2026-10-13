# `pages/organization/$organizationSlug/tasks` — Tasks

Route: `/organization/$organizationSlug/tasks`. Follow-ups, feedback calls, reminders, with an owner and due time (KICKOFF §6.10).

Gated like every clinic room: membership (`organization:read`) and the `app-tasks`
module (on in production since the room left `FIXTURE_BACKED_APP_MODULES`, D155), then
`requireOrgStatus`. In the room the member's clinozy-be codes decide
(research-tasks §7): the reads `task:read` (the Accountant holds none — the list reads
nothing and To do stays empty; Pharmacist and Marketing read and work tasks but create none,
D81 (5)), "New task" `task:create`, New task's Undo
`task:delete`, the Rules switches and "Let Clinozy handle" `organization:update` (Owner,
Admin; read-only with a line saying so for everyone else). A View-as preview reads the
previewed role's view and changes nothing (every code reads false). The drawers' own gates
(outcomes, snooze, assign) are theirs.

The list (L-47b, on clinozy-be): the shared room toolbar (`layout="tasks"`) — "To do ·
Snoozed · Done" on the rooms' segmented track, the search (220px open, no key hint), the type
dropdown, "Mine · Everyone", "Rules", "New task" — over the room's own grouped list (not the
shared table). It reads `GET /app/tasks` (`useTaskList`): `tab` `open` · `snoozed` · `done`
(Done is what closed today), `scope` `mine` (mine and my roles' queues) · `everyone`, the
types as `rule_key` and "Follow-ups you set" as `kind=follow_up,manual` (the server ORs
them, D81 T6), `q`, and the header's branches as `branch_id` (D32; tasks under no branch
always shown) — 50 a page in the server's due order, each page's people from one
`GET /app/contacts?ids=`, polled every 60s, loading as its end scrolls in. To do groups its
rows under sticky "Overdue · Due today · Coming up" headers; Snoozed and Done are one group
each with their empty line under the header. A row: the type's tile and tone · the title
(with "Clinozy can do this" while its rule is handed over), the why line and, on a Done row a
member closed, "✓ <result>" · the person (sage with the "P" badge for a patient) under their
contact card, over the chip naming the linked record's kind ("Lead", "Appt", "Treatment" — no
record numbers, T10) or what the person is · the owner from the team directory ("(you)" for
the member, "· was <first>" after a move) under the team card, else the role queue it waits
in ("Front desk", Q3) or "Anyone" · the due label ("Done by Clinozy" for a task the server
closed). A row is focusable and opens the task drawer's route with Enter or Space. The
view, search, type and scope live in the URL (`tasks.search.ts`; the old `?tab=queue` reads
To do). The first load shows bars; a failed first read is the error with Retry in place; a
later failure toasts "Couldn’t load this list …" with Retry and keeps the last copy.

Rules (`components/TaskRulesPopover/`): `GET /app/task-rule-settings` — each of the fifteen
rules with its switch (`is_on`; off hides its tasks from every view) and, only where the
server can do the work (`can_be_automatic`: Confirm visits, Collect feedback, Payment due,
Regulars gone quiet), "Let Clinozy handle" ↔ "Clinozy handles it" (`is_automatic`); "Follow-ups
you set" closes the list without a switch. Each change saves at once
(`PUT /app/task-rule-settings`, `useSaveTaskRuleSettings`, rolled back if refused). Bars while
the settings load, the error with Retry when they fail.

New task (L-47d, Q-T4): "New task" — in the toolbar, the floating pill on a phone and the
empty To do — opens `create/` for a member with `task:create` (the drawer is
`components/NewTaskDrawer/` — see its overview). A created task closes it, the list stays, and
"Task added for <owner> · <due>" toasts — with Undo for a member with `task:delete`, which
deletes it (`DELETE /app/tasks/:task_id?reason=mistake`); the API has no other way back (Q7).

Data (L-47, one model with Today's work queue, Q-T3 — Today reads the same hooks and outcome
plans, D155): the catalogue (`TASK_TYPES`, keyed by the
API's rule keys and "Follow-ups you set"), the shapes, the list query and the write bodies in
`src/shared/api/app/tasks-contracts.ts`; the groups and due labels as pure functions in
`src/shared/api/app/task-views.ts`; the calls in `src/shared/api/app/tasks-api.ts`; the
hooks in `src/shared/hooks/useTasks/` (list and drawer polled every 60s, outcomes, snooze,
reassign, create, delete and restore, the rule settings); the due labels worded by
`src/shared/hooks/useTaskDueLabel/`; the rule copy, the follow-on targets and the icons in
`src/shared/app/`.

## Dialog routes

A layout island over two URL-driven dialogs (D24, `S:96–97`), direct children whose routes
render nothing — this page reads the URL (`useTasksDialogRoute`), so a refresh or a shared
link reopens them:

- `create/` — New task (L-47d); without Create the link goes back to the list with the
  permission toast. Closing drops `?lead=` / `?contact=` and keeps the list's params.
- `$taskId/` — the task drawer (L-47c); an unknown id stays on the list with "Task not
  found · it may have been deleted" (`S:115`), the list's params kept.

## Files

| File                           | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks.route.tsx`              | Route marker — exports `Component` rendering `TasksPage`.                                                                                                                                                                                                                                                                                                                                                                     |
| `tasks.manifest.ts`            | Manifest — `kind: 'layout'` over `create` and `$taskId`, permission `organization:read`, module `app-tasks`, nav section `tasks`.                                                                                                                                                                                                                                                                                             |
| `tasks.search.ts`              | URL schema (`validateSearch`): `tab` (`open` · `snoozed` · `done`), `q`, `type` (the API's rule keys and `by_hand`), `scope` — declared for the entry chunk, pinned to the contract.                                                                                                                                                                                                                                          |
| `tasks.dialog-search.ts`       | New task's `lead` / `contact` — parsed by `useTasksDialogRoute`; loads with the room.                                                                                                                                                                                                                                                                                                                                         |
| `tasks.params.ts`              | The list read from the URL and the header's branches — `taskListQueryOf` (defaults applied) — off the entry chunk.                                                                                                                                                                                                                                                                                                            |
| `tasks.display.ts`             | `taskPersonKind`, `taskContactCard`, `lowerFirst` — how the room names people (the rows, New task, the task drawer, What’s next); staff names come from the team directory.                                                                                                                                                                                                                                                   |
| `tasks.constants.ts`           | `TASKS_NS` / `TASKS_KEYS` (the `tasks` namespace), `TASKS_TABLE_ID`, `TASKS_TEST_IDS`.                                                                                                                                                                                                                                                                                                                                        |
| `TasksPage.tsx`                | Room page — the gates by code, the list read, the rules, contact-card actions, New task (opened, created, Undo by delete), the dialog routes' `Outlet`. Owns `data-testid="tasks-page"`.                                                                                                                                                                                                                                      |
| `components/TasksToolbar/`     | The toolbar on the shared `RoomToolbar`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `components/TaskTypePicker/`   | The type dropdown on the shared `Picker`: the fifteen rules and "Follow-ups you set" by source, multi-select, a clear ×.                                                                                                                                                                                                                                                                                                      |
| `components/TaskRulesPopover/` | "Rules" and the Task rules popover (82% bottom sheet below `md`): switches, "Let Clinozy handle" where the server can, bars, Retry.                                                                                                                                                                                                                                                                                           |
| `components/TaskList/`         | The list card: groups, sticky headers, empty lines, bars, the error with Retry, paging.                                                                                                                                                                                                                                                                                                                                       |
| `components/TaskRow/`          | One row: type tile, title and why, person and source chip under the contact card, owner (member, role queue or "Anyone") under the team card, due label.                                                                                                                                                                                                                                                                      |
| `components/NewTaskDrawer/`    | New task on the record drawer; `components/NewTaskDrawer/new-task-form.ts` (the form, Due chips, the create it asks for), `components/NewTaskDrawer/new-task-person.ts`, the "For" picker.                                                                                                                                                                                                                                    |
| `components/TaskDrawer/`       | The task drawer (L-47c) on the record drawer: `TaskDrawer` (its header, column and footer slots), `TaskDrawerSections` (the rule tile, due · owner, the body), `TaskDrawerFooter` (Snooze, Assigned), `TaskDrawerChat` (the person's activity stream), `components/TaskDrawer/task-drawer-columns.ts`, `components/TaskDrawer/task-drawer-targets.ts` (the source button), `components/TaskDrawer/use-task-context-tiles.ts`. |
| `components/WhatsNextSheet/`   | "What’s next for <first>?" on the record drawer; `components/WhatsNextSheet/whats-next-form.ts`.                                                                                                                                                                                                                                                                                                                              |
| `hooks/useTasksDialogRoute/`   | Which dialog the URL opens (New task, or the task resolved by `useDialogRouteRecord`), and how it closes.                                                                                                                                                                                                                                                                                                                     |
| `hooks/useTaskActions/`        | The drawer's writes — outcome, snooze, reassign — their toasts (no Undo: the API has no way back, Q7), follow-on screens and "What’s next".                                                                                                                                                                                                                                                                                   |
| `hooks/useTaskAssignees/`      | The team the pickers assign from: the active members who can work tasks (`task:read`), the member first as "<name> (you)", and every member by id (the rows' owners).                                                                                                                                                                                                                                                         |
| `__tests__/integration/`       | The list end to end on clinozy-be's shapes over doubles of the api modules (`__tests__/integration/tasks-test-data.ts`); `__tests__/integration/tasks-test-router.tsx` mirrors the family's routes and signs a member in by codes; `__tests__/integration/tasks-dialog-stubs.tsx` stands in for the drawers.                                                                                                                  |
| `create/`                      | New task's dialog-route island — see its overview.                                                                                                                                                                                                                                                                                                                                                                            |
| `$taskId/`                     | The task drawer's dialog-route island — see its overview.                                                                                                                                                                                                                                                                                                                                                                     |

## Test ids

`tasks-page`; the toolbar's `tasks-…` ids; `tasks-scope-tab-<scope>`, `tasks-type-trigger`,
`tasks-type-clear`, `tasks-rules-trigger`, `tasks-rules`, `tasks-rule-<type>` (the API's rule
keys and `by_hand`: `tasks-rule-follow_up`, `tasks-rule-medical_rep_visit`) with
`-switch` and `-handle`, `tasks-list`, `tasks-group-<group>`, `tasks-row` (`data-task-id`,
`data-type`), `tasks-empty`, `tasks-empty-new` — listed in
`docs/reference/e2e-testids-inventory.md` › Tasks room. The drawers the dialog routes open:
`new-task-drawer` (with `new-task-…` field ids) and `task-drawer` (with `task-drawer-…` part ids), and
`whats-next-drawer` (with `whats-next-…` ids).
