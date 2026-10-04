import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The section popover reads the patient file's namespace. */
export const PATIENT_SECTIONS_POPOVER_NS = I18N_NAMESPACES.patientFile;

/** The section popover's copy (`patient-file.md:503–504`). */
export const PATIENT_SECTIONS_POPOVER_KEYS = {
  /** "Patient file · all sections" — the folder button's name and tooltip. */
  trigger: 'sectionsPopover.trigger',
  /** "Patient file sections" — the popover's (and the phone sheet's) name. */
  label: 'sectionsPopover.label',
  title: 'sectionsPopover.title',
  groups: {
    clinical: 'sectionsPopover.groups.clinical',
    care: 'sectionsPopover.groups.care',
    billing: 'sectionsPopover.groups.billing',
    team: 'sectionsPopover.groups.team',
  },
  openNow: 'sectionsPopover.openNow',
  empty: 'sectionsPopover.empty',
  hasRecords: 'sectionsPopover.hasRecords',
  pin: 'sectionsPopover.pin',
  unpin: 'sectionsPopover.unpin',
  /** "Pin to bar · Visits". */
  pinAria: 'sectionsPopover.pinAria',
  /** "Unpin from bar · Visits". */
  unpinAria: 'sectionsPopover.unpinAria',
  /** "Pinned sections stay in the bar" — per user on the server, so no "· this device" (§3.3, A-F3). */
  footer: 'sectionsPopover.footer',
} as const;

/**
 * The folder button's test id (KICKOFF §6.6 Test ids); the panel is
 * `…-panel`, a tile `…-tile-<section>`, a pin `…-pin-<section>`.
 */
export const PATIENT_SECTIONS_TEST_ID = 'patient-file-sections';
