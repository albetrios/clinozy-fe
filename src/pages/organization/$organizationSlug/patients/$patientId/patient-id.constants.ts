import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The file layout reads the patient file's namespace. */
export const PATIENT_FILE_LAYOUT_NS = I18N_NAMESPACES.patientFile;

/** The layout's own copy. */
export const PATIENT_FILE_LAYOUT_KEYS = {
  /** "Patient" — the record in "Patient not found · it may have been deleted". */
  notFoundRecord: 'layout.notFoundRecord',
  /** "Opening the file" — what the skeleton announces. */
  loading: 'layout.loading',
} as const;
