import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The file's add actions read the patient file's namespace. */
export const PATIENT_FILE_ACTIONS_NS = I18N_NAMESPACES.patientFile;

/** The Add-to-record items' labels and the "Nothing due" toast (`patient-file.md:506, 513`). */
export const PATIENT_FILE_ACTIONS_KEYS = {
  items: {
    prescription: 'addActions.items.prescription',
    treatment: 'addActions.items.treatment',
    invoice: 'addActions.items.invoice',
    payment: 'addActions.items.payment',
    photo: 'addActions.items.photo',
    appointment: 'addActions.items.appointment',
    report: 'addActions.items.report',
    note: 'addActions.items.note',
  },
  /** "Nothing due for Dharti Galani" — Payment when the server says she owes nothing. */
  nothingDue: 'addActions.nothingDue',
} as const;
