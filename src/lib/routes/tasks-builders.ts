/**
 * Route builders for the Tasks room and its drawers (KICKOFF §6.10; `S:95–97`) —
 * `{ to, params }` for TanStack Router's typed `navigate` / `Link`, like
 * `builders.ts`. A module of their own, imported by path and never through the
 * `@/lib/routes/index.ts` barrel, which rides the entry chunk: only the code that
 * goes to these routes loads them.
 */

/** The Tasks room — the list the task drawer opens over (To do, Mine by default). */
export function organizationTasks(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/tasks',
    params: { organizationSlug },
  } as const;
}

/** One task's drawer over the list — show is edit (`S:97`). */
export function organizationTask(organizationSlug: string, taskId: string) {
  return {
    to: '/organization/$organizationSlug/tasks/$taskId',
    params: { organizationSlug, taskId },
  } as const;
}

/** New task over the list; `?lead=` / `?patient=` name whom it is for (KICKOFF §6.10). */
export function organizationTaskCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/tasks/create',
    params: { organizationSlug },
  } as const;
}
