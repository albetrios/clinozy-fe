import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The file's add actions read the patient file's namespace. */
export const PATIENT_FILE_ACTIONS_NS = I18N_NAMESPACES.patientFile;

/** The Add-to-record items' labels (`patient-file.md:506`). */
export const PATIENT_FILE_ACTIONS_KEYS = {
  items: {
    prescription: 'addActions.items.prescription',
    treatment: 'addActions.items.treatment',
    photo: 'addActions.items.photo',
    appointment: 'addActions.items.appointment',
    report: 'addActions.items.report',
    note: 'addActions.items.note',
  },
} as const;
