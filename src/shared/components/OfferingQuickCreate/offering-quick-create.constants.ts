import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The stacked "New offering" lives in `clinic`, not the room's `offerings`:
 * the Invoice drawer opens it, wherever that drawer is (KICKOFF §6.11, L-40).
 */
export const OFFERING_QUICK_CREATE_NS = I18N_NAMESPACES.clinic;

/** Key paths for the stacked "New offering" (`offerings.md` › Forms, Popups; verbatim). */
export const OFFERING_QUICK_CREATE_KEYS = {
  title: 'offeringQuickCreate.title',
  /** "Service, treatment or package you bill". */
  sub: 'offeringQuickCreate.sub',
  steps: {
    offering: 'offeringQuickCreate.steps.offering',
    details: 'offeringQuickCreate.steps.details',
    payment: 'offeringQuickCreate.steps.payment',
  },
  fields: {
    name: 'offeringQuickCreate.fields.name',
    namePlaceholder: 'offeringQuickCreate.fields.namePlaceholder',
    duration: 'offeringQuickCreate.fields.duration',
    minutesUnit: 'offeringQuickCreate.fields.minutesUnit',
    /** "30 min" — the Details step's head and peek. */
    minutes: 'offeringQuickCreate.fields.minutes',
    category: 'offeringQuickCreate.fields.category',
    price: 'offeringQuickCreate.fields.price',
  },
  /** "Add offering". */
  save: 'offeringQuickCreate.save',
  toasts: {
    name: 'offeringQuickCreate.toasts.name',
    price: 'offeringQuickCreate.toasts.price',
    /** "Offering Hydra facial added". */
    added: 'offeringQuickCreate.toasts.added',
  },
} as const;

/** The child drawer's root test id (KICKOFF §6.11 Test ids). */
export const OFFERING_QUICK_CREATE_TEST_ID = 'offering-quick-create';
