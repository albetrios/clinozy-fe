import type { TFunction } from 'i18next';

import type { LucideIcon } from '@/shared/icons/index.ts';
import { Settings, ShieldCheck, UserPlus, Users, Zap } from '@/shared/icons/index.ts';
import type { MeContext } from '@/shared/tenancy/me-context.ts';

import { DASHBOARD_KEYS } from './dashboard.constants.ts';

export type DashboardQuickAction = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  testId: string;
};

export function buildDashboardQuickActions(
  ctx: MeContext,
  t: TFunction,
): DashboardQuickAction[] {
  const isTeam = ctx.activeOrganization?.type === 'TEAM';
  const can = (permission: string) => isTeam && ctx.myPermissions.includes(permission);
  const orgName = ctx.activeOrganization?.name ?? t(DASHBOARD_KEYS.workspaceNameFallback);

  return [
    can('invitation:manage')
      ? {
          href: '#settings/organization/members',
          icon: UserPlus,
          title: t(DASHBOARD_KEYS.quickActions.inviteTitle),
          description: t(DASHBOARD_KEYS.quickActions.inviteDescription, { orgName }),
          testId: 'dashboard-action-invite',
        }
      : null,
    can('role:manage')
      ? {
          href: '#settings/organization/roles',
          icon: ShieldCheck,
          title: t(DASHBOARD_KEYS.quickActions.rolesTitle),
          description: t(DASHBOARD_KEYS.quickActions.rolesDescription),
          testId: 'dashboard-action-roles',
        }
      : null,
    {
      href: '#settings/account/billing',
      icon: Zap,
      title: t(DASHBOARD_KEYS.quickActions.billingTitle),
      description: t(DASHBOARD_KEYS.quickActions.billingDescription),
      testId: 'dashboard-action-billing',
    },
    isTeam
      ? {
          href: '#settings/organization/general',
          icon: Settings,
          title: t(DASHBOARD_KEYS.quickActions.orgSettingsTitle),
          description: t(DASHBOARD_KEYS.quickActions.orgSettingsDescription),
          testId: 'dashboard-action-org-settings',
        }
      : null,
    {
      href: '#settings/account/profile',
      icon: Users,
      title: t(DASHBOARD_KEYS.quickActions.accountTitle),
      description: t(DASHBOARD_KEYS.quickActions.accountDescription),
      testId: 'dashboard-action-account',
    },
  ].filter((action) => action !== null);
}
