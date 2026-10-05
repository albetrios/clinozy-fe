import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationUsers,
  organizationUsersRoles,
} from '@/lib/routes/users-builders.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { Card } from '@/shared/components/ui/card.tsx';
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
    <section className="space-y-6" data-testid={`settings-organization-${section}`}>
      <SectionHeader title={t(keys.title)} description={t(keys.description)} />
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground flex size-10 flex-none items-center justify-center rounded-lg"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{t(keys.movedTitle)}</p>
          <p className="text-muted-foreground text-sm text-pretty">{t(keys.movedBody)}</p>
        </div>
        <Button asChild size="sm" className="self-start sm:self-center">
          <Link
            {...route(organizationSlug)}
            data-testid={`settings-${section}-open-users`}
          >
            {t(keys.open)}
            <ArrowUpRight className="ms-1 size-4" aria-hidden="true" />
          </Link>
        </Button>
      </Card>
    </section>
  );
}
