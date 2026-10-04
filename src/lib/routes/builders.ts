/**
 * Route builders — no hand-built route strings anywhere in app code.
 *
 * Builders return `{ to, params }` objects consumed by TanStack Router's typed
 * `Link` / `navigate`, so the router's path typing stays intact
 * (docs/reference/routing-and-tenancy.md §9). Add a builder whenever a new
 * routed island lands; never interpolate paths inline.
 */

export function organizationPicker() {
  return { to: '/organization' } as const;
}

/**
 * An organization's index — no UI of its own: it sends the member to their
 * role home (D25), or the dashboard when the deployment enables no clinic room.
 */
export function organizationHome(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug',
    params: { organizationSlug },
  } as const;
}

export function organizationDashboard(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/dashboard',
    params: { organizationSlug },
  } as const;
}

export function organizationSuspended(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/suspended',
    params: { organizationSlug },
  } as const;
}

/** The Leads room — the list every lead drawer opens over. */
export function organizationLeads(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/leads',
    params: { organizationSlug },
  } as const;
}

/** One lead's drawer over the list — show and edit are one drawer (`S:24–25`). */
export function organizationLead(organizationSlug: string, leadId: string) {
  return {
    to: '/organization/$organizationSlug/leads/$leadId',
    params: { organizationSlug, leadId },
  } as const;
}

/** The New lead drawer over the list; `?name=&phone=` prefill it (`S:23`). */
export function organizationLeadCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/leads/create',
    params: { organizationSlug },
  } as const;
}

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

/** The Offerings room's Offerings tab — the list the Offering drawer opens over. */
export function organizationOfferings(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings',
    params: { organizationSlug },
  } as const;
}

/** The New offering drawer over the list; `?name=` prefills it (`S:99`). */
export function organizationOfferingCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings/create',
    params: { organizationSlug },
  } as const;
}

/** One offering's drawer over the list — Edit offering, view only without Edit (`S:100`). */
export function organizationOfferingEdit(organizationSlug: string, offeringId: string) {
  return {
    to: '/organization/$organizationSlug/offerings/$offeringId/edit',
    params: { organizationSlug, offeringId },
  } as const;
}

/** The Offerings room's Offers tab — a page of its own beside the Offerings tab (`S:101`). */
export function organizationOffers(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings/offers',
    params: { organizationSlug },
  } as const;
}

/** The New offer drawer over the Offers tab (`S:102`). */
export function organizationOfferCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings/offers/create',
    params: { organizationSlug },
  } as const;
}

/** One offer's drawer over the Offers tab — Edit offer, view only without Edit (`S:103`). */
export function organizationOfferEdit(organizationSlug: string, offerId: string) {
  return {
    to: '/organization/$organizationSlug/offerings/offers/$offerId/edit',
    params: { organizationSlug, offerId },
  } as const;
}

/** The Patients room — the list the New patient drawer opens over. */
export function organizationPatients(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/patients',
    params: { organizationSlug },
  } as const;
}

/** The New patient drawer over the list; `?name=&phone=&fromLead=` prefill it (`S:31`). */
export function organizationPatientCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/patients/create',
    params: { organizationSlug },
  } as const;
}

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
