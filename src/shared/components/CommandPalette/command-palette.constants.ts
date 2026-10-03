import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The command menu's clinic copy lives in `clinic`: its groups only render in
 * the org shell, which loads that namespace before it draws (KICKOFF §3.8).
 * The eager dialog, its input and the platform rows keep `layout` / `common`.
 */
export const COMMAND_MENU_NS = I18N_NAMESPACES.clinic;

/** Key paths for the command menu (KICKOFF §6.0 Command menu; `_patterns.md:195–207`). */
export const COMMAND_MENU_KEYS = {
  results: 'commandMenu.results',
  groups: {
    actions: 'commandMenu.groups.actions',
    goTo: 'commandMenu.groups.goTo',
    patients: 'commandMenu.groups.patients',
    leads: 'commandMenu.groups.leads',
    invoices: 'commandMenu.groups.invoices',
  },
  actions: {
    newLead: 'commandMenu.actions.newLead',
    newAppointment: 'commandMenu.actions.newAppointment',
    newPatient: 'commandMenu.actions.newPatient',
    newReceipt: 'commandMenu.actions.newReceipt',
    openTasks: 'commandMenu.actions.openTasks',
  },
  screen: 'commandMenu.screen',
  patientSub: 'commandMenu.patientSub',
  leadSub: 'commandMenu.leadSub',
  invoiceTitle: {
    clinic: 'commandMenu.invoiceTitle.clinic',
    medical: 'commandMenu.invoiceTitle.medical',
    consultation: 'commandMenu.invoiceTitle.consultation',
  },
  invoiceSub: 'commandMenu.invoiceSub',
  move: 'commandMenu.move',
  open: 'commandMenu.open',
  hint: 'commandMenu.hint',
  empty: 'commandMenu.empty',
} as const;

/** Rows per group (H:4608): the search returns ten of each type, the menu shows fewer. */
export const COMMAND_MENU_LIMITS = {
  actions: 5,
  goTo: 4,
  patients: 6,
  leads: 5,
  invoices: 4,
} as const;
