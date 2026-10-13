/**
 * Route builders for the Appointments room and its dialog routes (KICKOFF §6.4;
 * `S:26–29`) — `{ to, params }` for TanStack Router's typed `navigate` / `Link`,
 * like `builders.ts`. A module of their own, imported by path and never through
 * the `@/lib/routes/index.ts` barrel, which rides the entry chunk: only the code
 * that goes to these routes loads them.
 */

/** The Appointments room — the page every booking drawer opens over (D27: Agenda by default). */
export function organizationAppointments(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/appointments',
    params: { organizationSlug },
  } as const;
}

/** One booking's drawer over the page — show is edit (`S:28–29`); `?mode=reschedule` moves it. */
export function organizationAppointment(organizationSlug: string, appointmentId: string) {
  return {
    to: '/organization/$organizationSlug/appointments/$appointmentId',
    params: { organizationSlug, appointmentId },
  } as const;
}

/** The New appointment drawer over the page; `?date=&time=&doctor=&who=&copyOf=` prefill it (`S:27`). */
export function organizationAppointmentCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/appointments/create',
    params: { organizationSlug },
  } as const;
}
