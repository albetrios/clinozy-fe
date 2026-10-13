import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The offer labels' copy lives in the room's namespace. */
export const OFFER_LABELS_NS = I18N_NAMESPACES.offerings;

/** An offer's value as the room words it (`offerings.md:355`; H:5460). */
export const OFFER_LABELS_KEYS = {
  /** "20% off". */
  percentOff: 'offerLabels.percentOff',
  /** "₹500 off". */
  amountOff: 'offerLabels.amountOff',
  /** "at ₹3,999". */
  fixedAt: 'offerLabels.fixedAt',
  /** "+1 session" / "+2 sessions" (plural). */
  extraSessions: 'offerLabels.extraSessions',
} as const;
