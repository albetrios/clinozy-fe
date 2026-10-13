import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The confirm's own copy lives in the room's namespace; its chrome is the reason confirm's. */
export const CATALOGUE_DELETE_NS = I18N_NAMESPACES.offerings;

/** "<Action> this <record type>?" (`offerings.md:214`). */
export const CATALOGUE_DELETE_KEYS = {
  offeringTitle: 'deleteConfirm.offeringTitle',
  offerTitle: 'deleteConfirm.offerTitle',
} as const;
