import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The empty home's copy lives in `clinic`: it renders only inside the org shell, which loads it. */
export const CLINIC_HOME_EMPTY_NS = I18N_NAMESPACES.clinic;

/** Key paths for the org home's "nothing is switched on" state (L-63). */
export const CLINIC_HOME_EMPTY_KEYS = {
  title: 'clinicHomeEmpty.title',
  description: 'clinicHomeEmpty.description',
} as const;
