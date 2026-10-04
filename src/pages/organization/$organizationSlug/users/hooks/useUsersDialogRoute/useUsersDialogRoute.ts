import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationUsers, organizationUsersRoles } from '@/lib/routes/index.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import { type UserEditSearch, validateUsersSearch } from '../../users.search.ts';

/** The drawer the Users URL opens over its page (KICKOFF §4, D24). */
export type UsersDialog =
  | { kind: 'none' }
  /** `/users/create` — New user, an invitation (`S:105`). */
  | { kind: 'create' }
  /** `/users/$userId/edit` — the member drawer, keyed by membership id (`S:106`, AMBER). */
  | { kind: 'edit'; membershipId: string; member: TeamMember | undefined };

/** The dialog, and how it closes: back to the page behind it with its own params. */
export interface UsersDialogRouteState {
  dialog: UsersDialog;
  close: () => void;
}

const CREATE_PATH = /\/users\/create\/?$/;
const EDIT_PATH = /\/users\/([^/]+)\/edit\/?$/;

/** What the hook is told of the viewer and the page behind the drawer. */
interface UsersDialogOptions {
  canInvite: boolean;
  accessResolved: boolean;
  /** `roles` — the member was opened from a role page, which is behind the drawer. */
  from?: UserEditSearch['from'];
  /** The role page's role, to return to (`?role=`). */
  role?: string;
}

/** What the hook reads of the Team. */
interface TeamState {
  members: readonly TeamMember[];
  isPending: boolean;
}

/**
 * Which drawer the URL opens over the Team — the room's dialog routes render
 * nothing, so the page reads them here. A member who may not invite and
 * follows a create link lands back on the list with the permission toast; a
 * member id the Team doesn't have — a stale link, someone removed — leaves the
 * page with "User not found · it may have been deleted" (`S:115`). `close`
 * returns to the Team with its search, filters and sort — or, for a member
 * opened from a role page, to that role (H:5188).
 */
export function useUsersDialogRoute(
  team: TeamState,
  options: UsersDialogOptions,
): UsersDialogRouteState {
  const { organizationSlug = '' } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation([ERRORS_NS, USERS_NS]);
  const edit = EDIT_PATH.exec(pathname);

  const { from, role } = options;
  const close = useCallback(() => {
    if (from === 'roles') {
      void navigate({
        ...organizationUsersRoles(organizationSlug),
        search: { role },
        hash: true,
        replace: true,
      });
      return;
    }
    void navigate({
      ...organizationUsers(organizationSlug),
      search: (current: Record<string, unknown>) => validateUsersSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug, from, role]);

  const isCreate = CREATE_PATH.test(pathname);
  const refused = isCreate && options.accessResolved && !options.canInvite;
  const membershipId = edit?.[1];
  const member = membershipId
    ? team.members.find((row) => row.membershipId === membershipId)
    : undefined;
  const missing = membershipId !== undefined && !team.isPending && !member;

  const reportedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!(refused || missing) || reportedFor.current === pathname) return;
    reportedFor.current = pathname;
    if (refused) notify.info(t(ERRORS_KEYS.api.http403, { ns: ERRORS_NS }));
    else {
      notify.info(
        t(ERRORS_KEYS.route.recordNotFound, {
          ns: ERRORS_NS,
          record: t(USERS_KEYS.record, { ns: USERS_NS }),
        }),
      );
    }
    close();
  }, [refused, missing, pathname, close, t]);

  if (isCreate && !refused) return { dialog: { kind: 'create' }, close };
  if (membershipId && !missing) {
    return { dialog: { kind: 'edit', membershipId, member }, close };
  }
  return { dialog: { kind: 'none' }, close };
}
