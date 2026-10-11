import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { PersonAvatar } from '@/shared/components/Cells/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { rolePurposeKey } from './roles-access.ts';

/** How many holders a role button shows before "+N" (H:1120). */
const AVATARS = 3;

/** One role in the list, with what it shows. */
export interface RoleListItem {
  role: RoleSummary;
  label: string;
  holders: readonly TeamMember[];
}

/**
 * The role list (`users.md:44–53`; H:1118–1121): "Roles" over one button per
 * role — a 10px square in the role's ink, the name 13px/600, its purpose on one
 * line, up to three overlapping 22px holders (an 18px avatar in a 2px border)
 * and "+N". The selected role takes
 * the card's fill, edge and shadow (`aria-current`).
 */
export function RoleList({
  items,
  selected,
  onSelect,
}: {
  items: readonly RoleListItem[];
  selected: string | undefined;
  onSelect: (role: RoleSummary) => void;
}) {
  const { t } = useTranslation(USERS_NS);
  const { formatNumber } = useLocaleFormat();
  return (
    <nav
      aria-label={t(USERS_KEYS.roles.label)}
      data-testid="users-roles-list"
      className="bg-canvas flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
    >
      <span className="text-micro text-muted-foreground px-2 pt-2 pb-1.5 font-semibold tracking-[0.05em] uppercase">
        {t(USERS_KEYS.roles.label)}
      </span>
      {items.map(({ role, label, holders }) => {
        const current = role.id === selected;
        const shown = holders.slice(0, AVATARS);
        const more = holders.length - shown.length;
        return (
          <button
            key={role.id}
            type="button"
            aria-current={current || undefined}
            onClick={() => onSelect(role)}
            data-testid={`users-roles-item-${role.id}`}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-start transition-colors duration-150',
              current
                ? 'bg-card border-border-strong shadow-xs'
                : 'hover:bg-background border-transparent',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 flex-none rounded-xs',
                TONE_CLASSES[role.tone].fill,
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.3]">
              <span className="text-body leading-[1.3] font-semibold">{label}</span>
              <span className="text-caption text-muted-foreground truncate">
                {t(rolePurposeKey(role))}
              </span>
            </span>
            {/* Always there, so every purpose line ends at the same place (H:1120). */}
            <span className="flex flex-none items-center ps-1.5">
              {shown.map((member) => (
                <span
                  key={member.membershipId}
                  title={member.name}
                  data-slot="pill"
                  className="border-canvas -ms-1.5 flex rounded-full border-2"
                >
                  <PersonAvatar
                    size="line"
                    initials={member.initials}
                    tone={member.tone}
                  />
                </span>
              ))}
              {more > 0 ? (
                <span className="text-micro text-muted-foreground ms-1 tabular-nums">
                  +{formatNumber(more)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
