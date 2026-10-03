import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Medical room's namespace, as its Sales tab reads it. */
export const MEDICAL_SALES_NS = I18N_NAMESPACES.medical;

/** The Sales tab's keys (the copy arrives with its screen row). */
export const MEDICAL_SALES_KEYS = {
  manifest: { title: 'manifest.title' },
} as const;
