import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The shared clinic vocabulary namespace — section names, roles, statuses. */
export const CLINIC_NS = I18N_NAMESPACES.clinic;

/** Keys in the `clinic` namespace (every value verbatim from the design). */
export const CLINIC_KEYS = {
  sections: {
    today: { label: 'sections.today.label', description: 'sections.today.description' },
    leads: { label: 'sections.leads.label', description: 'sections.leads.description' },
    appointments: {
      label: 'sections.appointments.label',
      description: 'sections.appointments.description',
    },
    patients: {
      label: 'sections.patients.label',
      description: 'sections.patients.description',
    },
    medical: {
      label: 'sections.medical.label',
      description: 'sections.medical.description',
    },
    stock: { label: 'sections.stock.label', description: 'sections.stock.description' },
    payments: {
      label: 'sections.payments.label',
      description: 'sections.payments.description',
    },
    tasks: { label: 'sections.tasks.label', description: 'sections.tasks.description' },
    offerings: {
      label: 'sections.offerings.label',
      description: 'sections.offerings.description',
    },
    users: { label: 'sections.users.label', description: 'sections.users.description' },
  },
  roles: {
    admin: 'roles.admin',
    doctor: 'roles.doctor',
    therapist: 'roles.therapist',
    front_desk: 'roles.front_desk',
    counsellor: 'roles.counsellor',
    pharmacist: 'roles.pharmacist',
    accountant: 'roles.accountant',
    marketing: 'roles.marketing',
    owner: 'roles.owner',
  },
} as const;
