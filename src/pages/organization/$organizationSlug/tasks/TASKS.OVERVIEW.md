# `pages/organization/$organizationSlug/tasks` — Tasks

Route: `/organization/$organizationSlug/tasks`. Follow-ups, feedback calls, reminders, with an owner and due time (KICKOFF §6.10).

Gated like every clinic room: membership (`organization:read`) and the `clinic-tasks`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). Every role sees Tasks; outcomes, snooze and reassign need
View only; the Rules switches are live for Owner and Admin and read-only for everyone else.

The list (L-47b): the shared room toolbar (`layout="tasks"`) — "To do · Snoozed · Done" on
the outline track, the search (220px open, no key hint), the type dropdown, "Mine ·
Everyone", "Rules" — over the room's own grouped list (not the shared table): To do groups
its rows under sticky "Overdue · Due today · Coming up" headers, Snoozed and Done are one
group each with their empty line under the header. A row is focusable and opens with
Enter or Space; a Done entry with no task behind it (a visit a WhatsApp "Yes" confirmed)
toasts its result instead. The view, search, type and scope live in the URL
(`tasks.search.ts`); the list read polls every 60s, 50 a page, loading as its end scrolls
in. A failed read toasts "Couldn’t load this list …" with Retry and keeps the last copy.

Data (L-47, one model with Today's aside, Q-T3): the rule catalogue and shapes in
`src/shared/api/clinic/tasks-contracts.ts`, the groups and due labels as pure functions in
`src/shared/api/clinic/task-views.ts`, the calls in `src/shared/api/clinic/tasks-api.ts`,
the person's chat thread through `src/shared/api/clinic/contact-threads-api.ts`; the hooks
are `src/shared/hooks/useTasks/` (list and drawer polled every 60s, `useTaskOutcome`,
snooze, reassign, create, hand to Clinozy, Undo, rule settings) and
`src/shared/hooks/useContactThread/`; the rule copy and icons are in `src/shared/clinic/`.

## Dialog routes

A layout island over one URL-driven dialog (D24, `S:97`), a direct child whose route renders
nothing — this page reads the URL (`useTasksDialogRoute`), so a refresh or a shared link
reopens it:

- `$taskId/` — the task drawer (L-47c); an unknown id stays on the list with "Task not
  found · it may have been deleted" (`S:115`), the list's params kept.

## Files

| File                           | Responsibility                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tasks.route.tsx`              | Route marker — exports `Component` rendering `TasksPage`.                                                                                                                      |
| `tasks.manifest.ts`            | Manifest — `kind: 'layout'` over `$taskId`, permission `organization:read`, module `clinic-tasks`, nav section `tasks`.                                                        |
| `tasks.search.ts`              | URL schema (`validateSearch`): `tab`, `q`, `type`, `scope`; `taskListQueryOf` for the list read.                                                                               |
| `tasks.constants.ts`           | `TASKS_NS` / `TASKS_KEYS` (the `tasks` namespace), `TASKS_TABLE_ID`, `TASKS_TEST_IDS`.                                                                                         |
| `TasksPage.tsx`                | Room page — toolbar, list, contact-card actions, the dialog route's `Outlet`. Owns `data-testid="tasks-page"`.                                                                 |
| `components/TasksToolbar/`     | The toolbar on the shared `RoomToolbar`.                                                                                                                                       |
| `components/TaskTypePicker/`   | The type dropdown on the shared `Picker`: the 13 rules by source, multi-select, a clear ×.                                                                                     |
| `components/TaskRulesPopover/` | "Rules" and the Task rules popover (82% bottom sheet below `md`).                                                                                                              |
| `components/TaskList/`         | The list card: groups, sticky headers, empty lines, skeletons, paging.                                                                                                         |
| `components/TaskRow/`          | One row: rule tile, title and why, person and source under the contact card, owner under the team card, due label.                                                             |
| `hooks/useTaskDueLabel/`       | A row's due label in words: the clinic's days and clock, the Appearance hour cycle.                                                                                            |
| `hooks/useTasksDialogRoute/`   | Which dialog the URL opens (the task, resolved by `useDialogRouteRecord`), and how it closes.                                                                                  |
| `__tests__/integration/`       | The room end to end on the fixture world; `__tests__/integration/tasks-test-router.tsx` mirrors the family's routes, `__tests__/integration/task-row-fixture.ts` builds a row. |
| `$taskId/`                     | The dialog-route island — see its overview.                                                                                                                                    |

## Test ids

`tasks-page`; the toolbar's `tasks-…` ids; `tasks-scope-tab-<scope>`, `tasks-type-trigger`,
`tasks-rules-trigger`, `tasks-rules`, `tasks-rule-<rule>`, `tasks-list`,
`tasks-group-<group>`, `tasks-row`, `tasks-empty`, `tasks-empty-new` — listed in
`docs/reference/e2e-testids-inventory.md` › Tasks room. The drawer the dialog route opens:
`task-drawer` (L-47c).
