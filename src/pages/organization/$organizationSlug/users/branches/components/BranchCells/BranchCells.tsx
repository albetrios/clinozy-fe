import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { ClinicBranch } from '@/shared/api/clinic/branches-contracts.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { AvatarStack, TonePill } from '@/shared/components/Cells/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

/** The Branch cell: the chip in the branch's tone, and grey "Main" on the main branch. */
export function BranchNameCell({ branch }: { branch: ClinicBranch }) {
  const { t } = useTranslation(USERS_NS);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      <TonePill tone={branch.tone}>{branch.name}</TonePill>
      {branch.isMain ? (
        <TonePill tone="neutral">{t(USERS_KEYS.branches.main)}</TonePill>
      ) : null}
    </span>
  );
}

/**
 * A two-line cell (Address, Contact, Default people): the value 13px over its
 * 11.5px grey sub-line, each truncated; `quiet` greys the value ("Not set").
 */
export function BranchLinesCell({
  value,
  sub,
  quiet = false,
}: {
  value: string;
  sub?: string;
  quiet?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 leading-[1.3]">
      <span
        className={cn(
          'text-body truncate tabular-nums',
          quiet ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-caption text-muted-foreground truncate">{sub}</span>
      ) : null}
    </span>
  );
}

/** The Opening hours cell: "Mon–Sat · 10:00–20:00". */
export function BranchHoursCell({ value }: { value: string }) {
  return (
    <span className="text-foreground-soft block min-w-0 truncate tabular-nums">
      {value || '—'}
    </span>
  );
}

/**
 * The Team cell: up to four active people as 28px avatar pills, the first
 * with its short name ("Riya S."), then "+5" (H:5198). The pills stop at the
 * cell's edge — the prototype lets them run under Default people (§7.3).
 */
export function BranchTeamCell({ team }: { team: readonly TeamMember[] }) {
  if (team.length === 0) return null;
  return (
    <span className="flex min-w-0 overflow-hidden">
      <AvatarStack
        max={4}
        nameFirst
        people={team.map((member) => ({
          id: member.membershipId,
          name: member.name,
          initials: member.initials,
          tone: member.tone,
        }))}
      />
    </span>
  );
}

/** The Status cell: "Open" sage with its dot, "Closed" grey with its dot. */
export function BranchStatusCell({ active }: { active: boolean }) {
  const { t } = useTranslation(USERS_NS);
  return active ? (
    <TonePill tone="sage" dot>
      {t(USERS_KEYS.branches.status.open)}
    </TonePill>
  ) : (
    <TonePill tone="neutral" dot>
      {t(USERS_KEYS.branches.status.closed)}
    </TonePill>
  );
}
