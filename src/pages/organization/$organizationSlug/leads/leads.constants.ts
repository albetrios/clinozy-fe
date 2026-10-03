import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Leads room's i18n namespace. */
export const LEADS_NS = I18N_NAMESPACES.leads;

/**
 * The Leads room's keys (the screens' copy arrives with their rows). The
 * toasts the shared leads hooks raise sit in the same namespace, declared
 * beside them (`useLeads/leads-toasts.constants.ts`).
 */
export const LEADS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The record's name in "Lead not found · it may have been deleted" (`S:115`). */
  record: 'record',
} as const;
