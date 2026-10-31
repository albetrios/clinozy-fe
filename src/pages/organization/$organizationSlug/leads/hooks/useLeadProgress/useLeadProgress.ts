import { useState } from 'react';

import type { LeadStatus } from '@/shared/api/app/app-schema.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { useMoveLead } from '@/shared/hooks/useLeads/index.ts';

import type { LeadMove } from '../../components/LeadNextStep/index.ts';

/** The statuses a move into asks when to follow up first (D25). */
const ASKS_FOR_TIME: ReadonlySet<LeadStatus> = new Set(['contacted', 'follow_up']);

/** What {@link useLeadProgress} gives the drawer's Progress card. */
export interface LeadProgressState {
  /** The status a follow-up time is being picked for, or null. */
  asking: LeadStatus | null;
  ask: (status: LeadStatus | null) => void;
  /** Moves the lead at once, with Undo. */
  move: (move: LeadMove) => void;
  /** A press on the track: Contacted and Follow-up ask for a time first, any other moves at once. */
  press: (status: LeadStatus) => void;
}

/**
 * The lead drawer's Progress (D25): every move saves at once — not through the drawer's Save —
 * with Undo; a move into Contacted or Follow-up first asks when to follow up, so the follow-up task
 * opens at that time.
 */
export function useLeadProgress(lead: LeadRecord): LeadProgressState {
  const [asking, setAsking] = useState<LeadStatus | null>(null);
  const save = useMoveLead();
  const move = (next: LeadMove) => {
    setAsking(null);
    save.mutate({ lead, status: next.status, followUpAt: next.followUpAt });
  };
  return {
    asking,
    ask: setAsking,
    move,
    press: (status) => {
      if (ASKS_FOR_TIME.has(status)) setAsking(status);
      else move({ status });
    },
  };
}
