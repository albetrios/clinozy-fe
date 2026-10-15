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
  branches: 'app-branches',
} as const;
