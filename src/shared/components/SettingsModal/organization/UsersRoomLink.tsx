import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { organizationBranches } from '@/lib/routes/branches-builders.ts';
import {
  organizationUsers,
  organizationUsersRoles,
} from '@/lib/routes/users-builders.ts';
import { cn } from '@/lib/utils.ts';
import { SECTION_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { ArrowUpRight, Building, ShieldCheck, Users } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const PANELS = SETTINGS_KEYS.panels;

/**
 * The room pages a settings section points at — the Users room's Team and Roles & access, and
 * the Branches room: what lives there now, the link's label, the route, the room (its tile's
 * tone and the link's test id) and the page's icon.
 */
const LINKS = {
  members: {
    title: PANELS.members.movedTitle,
    body: PANELS.members.movedBody,
    open: PANELS.members.open,
    route: organizationUsers,
    room: 'users',
    icon: Users,
  },
  roles: {
    title: PANELS.roles.movedTitle,
    body: PANELS.roles.movedBody,
    open: PANELS.roles.open,
    route: organizationUsersRoles,
    room: 'users',
    icon: ShieldCheck,
  },
  /** Settings › Clinic: hours, holidays, rooms, machines, GST and review links (KICKOFF §6.6). */
  branches: {
    title: PANELS.clinic.branchesTitle,
    body: PANELS.clinic.branchesBody,
    open: PANELS.clinic.branchesOpen,
    route: organizationBranches,
    room: 'branches',
    icon: Building,
  },
} as const;

/** A room page {@link UsersRoomLinkCard} opens. */
export type UsersRoomTarget = keyof typeof LINKS;

/**
 * One card pointing at a room page: the room's own tile (its section tone — Users slate,
 * Branches stone) beside what lives there, and a link to it — the Team, Roles & access or the
 * Branches room. The link leaves the hash behind, so the Settings drawer closes as the room opens.
 */
export function UsersRoomLinkCard({ target }: { target: UsersRoomTarget }) {
  const { t } = useTranslation(SETTINGS_NS);
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  const { title, body, open, route, room, icon: Icon } = LINKS[target];
  return (
    <SettingsCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className={cn(
            TONE_CLASSES[SECTION_TONES[room]].surface,
            'flex size-10 flex-none items-center justify-center rounded-xl',
          )}
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
            data-testid={`settings-${target}-open-${room}`}
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
  return (
    <section
      className="flex flex-col gap-4"
      data-testid={`settings-organization-${section}`}
    >
      <SettingsSectionHeader section={section} />
      <UsersRoomLinkCard target={section} />
    </section>
  );
}
