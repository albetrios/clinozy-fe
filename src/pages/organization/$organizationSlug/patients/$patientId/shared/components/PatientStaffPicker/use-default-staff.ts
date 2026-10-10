import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';

/** Who a new record starts with, and whether the team has answered. */
export interface DefaultStaff {
  id: string | null;
  ready: boolean;
}

/**
 * Who a new record's Doctor or Therapist starts as (KICKOFF §6.6; the prototype's `ptDoc()` /
 * `ptTher()`): the one on the patient's last record of the kind, else the member themself,
 * else — for a doctor, whom a prescription needs — the first member of the team. A therapist
 * may stay empty. The team has no doctor or therapist roles to read (M41), so anyone on it may
 * be either.
 */
export function useDefaultStaff(
  staffRole: 'doctor' | 'therapist',
  lastId: string | null | undefined,
): DefaultStaff {
  const team = useTeamDirectory();
  const me = useMyMembershipId();
  const ready = !team.isPending && me !== undefined;
  if (lastId && team.byId.has(lastId)) return { id: lastId, ready };
  if (me && team.byId.has(me)) return { id: me, ready };
  return { id: staffRole === 'doctor' ? (team.members[0]?.id ?? null) : null, ready };
}
