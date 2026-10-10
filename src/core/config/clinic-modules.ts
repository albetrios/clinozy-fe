/**
 * Module keys of the clinic rooms (KICKOFF D8). Each room's manifest carries
 * its key as `module`, so `VITE_DISABLED_MODULES` can switch a room off — its
 * routes resolve to not-found and its nav entry disappears.
 */
export const CLINIC_MODULES = {
  today: 'clinic-today',
  leads: 'clinic-leads',
  appointments: 'clinic-appointments',
  patients: 'clinic-patients',
  medical: 'clinic-medical',
  stock: 'clinic-stock',
  payments: 'clinic-payments',
  tasks: 'clinic-tasks',
  offerings: 'clinic-offerings',
  users: 'clinic-users',
} as const;

/** One clinic room's module key. */
export type ClinicModuleKey = (typeof CLINIC_MODULES)[keyof typeof CLINIC_MODULES];

/**
 * Rooms that still read fixtures (`REPLACE_WITH_API`). Production keeps them
 * disabled until clinozy-be serves their API (D8); L-60 removes a room from
 * this list as its endpoints land — Leads, Appointments and Patients have (D150–D152).
 * Today stays until Tasks: its work queue is the tasks' (D149). Users is here
 * too: its staff profiles, branches and clinic matrix are fixtures even though
 * members are real.
 */
export const FIXTURE_BACKED_CLINIC_MODULES: readonly ClinicModuleKey[] = [
  CLINIC_MODULES.today,
  CLINIC_MODULES.medical,
  CLINIC_MODULES.stock,
  CLINIC_MODULES.payments,
  CLINIC_MODULES.tasks,
  CLINIC_MODULES.offerings,
  CLINIC_MODULES.users,
];
