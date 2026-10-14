import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationUsers,
  organizationUsersRoles,
} from '@/lib/routes/users-builders.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { ArrowUpRight, ShieldCheck, Users } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const LINKS = {
  members: {
    keys: SETTINGS_KEYS.panels.members,
    route: organizationUsers,
    icon: Users,
  },
  roles: {
    keys: SETTINGS_KEYS.panels.roles,
    route: organizationUsersRoles,
    icon: ShieldCheck,
  },
} as const;

/**
 * Settings › Members or Roles once the Users room holds them (D17): the
 * section's header, what moved, and a link to the Team (`/users`) or to Roles
 * & access (`/users/roles`). The link leaves the hash behind, so the modal
 * closes as the room opens.
 */
export function UsersRoomLink({ section }: { section: 'members' | 'roles' }) {
  const { t } = useTranslation(SETTINGS_NS);
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  const { keys, route, icon: Icon } = LINKS[section];
  return (
    <section
      className="flex flex-col gap-4"
      data-testid={`settings-organization-${section}`}
    >
      <SettingsSectionHeader section={section} />
      {/* The Users room's own tile (slate, its section tone) beside what moved. */}
      <SettingsCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="bg-tone-slate text-tone-slate-foreground flex size-10 flex-none items-center justify-center rounded-xl"
          >
            <Icon className="size-4.5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-field leading-[1.3] font-semibold">{t(keys.movedTitle)}</p>
            <p className="text-muted-foreground text-xs leading-[1.45] text-pretty">
              {t(keys.movedBody)}
            </p>
          </div>
          <Button asChild size="sm" className="self-start sm:self-center">
            <Link
              {...route(organizationSlug)}
              data-testid={`settings-${section}-open-users`}
            >
              {t(keys.open)}
              <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </SettingsCard>
    </section>
  );
}
