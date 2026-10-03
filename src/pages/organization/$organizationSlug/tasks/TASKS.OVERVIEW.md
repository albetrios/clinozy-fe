# `pages/organization/$organizationSlug/tasks` — Tasks

Route: `/organization/$organizationSlug/tasks`. Follow-ups, feedback calls, reminders, with an owner and due time (KICKOFF §6.10).

Gated like every clinic room: membership (`organization:read`) and the `clinic-tasks`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

Data (L-47, one model with Today's aside, Q-T3): the rule catalogue and shapes in
`src/shared/api/clinic/tasks-contracts.ts`, the calls in
`src/shared/api/clinic/tasks-api.ts`, the person's chat thread through
`src/shared/api/clinic/contact-threads-api.ts`; the hooks are
`src/shared/hooks/useTasks/` (list and drawer polled every 60s, `useTaskOutcome`,
snooze, reassign, create, hand to Clinozy, Undo, rule settings) and
`src/shared/hooks/useContactThread/`; the rule copy and icons are in
`src/shared/clinic/`.

## Files

| File                 | Responsibility                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `tasks.route.tsx`    | Route marker — exports `Component` rendering `TasksPage`.                                              |
| `tasks.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-tasks`, nav section `tasks`. |
| `tasks.constants.ts` | `TASKS_NS` / `TASKS_KEYS` (the `tasks` namespace).                                                     |
| `TasksPage.tsx`      | Room page. Owns `data-testid="tasks-page"`.                                                            |
