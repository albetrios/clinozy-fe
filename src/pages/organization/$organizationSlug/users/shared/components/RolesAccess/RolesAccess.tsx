import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import type { ClinicRoleView } from '@/shared/api/clinic/access-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import {
  useClinicRole,
  useUpdateRoleMatrix,
} from '@/shared/hooks/useClinicRoles/index.ts';
import { useDeferredRowRemoval } from '@/shared/hooks/useDeferredRowRemoval/index.ts';
import {
  useDeleteRole,
  useRolePermissions,
  useUpdateRole,
} from '@/shared/hooks/useRoles/index.ts';
import { useTeam } from '@/shared/hooks/useTeam/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useNewRole } from '../../hooks/useNewRole/index.ts';
import {
  type RoleDirectory,
  useRoleDirectory,
} from '../../hooks/useRoleDirectory/index.ts';
import { UsersToolbar } from '../UsersToolbar/index.ts';
import { RoleList } from './RoleList.tsx';
import { RolePage } from './RolePage.tsx';
import { DEFAULT_ROLE, roleHolders, selectedRoleOf } from './roles-access.ts';
import { useRoleAccessWrites } from './use-role-access-writes.ts';
import { type RolesNavigation, useRolesNavigation } from './use-roles-navigation.ts';

/** Props of {@link RolesAccess}. */
export interface RolesAccessProps {
  /** The role on screen — the URL's `role`; Front desk by default. */
  selected: string | undefined;
}

/** A custom role's own description, or null while it has the default one "New role" gave it. */
function customDescription(
  role: ClinicRoleView | null,
  defaultDescription: string,
): string | null {
  const description = role?.preset === null ? role.platformRole?.description.trim() : '';
  return description && description !== defaultDescription ? description : null;
}

/**
 * A role's rename and description and, for an unheld custom role, its delete
 * — the Settings capabilities, relocated (D17).
 */
function useRoleAdmin(role: ClinicRoleView | null, directory: RoleDirectory) {
  const { t } = useTranslation([USERS_NS, ERRORS_NS]);
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const platformId = role?.platformRole?.id;
  const codes = useRolePermissions(platformId);
  const rename = useUpdateRole({ suppressSuccessToast: true });
  // The deferred toast owns the messages (SET-7): the delete stays quiet.
  const remove = useDeleteRole({ suppressSuccessToast: true });
  const updateMatrix = useUpdateRoleMatrix();
  const scheduleDeletion = useDeferredRowRemoval<RoleSummary>(
    orgQueryKeys.roles(organizationId),
  );

  /** Save the role's name and description over its codes as they are (a full replace). */
  const save = (name: string, description: string) => {
    const platformRole = role?.platformRole;
    if (!(platformRole && codes.data)) return;
    rename.mutate({ id: platformRole.id, name, description, permissions: codes.data });
  };

  return {
    codes: codes.data,
    description: customDescription(role, t(USERS_KEYS.roles.purposes.custom)),
    describe: (description: string) => {
      const platformRole = role?.platformRole;
      if (!platformRole) return;
      // clinozy-be needs two characters at least; an emptied box is the default.
      save(
        platformRole.name,
        description.length >= 2 ? description : t(USERS_KEYS.roles.purposes.custom),
      );
    },
    rename: (name: string) => {
      const platformRole = role?.platformRole;
      if (!(role && platformRole && codes.data)) return;
      const taken = directory.roles.some(
        (other) =>
          other.key !== role.key &&
          directory.label(other.key).trim().toLowerCase() === name.toLowerCase(),
      );
      if (taken) {
        notify.error(t(USERS_KEYS.roles.duplicateName, { name }));
        return;
      }
      save(name, platformRole.description || t(USERS_KEYS.roles.purposes.custom));
    },
    remove: (onScheduled: () => void) => {
      const platformRole = role?.platformRole;
      if (!(role && platformRole)) return;
      const name = directory.label(role.key);
      scheduleDeletion({
        id: platformRole.id,
        pendingMessage: t(USERS_KEYS.roles.deleteRole.pending, { name }),
        committedMessage: t(ERRORS_KEYS.frontend.hooks.roles.deleteSuccess, {
          ns: ERRORS_NS,
        }),
        toastId: `delete-role-${platformRole.id}`,
        commit: async () => {
          await remove.mutateAsync(platformRole.id);
          await updateMatrix.mutateAsync({ kind: 'dropCustom', key: role.key });
        },
      });
      onScheduled();
    },
  };
}

/** Everything the Roles page shows for the URL's role. */
function useRolesScreen(selected: string | undefined) {
  const directory = useRoleDirectory();
  const team = useTeam();
  const current = selectedRoleOf(directory.roles, selected);
  const { role, isPending } = useClinicRole(current?.key);
  const admin = useRoleAdmin(role, directory);
  const writes = useRoleAccessWrites(role, admin.codes);
  const holders = role ? roleHolders(role, team.members) : [];
  return {
    directory,
    admin,
    writes,
    current,
    role,
    holders,
    label: role ? directory.label(role.key) : '',
    items: directory.roles.map((view) => ({
      role: view,
      label: directory.label(view.key),
      holders: roleHolders(view, team.members),
    })),
    loading: directory.isPending || (team.isPending && team.members.length === 0),
    rolePending: isPending,
    // The Settings capability, relocated: a custom role nobody holds (D17).
    deletable:
      role !== null &&
      role.preset === null &&
      role.platformRole !== null &&
      holders.length === 0 &&
      writes.lock === null,
  };
}

/** The role page — or its skeleton while the roles, the Team, the matrix or the role's codes load. */
function RolePane({
  screen,
  navigation,
  onDelete,
  onBack,
}: {
  screen: ReturnType<typeof useRolesScreen>;
  navigation: RolesNavigation;
  onDelete: () => void;
  onBack: (() => void) | undefined;
}) {
  const { role, label, directory, writes } = screen;
  if (screen.loading || screen.rolePending || !role) {
    return <SkeletonRows rows={9} label={label} className="p-4" />;
  }
  return (
    <RolePage
      role={role}
      label={label}
      others={screen.items
        .filter((item) => item.role.key !== role.key)
        .map((item) => ({ role: item.role, label: item.label }))}
      holders={screen.holders}
      alsoOf={(member) =>
        directory
          .pills(member.roleKeys.filter((key) => key !== role.key))
          .map((pill) => pill.label)
          .join(' + ')
      }
      writes={writes}
      renamable={role.preset === null && writes.lock === null}
      onRename={screen.admin.rename}
      description={screen.admin.description}
      onDescribe={screen.admin.describe}
      codes={role.platformBacked ? screen.admin.codes : undefined}
      onDelete={screen.deletable ? onDelete : undefined}
      onOpenMember={(member) => navigation.openMember(member, role.key)}
      onPreview={() => navigation.preview(role, label)}
      onBack={onBack}
    />
  );
}

/**
 * Users › Roles & access (KICKOFF §6.12; `users.md:19, 42–77`; H:1117–1146) —
 * the room toolbar with "New role", over master–detail, neither a drawer nor
 * a table: one card split `minmax(220px,264px) minmax(0,1fr)` from `md`, the
 * role list on `canvas`, the role page scrolling on its own. On a phone one
 * pane at a time: the list fills the screen and tapping a role replaces it
 * with the page, which starts with "Back to roles" (component state, §5);
 * "New role" selects the new role but stays on the list (H:5187). Skeletons
 * in both panes while the roles, the Team and the matrix load; switching roles
 * is instant. Family shared: the Roles page renders it, and so does the Team
 * page behind a member drawer opened from it (`?from=roles`).
 */
export function RolesAccess({ selected }: RolesAccessProps) {
  const { t } = useTranslation(USERS_NS);
  const phone = useViewportTier() === 'phone';
  const [pane, setPane] = useState<'list' | 'role'>(selected ? 'role' : 'list');
  const [deleting, setDeleting] = useState(false);
  const navigation = useRolesNavigation();
  const newRole = useNewRole(navigation.select);
  const screen = useRolesScreen(selected);
  const { label } = screen;

  return (
    <>
      <UsersToolbar
        tab="roles"
        primary={{
          id: 'new-role',
          label: t(USERS_KEYS.primary.newRole),
          onSelect: () => void newRole(),
        }}
      />
      <div
        data-slot="card"
        data-testid="users-roles-panel"
        className={cn(
          // Rounded and edged on a phone too (H:1117), unlike the Team's table.
          'bg-card text-card-foreground m-(--room-card-margin) grid min-h-0 flex-1 overflow-hidden rounded-xl border',
          'grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(220px,264px)_minmax(0,1fr)]',
        )}
      >
        {phone && pane === 'role' ? null : (
          <div className="flex min-h-0 flex-col md:border-e">
            {screen.loading ? (
              <SkeletonRows rows={7} label={t(USERS_KEYS.roles.label)} className="p-2" />
            ) : (
              <RoleList
                items={screen.items}
                selected={screen.current?.key}
                onSelect={(view) => {
                  navigation.select(view.key);
                  setPane('role');
                }}
              />
            )}
          </div>
        )}
        {phone && pane === 'list' ? null : (
          <div className="min-h-0 min-w-0 overflow-y-auto">
            <RolePane
              screen={screen}
              navigation={navigation}
              onDelete={() => setDeleting(true)}
              onBack={phone ? () => setPane('list') : undefined}
            />
          </div>
        )}
        <ConfirmDialog
          open={deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(false);
          }}
          title={t(USERS_KEYS.roles.deleteRole.title, { name: label })}
          description={t(USERS_KEYS.roles.deleteRole.description)}
          confirmLabel={t(USERS_KEYS.roles.deleteRole.confirm)}
          destructive
          onConfirm={() => {
            setDeleting(false);
            screen.admin.remove(() => navigation.select(DEFAULT_ROLE));
          }}
        />
      </div>
    </>
  );
}
