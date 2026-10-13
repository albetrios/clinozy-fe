import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  organizationUsers,
  organizationUsersBranches,
  organizationUsersRoles,
} from '@/lib/routes/users-builders.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { ArrowUpRight, MapPin, ShieldCheck, Users } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const PANELS = SETTINGS_KEYS.panels;

/**
 * The Users room's pages a settings section points at: what lives there now, the link's label,
 * the route and the page's icon.
 */
const LINKS = {
  members: {
    title: PANELS.members.movedTitle,
    body: PANELS.members.movedBody,
    open: PANELS.members.open,
    route: organizationUsers,
    icon: Users,
  },
  roles: {
    title: PANELS.roles.movedTitle,
    body: PANELS.roles.movedBody,
    open: PANELS.roles.open,
    route: organizationUsersRoles,
    icon: ShieldCheck,
  },
  /** Settings › Clinic: hours, holidays, rooms, machines, GST and review links (KICKOFF §6.6). */
  branches: {
    title: PANELS.clinic.branchesTitle,
    body: PANELS.clinic.branchesBody,
    open: PANELS.clinic.branchesOpen,
    route: organizationUsersBranches,
    icon: MapPin,
  },
} as const;

/** A Users room page {@link UsersRoomLinkCard} opens. */
export type UsersRoomTarget = keyof typeof LINKS;

/**
 * One card pointing at a Users room page: the room's own tile (slate, its section tone) beside
 * what lives there, and a link to it — the Team, Roles & access or Branches. The link leaves the
 * hash behind, so the Settings drawer closes as the room opens.
 */
export function UsersRoomLinkCard({ target }: { target: UsersRoomTarget }) {
  const { t } = useTranslation(SETTINGS_NS);
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  const { title, body, open, route, icon: Icon } = LINKS[target];
  return (
    <SettingsCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="bg-tone-slate text-tone-slate-foreground flex size-10 flex-none items-center justify-center rounded-xl"
        >
          <Icon className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-field leading-[1.3] font-semibold">{t(title)}</p>
          <p className="text-muted-foreground text-xs leading-[1.45] text-pretty">
            {t(body)}
          </p>
        </div>
        <Button asChild size="sm" className="self-start sm:self-center">
          <Link
            {...route(organizationSlug)}
            data-testid={`settings-${target}-open-users`}
          >
            {t(open)}
            <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </SettingsCard>
  );
}

/**
 * Settings › Members or Roles once the Users room holds them (D17): the
 * section's header, what moved, and a link to the Team (`/users`) or to Roles
 * & access (`/users/roles`) — {@link UsersRoomLinkCard}.
 */
export function UsersRoomLink({ section }: { section: 'members' | 'roles' }) {
  const { t } = useTranslation(SETTINGS_NS);
  const keys = PANELS[section];
  return (
    <section
      className="flex flex-col gap-4"
      data-testid={`settings-organization-${section}`}
    >
      <SectionHeader title={t(keys.title)} description={t(keys.description)} />
      <UsersRoomLinkCard target={section} />
    </section>
  );
}
