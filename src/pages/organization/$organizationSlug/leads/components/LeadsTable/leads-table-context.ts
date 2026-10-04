import { createContext, useContext } from 'react';

import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { LeadHold } from '@/shared/api/clinic/leads-hold.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';

/** What the Leads rows read beyond the lead: the team, "me", the hold, the actions. */
export interface LeadsTableContextValue {
  /** Every staff profile by id — owners and involved people. */
  staffById: ReadonlyMap<string, StaffProfile>;
  /** When the team was read ("Updated HH:MM" on the team card). */
  staffUpdatedAt: string | null;
  /** The signed-in member's staff id ("mine"). */
  viewerId: string | null;
  /** Where a lead stands with its owner and the team (`leadHold`, H:3869). */
  holdOf: (lead: LeadRecord) => LeadHold;
  /** The viewer may claim and take over leads (Edit on Leads). */
  canClaim: boolean;
  /** "Open · Claim" from the row, or the team card's take-over button. */
  onClaim: (lead: LeadRecord) => void;
  /** The person's contact card actions (+ Lead, + Appointment, + Patient, Edit contact). */
  contactActions: (lead: LeadRecord) => ContactCardActions;
}

/** The Leads rows' context — provided by `LeadsTable`. */
export const LeadsTableContext = createContext<LeadsTableContextValue | null>(null);

/** The Leads rows' context; a cell outside `LeadsTable` is a programming error. */
export function useLeadsTableContext(): LeadsTableContextValue {
  const context = useContext(LeadsTableContext);
  if (!context) throw new Error('Leads cells render inside LeadsTable');
  return context;
}
