import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The command menu's clinic copy lives in `app`: its groups only render in
 * the org shell, which loads that namespace before it draws (KICKOFF §3.8).
 * The eager dialog, its input and the platform rows keep `layout` / `common`.
 */
export const COMMAND_MENU_NS = I18N_NAMESPACES.app;

/** Key paths for the command menu (KICKOFF §6.0 Command menu; `_patterns.md:195–207`). */
export const COMMAND_MENU_KEYS = {
  results: 'commandMenu.results',
  groups: {
    actions: 'commandMenu.groups.actions',
    goTo: 'commandMenu.groups.goTo',
    people: 'commandMenu.groups.people',
  },
  actions: {
    newLead: 'commandMenu.actions.newLead',
    newAppointment: 'commandMenu.actions.newAppointment',
    newPatient: 'commandMenu.actions.newPatient',
    newReceipt: 'commandMenu.actions.newReceipt',
    openTasks: 'commandMenu.actions.openTasks',
    finishSetup: 'commandMenu.actions.finishSetup',
    /** "Write prescription" — opens the patient finder (feat-prescription-composer §6.1). */
    writePrescription: 'commandMenu.actions.writePrescription',
  },
  /** The patient finder "Write prescription" turns the menu into. */
  prescribe: {
    /** The chip leading the search line. */
    chip: 'commandMenu.prescribe.chip',
    /** The chip's ×: back to every command. */
    leave: 'commandMenu.prescribe.leave',
    placeholder: 'commandMenu.prescribe.placeholder',
    /** The group of the patient file the menu opened over. */
    thisPatient: 'commandMenu.prescribe.thisPatient',
    patients: 'commandMenu.prescribe.patients',
    hint: 'commandMenu.prescribe.hint',
    empty: 'commandMenu.prescribe.empty',
  },
  /** "Finish setup"'s sub — the setup's "n of 5", the guide's "n of 3" once live (feat-clinic-setup KICKOFF §3; change-setup-one-question D8). */
  setupSub: 'commandMenu.setupSub',
  screen: 'commandMenu.screen',
  personSub: 'commandMenu.personSub',
  move: 'commandMenu.move',
  open: 'commandMenu.open',
  hint: 'commandMenu.hint',
  empty: 'commandMenu.empty',
} as const;

/**
 * Rows per group (H:4608); People shows every person the search answers (`COMMAND_SEARCH_LIMIT`).
 * Actions holds six since "Write prescription" joined the design's five (feat-prescription-composer
 * D13), so a member who may do everything still sees Open tasks.
 */
export const COMMAND_MENU_LIMITS = {
  actions: 6,
  goTo: 4,
} as const;
