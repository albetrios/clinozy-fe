import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Add-to-record menu reads the patient file's namespace. */
export const PATIENT_ADD_MENU_NS = I18N_NAMESPACES.patientFile;

/** The menu's two headers and its accessible name (`patient-file.md:506`). */
export const PATIENT_ADD_MENU_KEYS = {
  /** "Add to record" — the menu's name and the "+" button's. */
  label: 'addMenu.label',
  /** "Add for Dharti" — from "+". */
  headerFile: 'addMenu.headerFile',
  /** "For Dharti · already selected" — from a section's "⌄". */
  headerSection: 'addMenu.headerSection',
} as const;

/** The menu's test ids (`patient-file-add-menu`, one item `…-<id>`). */
export const PATIENT_ADD_MENU_TEST_ID = 'patient-file-add-menu';
