import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { isInvitationExpired } from '@/shared/api/organization-contracts.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { IdPill, PersonChip, TonePill } from '@/shared/components/Cells/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import type { TeamPill } from './team-cells.ts';

/** The ID cell: "#12" on the grey pill; nothing for a member without a staff profile. */
export function TeamIdCell({ label }: { label: string | null }) {
  return label ? <IdPill>{label}</IdPill> : null;
}

/**
 * The User cell: the 32px avatar in the person's tone with their initials,
 * the name 13px/500 over the mobile "+91 98250 44120". No hover card on staff
 * rows (§7.3).
 */
export function TeamUserCell({ member }: { member: TeamMember }) {
  return (
    <PersonChip
      name={member.name}
      initials={member.initials}
      tone={member.tone}
      sub={member.phone ? formatClinicPhone(member.phone) : undefined}
    />
  );
}

/**
 * The Roles cell: one 24px pill per clinic role in its tone, the main role
 * first — tooltip "Main role" on it, "Also" on the rest (`users.md:32`).
 */
export function TeamRolesCell({ roles }: { roles: readonly TeamPill[] }) {
  const { t } = useTranslation(USERS_NS);
  if (roles.length === 0) return null;
  return (
    <TooltipProvider>
      <span className="flex min-w-0 flex-wrap gap-1">
        {roles.map((role, index) => (
          <Tooltip key={role.id}>
            <TooltipTrigger asChild>
              <TonePill tone={role.tone}>{role.label}</TonePill>
            </TooltipTrigger>
            <TooltipContent>
              {t(index === 0 ? USERS_KEYS.table.mainRole : USERS_KEYS.table.alsoRole)}
            </TooltipContent>
          </Tooltip>
        ))}
      </span>
    </TooltipProvider>
  );
}

/** The Branches cell: the branch chips in their tones. */
export function TeamBranchesCell({ branches }: { branches: readonly TeamPill[] }) {
  if (branches.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {branches.map((branch) => (
        <TonePill key={branch.id} tone={branch.tone}>
          {branch.label}
        </TonePill>
      ))}
    </span>
  );
}

/**
 * The Status cell: "Active" sage with its dot, "Inactive" grey with its dot —
 * or, for an invited member, "Invited" over "Invitation expires 10 Oct" /
 * "Invitation expired" (the Settings members copy, relocated — D17).
 */
export function TeamStatusCell({ member }: { member: TeamMember }) {
  const { t } = useTranslation(USERS_NS);
  const { formatDate } = useLocaleFormat();
  if (member.status === 'invited') {
    const { invitation } = member;
    return (
      <span className="flex min-w-0 flex-col gap-0.5">
        <TonePill tone="butter" dot>
          {t(USERS_KEYS.status.invited)}
        </TonePill>
        {invitation ? (
          <span
            className={cn(
              'text-caption truncate',
              isInvitationExpired(invitation)
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {isInvitationExpired(invitation)
              ? t(USERS_KEYS.status.expired)
              : t(USERS_KEYS.status.expires, {
                  date: formatDate(invitation.expiresAt, {
                    day: 'numeric',
                    month: 'short',
                  }),
                })}
          </span>
        ) : null}
      </span>
    );
  }
  return member.status === 'active' ? (
    <TonePill tone="sage" dot>
      {t(USERS_KEYS.status.active)}
    </TonePill>
  ) : (
    <TonePill tone="neutral" dot>
      {t(USERS_KEYS.status.inactive)}
    </TonePill>
  );
}

/** The text cells' inks: `soft` (Email, Working hours — #3f3f46) or `muted` (Updated — grey). */
const TEXT_INK = {
  soft: 'text-foreground-soft',
  muted: 'text-muted-foreground',
} as const;

/** A text cell (Email, Working hours, Commission, Updated); "—" with no value. */
export function TeamTextCell({
  value,
  ink = 'soft',
  align = 'start',
}: {
  value: string | null;
  ink?: keyof typeof TEXT_INK;
  align?: 'start' | 'end';
}) {
  return (
    <span
      className={cn(
        'block min-w-0 truncate tabular-nums',
        TEXT_INK[ink],
        align === 'end' && 'text-end font-medium',
      )}
    >
      {value || '—' /* NOSONAR(S6606): a blank value shows the dash too */}
    </span>
  );
}
