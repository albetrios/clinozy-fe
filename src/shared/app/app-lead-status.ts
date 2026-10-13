import type { Lead } from '@/shared/api/app/app-schema.ts';

import { APP_KEYS } from './app.constants.ts';

/**
 * The `app` key a lead's status shows under (KICKOFF §6.3): "Re-targeted"
 * for a re-target lead still New — the contract stores no such status (D22,
 * `S:1066, 1100`) — else its stored status's label; null for a lead with no
 * status (a contact thread).
 */
export function appLeadStatusKey(lead: Pick<Lead, 'status' | 'kind'>): string | null {
  if (lead.status === null) return null;
  if (lead.status === 'new' && lead.kind === 'retarget') {
    return APP_KEYS.leads.retargeted;
  }
  return APP_KEYS.leads.statuses[lead.status];
}
