/** Registered i18next namespaces — one per route island or shared domain. */
export const I18N_NAMESPACES = {
  common: 'common',
  layout: 'layout',
  dashboard: 'dashboard',
  settings: 'settings',
  errors: 'errors',
  onboarding: 'onboarding',
  auth: 'auth',
  today: 'today',
  leads: 'leads',
  appointments: 'appointments',
  patients: 'patients',
  patientFile: 'patient-file',
  medical: 'medical',
  clinicStock: 'clinic-stock',
  payments: 'payments',
  tasks: 'tasks',
  offerings: 'offerings',
  users: 'users',
  clinic: 'clinic',
} as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[keyof typeof I18N_NAMESPACES];
