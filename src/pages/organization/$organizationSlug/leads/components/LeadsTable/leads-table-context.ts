import { createContext, useContext } from 'react';

import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { LeadHold } from '@/shared/api/clinic/leads-hold.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';

/** What the Leads rows read beyond the lead: the team, "me", the hold, the actions. */
export interface LeadsTableContextValue {
  /** The active members by membership id — owners and involved people. */
  team: ReadonlyMap<string, DirectoryMember>;
  /** When the team was read ("Updated HH:MM" on the team card). */
  teamUpdatedAt: string | null;
  /** The signed-in member's membership id ("mine"). */
  viewerId: string | null;
  /** Where a lead stands with its owner and the team (`held_until`). */
  holdOf: (lead: LeadRecord) => LeadHold;
  /** The viewer may claim leads (`lead:update`, and a member of the team). */
  canClaim: boolean;
  /** "Open · Claim" from the row, or the team card's claim button. */
  onClaim: (lead: LeadRecord) => void;
  /** The team card's "Take over from <first>": the viewer becomes the owner of a held lead. */
  onTakeOver: (lead: LeadRecord) => void;
  /** The person's contact card actions (+ Lead, + Appointment, + Patient). */
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
