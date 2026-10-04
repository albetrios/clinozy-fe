import { useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type RoomAction,
  type RoomLinkTab,
  RoomTabs,
  RoomToolbar,
  type RoomToolbarFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { type AppIcon, MapPin, Shield, Users } from '@/shared/icons/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

/** The Users room's tabs, in the design's order (H:1086). */
export type UsersTab = 'team' | 'roles' | 'branches';

/** Each tab's route and 14px icon. */
const TABS: readonly { id: UsersTab; to: string; icon: AppIcon }[] = [
  { id: 'team', to: '/organization/$organizationSlug/users', icon: Users },
  { id: 'roles', to: '/organization/$organizationSlug/users/roles', icon: Shield },
  { id: 'branches', to: '/organization/$organizationSlug/users/branches', icon: MapPin },
];

/** Each tab's toolbar id — its test-id prefix and its saved views' key. */
const TOOLBAR_IDS: Readonly<Record<UsersTab, string>> = {
  team: 'users-team',
  roles: 'users-roles',
  branches: 'users-branches',
};

/** Props of {@link UsersToolbar}. */
export interface UsersToolbarProps {
  /** The tab on screen — its page, whatever the URL says (a drawer over Roles). */
  tab: UsersTab;
  /** The Team's search ("Name, email, mobile or #ID"); the Team only. */
  search?: boolean;
  /** The tab's Filters (Team and Branches). */
  filters?: RoomToolbarFilters;
  /** The Columns chooser (the Team only; hidden on a phone). */
  columns?: ReactNode;
  /** "New user" / "New role" / "New branch" — absent without the right to create. */
  primary?: RoomAction;
}

/**
 * The Users toolbar (KICKOFF §6.12 Toolbar; H:1085–1090; `users.md:17`) on the
 * shared room toolbar, for all three tabs: h1 "Users" · the tabs — links to
 * Team, Roles & access and Branches · the Team's search · Filters (Team and
 * Branches) · Columns (Team) · the tab's "New …" — a floating pill on a phone.
 * The phone rows follow the room toolbar's default: search + Filters, then the
 * tabs; Roles & access has the tabs alone.
 */
export function UsersToolbar({
  tab,
  search = false,
  filters,
  columns,
  primary,
}: UsersToolbarProps) {
  const { t } = useTranslation(USERS_NS);
  const { organizationSlug = '' } = useParams({ strict: false });
  const tabs: RoomLinkTab[] = TABS.map((entry) => ({
    id: entry.id,
    label: t(USERS_KEYS.tabs[entry.id]),
    icon: entry.icon,
    to: entry.to,
    params: { organizationSlug },
  }));

  return (
    <RoomToolbar
      title={t(USERS_KEYS.manifest.title)}
      tableId={TOOLBAR_IDS[tab]}
      tabs={
        <RoomTabs
          label={t(USERS_KEYS.tabs.label)}
          tabs={tabs}
          current={tab}
          testIdPrefix="users"
        />
      }
      search={
        search
          ? {
              placeholder: t(USERS_KEYS.search.placeholder),
              label: t(USERS_KEYS.search.label),
            }
          : undefined
      }
      filters={filters}
      columns={columns}
      primary={primary ? { action: primary } : undefined}
    />
  );
}
