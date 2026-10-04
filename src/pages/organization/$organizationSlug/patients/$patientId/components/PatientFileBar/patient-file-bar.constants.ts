import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The file bar reads the patient file's namespace. */
export const PATIENT_FILE_BAR_NS = I18N_NAMESPACES.patientFile;

/** The file bar's copy (`patient-file.md:499–507`). */
export const PATIENT_FILE_BAR_KEYS = {
  back: 'fileBar.back',
  /** "Back to patients (Esc)" — the tooltip. */
  backHint: 'fileBar.backHint',
  /** "Patients" — the breadcrumb's link back. */
  patients: 'fileBar.patients',
  /** "#3508 · +91 ••••• •3212" — always masked. */
  identity: 'fileBar.identity',
  /** "+91 ••••• •3212". */
  maskedPhone: 'fileBar.maskedPhone',
  visitPill: 'fileBar.visitPill',
  /** "Patient sections" — the tab strip's name. */
  tabs: 'fileBar.tabs',
  notPinned: 'fileBar.notPinned',
  addToRecord: 'fileBar.addToRecord',
  startVisit: 'fileBar.startVisit',
  activity: 'fileBar.activity',
  showActivity: 'fileBar.showActivity',
  hideActivity: 'fileBar.hideActivity',
  /** "3 unread" — the badge's spoken text (plural). */
  unread: 'fileBar.unread',
} as const;

/** The file bar's test ids (KICKOFF §6.6 Test ids). */
export const PATIENT_FILE_BAR_TEST_IDS = {
  back: 'patient-file-back',
  add: 'patient-file-add',
  startVisit: 'patient-file-start-visit',
  activity: 'patient-file-activity',
  /** One tab: `patient-file-tab-<section>`. */
  tab: 'patient-file-tab',
} as const;
