import { useCallback } from 'react';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';

/** A staff member as a record's chip shows them: name, initials, tone. */
export interface StaffChip {
  id: string;
  name: string;
  initials: string;
  tone: Tone;
}

/**
 * The team member a record names — its doctor, therapist, author — by membership id, from the
 * team (`GET /app/memberships`; KICKOFF §6.6 Section tables, Team notes). A record still on
 * its way (an optimistic note, no author yet) stands for the signed-in member. Null while the
 * team loads, for no id, and for someone no longer on it.
 */
export function useStaffLookup(): (id: string | null | undefined) => StaffChip | null {
  const team = useTeamDirectory();
  const me = useMyMembershipId();
  const { byId } = team;
  return useCallback(
    (id) => {
      if (id === null || id === undefined) return null;
      const member = byId.get(id === '' ? (me ?? '') : id);
      if (!member) return null;
      return {
        id: member.id,
        name: member.name,
        initials: member.initials,
        tone: member.tone,
      };
    },
    [byId, me],
  );
}
