import type { Lead } from '@/shared/api/clinic/clinic-schema.ts';

import { CLINIC_KEYS } from './clinic.constants.ts';

/**
 * The `clinic` key a lead's status shows under (KICKOFF §6.3): "Re-targeted"
 * for a re-target lead still New — the contract stores no such status (D22,
 * `S:1066, 1100`) — else its stored status's label; null for a lead with no
 * status (a contact thread).
 */
export function clinicLeadStatusKey(lead: Pick<Lead, 'status' | 'kind'>): string | null {
  if (lead.status === null) return null;
  if (lead.status === 'new' && lead.kind === 'retarget') {
    return CLINIC_KEYS.leads.retargeted;
  }
  return CLINIC_KEYS.leads.statuses[lead.status];
}
