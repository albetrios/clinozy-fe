import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Appointments room's i18n namespace. */
export const APPOINTMENTS_NS = I18N_NAMESPACES.appointments;

/** The Appointments room's keys (the screens' copy arrives with their rows). */
export const APPOINTMENTS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The record's name in "Appointment not found · it may have been deleted" (`S:115`). */
  record: 'record',
} as const;
