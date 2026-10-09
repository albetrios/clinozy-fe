import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type { AvatarStackPerson } from '@/shared/components/Cells/index.ts';
import type { TeamCardData } from '@/shared/components/PersonCard/index.ts';

/*
 * The team as the Leads room shows it: the members of `GET /app/memberships` (`useTeamDirectory`)
 * — a name, initials and a tone. The picker carries no role names, presence, phone, e-mail or
 * hours (route map §4; the role names are a backend ask), so the team card shows the name alone.
 */

/** A member as an avatar pill. */
export function memberPerson(member: DirectoryMember): AvatarStackPerson {
  return {
    id: member.id,
    name: member.name,
    initials: member.initials,
    tone: member.tone,
  };
}

/** The team card's data for a member — `updatedAt` when the team was read ("Updated HH:MM"). */
export function teamCardDataOf(
  member: DirectoryMember,
  updatedAt: string | null = null,
): TeamCardData {
  return {
    name: member.name,
    initials: member.initials,
    tone: member.tone,
    role: '',
    updatedAt,
  };
}
