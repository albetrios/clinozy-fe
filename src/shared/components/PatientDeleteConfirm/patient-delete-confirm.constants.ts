import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The patient delete confirm's copy lives in `clinic`: the Patients rows, the
 * patient drawer and the patient file's Edit drawer all raise it.
 */
export const PATIENT_DELETE_NS = I18N_NAMESPACES.clinic;

/** Key paths of the confirm's own copy (`patients.md:160–165`); its chrome is the reason confirm's. */
export const PATIENT_DELETE_KEYS = {
  /** "Delete this patient?" — from a Patients row or the drawer over the list. */
  title: 'patientDelete.title',
  /** "Delete this record?" — from the patient file's Edit drawer. */
  titleRecord: 'patientDelete.titleRecord',
  /** "Priya Shah removed", with Undo. */
  removed: 'patientDelete.removed',
} as const;
