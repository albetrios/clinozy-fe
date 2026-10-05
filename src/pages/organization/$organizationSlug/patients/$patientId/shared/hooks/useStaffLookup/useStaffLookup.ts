import { useCallback, useMemo } from 'react';

import { FIXTURE_ACTOR_ID } from '@/shared/api/clinic/clinic-fixture-store.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';
import { useMyStaffProfile, useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';

/** A staff member as a record's chip shows them: name, initials, tone. */
export interface StaffChip {
  id: string;
  name: string;
  initials: string;
  tone: Tone;
}

/**
 * The staff member a record names — its doctor, team, author — from the
 * clinic's staff profiles (KICKOFF §6.6 Section tables, Team notes). A
 * record written in this session carries the fixture actor, which stands for
 * the signed-in member (REPLACE_WITH_API: the server stamps the member).
 * Null while the profiles load, and for an id they do not know.
 */
export function useStaffLookup(): (id: string | null | undefined) => StaffChip | null {
  const staff = useStaffProfiles();
  const me = useMyStaffProfile();
  const byId = useMemo(
    () => new Map((staff.data ?? []).map((profile) => [profile.id, profile])),
    [staff.data],
  );
  return useCallback(
    (id) => {
      if (!id) return null;
      const profile = id === FIXTURE_ACTOR_ID ? me.data : byId.get(id);
      if (!profile) return null;
      return {
        id: profile.id,
        name: personFullName(profile),
        initials: profile.initials,
        tone: profile.tone,
      };
    },
    [byId, me.data],
  );
}
