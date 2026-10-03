# `pages/organization/$organizationSlug/tasks` — Tasks

Route: `/organization/$organizationSlug/tasks`. Follow-ups, feedback calls, reminders, with an owner and due time (KICKOFF §6.10).

Gated like every clinic room: membership (`organization:read`) and the `clinic-tasks`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7). The island was scaffolded with the route
plumbing (L-12a); its screen is built in its own ledger row.

## Files

| File                 | Responsibility                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `tasks.route.tsx`    | Route marker — exports `Component` rendering `TasksPage`.                                              |
| `tasks.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-tasks`, nav section `tasks`. |
| `tasks.constants.ts` | `TASKS_NS` / `TASKS_KEYS` (the `tasks` namespace).                                                     |
| `TasksPage.tsx`      | Room page. Owns `data-testid="tasks-page"`.                                                            |
