import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Team notes read the patient file's namespace. */
export const NOTES_NS = I18N_NAMESPACES.patientFile;

/** Team notes (H:834; `patient-file.md:81–90`; KICKOFF §6.6), verbatim. */
export const NOTES_KEYS = {
  /** The composer's accessible name: "New note". */
  label: 'notes.label',
  placeholder: 'notes.placeholder',
  add: 'notes.add',
  /** "Riya S. · Sep 24 · 15:39". */
  by: 'notes.by',
  delete: 'notes.delete',
  deleted: 'notes.deleted',
  empty: 'notes.empty',
} as const;

/** The section's test ids. */
export const NOTES_TEST_IDS = {
  input: 'patient-notes-input',
  add: 'patient-notes-add',
  /** One per note: `patient-note-<id>`. */
  note: 'patient-note',
  /** One per note: `patient-note-delete-<id>`. */
  delete: 'patient-note-delete',
} as const;
