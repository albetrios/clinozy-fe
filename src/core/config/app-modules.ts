/**
 * Module keys of the clinic rooms (KICKOFF D8). Each room's manifest carries
 * its key as `module`, so `VITE_DISABLED_MODULES` can switch a room off — its
 * routes resolve to not-found and its nav entry disappears.
 */
export const APP_MODULES = {
  today: 'app-today',
  leads: 'app-leads',
  appointments: 'app-appointments',
  patients: 'app-patients',
  medical: 'app-medical',
  stock: 'app-stock',
  payments: 'app-payments',
  tasks: 'app-tasks',
  offerings: 'app-offerings',
  users: 'app-users',
} as const;

/** One clinic room's module key. */
export type AppModuleKey = (typeof APP_MODULES)[keyof typeof APP_MODULES];

/**
 * Rooms that still read fixtures (`REPLACE_WITH_API`). Production keeps them
 * disabled until clinozy-be serves their API (D8); L-60 removes a room from
 * this list as its endpoints land — Leads, Appointments, Patients (D150–D152),
 * Offerings (D153), Clinic stock (D154), Tasks and Today (D155), Payments +
 * invoices (D156) and Users — its Team, Roles & access and Branches — have.
 */
export const FIXTURE_BACKED_APP_MODULES: readonly AppModuleKey[] = [APP_MODULES.medical];
