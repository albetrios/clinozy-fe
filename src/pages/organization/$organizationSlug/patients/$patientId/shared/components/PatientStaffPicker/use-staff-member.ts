import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';

/** A picked team member and the short name the drawers show ("Dr. Drashti P."). */
export interface StaffMember {
  person: DirectoryMember | null;
  /** Empty while nobody is picked or the team has not answered. */
  shortName: string;
}

/**
 * The member a record's Doctor or Therapist names, for its badge, peek and summary — from the
 * same team the picker reads (`GET /app/memberships`).
 */
export function useStaffMember(staffId: string | null): StaffMember {
  const team = useTeamDirectory();
  const person = staffId ? (team.byId.get(staffId) ?? null) : null;
  return { person, shortName: person ? shortPersonName(person.name) : '' };
}
