import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import type { AvatarStackPerson } from '@/shared/components/Cells/index.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';
import type { TeamCardData } from '@/shared/components/PersonCard/index.ts';

/** A staff member's roles as the team shows them ("Front desk · Admin"). */
export function staffRoleLine(
  profile: Pick<StaffProfile, 'roles'>,
  roleLabel: (role: Role) => string,
): string {
  return profile.roles.map(roleLabel).join(' · ');
}

/** A staff member as an avatar pill: initials, tone, and presence when asked. */
export function staffPerson(
  profile: StaffProfile,
  options: { presence?: boolean } = {},
): AvatarStackPerson {
  return {
    id: profile.id,
    name: personFullName(profile),
    initials: profile.initials,
    tone: profile.tone,
    ...(options.presence
      ? { presence: profile.presence === 'online' ? 'online' : 'offline' }
      : {}),
  };
}

/**
 * The team card's data for a staff member (KICKOFF §6.0 Team card): name,
 * roles, presence, phone, e-mail, working hours — `updatedAt` when this copy
 * was read ("Updated HH:MM").
 */
export function teamCardDataOf(
  profile: StaffProfile,
  roleLabel: (role: Role) => string,
  updatedAt: string | null = null,
): TeamCardData {
  return {
    name: personFullName(profile),
    initials: profile.initials,
    tone: profile.tone,
    role: staffRoleLine(profile, roleLabel),
    online: profile.presence === 'online',
    phone: profile.phone,
    email: profile.email,
    hours: { from: profile.startsAt, to: profile.endsAt },
    updatedAt,
  };
}
