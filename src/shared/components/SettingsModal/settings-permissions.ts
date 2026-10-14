import type { AccessContext, OrganizationPermission } from '@/core/rbac/policies.ts';
import { hasPermission } from '@/core/rbac/policies.ts';
import type { AccessCheck } from '@/shared/hooks/useCan/index.ts';

import { isSettingsModuleEnabled } from './settings-modules.ts';
import type {
  AccountSettingsSection,
  OrganizationSettingsSection,
  SettingsSectionRef,
} from './settings-sections.ts';

/**
 * Permission gating for settings sections. Route guards never see hash state,
 * so the modal enforces RBAC itself — reusing `core/rbac` policies, never
 * forking them. Every organization section is gated; most account sections are
 * not, and the two that are say so in {@link ACCOUNT_SECTION_PERMISSION}.
 */
const ORGANIZATION_SECTION_PERMISSION: Record<
  OrganizationSettingsSection,
  OrganizationPermission
> = {
  general: 'organization:read',
  // Read with `organization:read` (`GET /tenancy/organization` and `…/settings`); the panel
  // saves only with `organization:update`, read-only otherwise.
  clinic: 'organization:read',
  members: 'membership:read',
  roles: 'role:read',
};

/**
 * Account sections that still need a permission. Anything absent here needs only a
 * signed-in user.
 *
 * @remarks
 * Both entries are account sections that read organization-scoped data, which is why
 * they carry an organization permission despite the scope. `integrations` is gated on
 * `api-key:read` rather than a webhook code because API keys are its always-available
 * half — webhooks gate themselves separately inside the panel on `webhook:read`, and
 * each write is gated on the code clinozy-be enforces for it (`api-key:manage` /
 * `webhook:manage`). The codes travel separately: holding one is not holding the other.
 */
const ACCOUNT_SECTION_PERMISSION: Partial<
  Record<AccountSettingsSection, OrganizationPermission>
> = {
  billing: 'organization:read',
  integrations: 'api-key:read',
};

/**
 * Who sees the webhooks half of Integrations: `webhook:read`, in a team organization.
 *
 * @remarks
 * One check for the two places that ask it — the panel, which shows or hides its webhooks
 * section, and the section's head row, whose sub line names webhooks only when they are on
 * screen ("API keys and webhooks." vs "API keys."). The head row is also drawn by the
 * drawer's stand-in while the panel's code loads, so a second copy of the check could let
 * the stand-in and the panel disagree.
 */
export const INTEGRATIONS_WEBHOOKS_CHECK = {
  permission: 'webhook:read',
  teamOrganizationOnly: true,
} as const satisfies AccessCheck;

export function canViewSettingsSection(
  ref: SettingsSectionRef,
  ctx: AccessContext,
): boolean {
  if (!isSettingsModuleEnabled(ref)) return false;

  if (ref.scope === 'account') {
    const required = ACCOUNT_SECTION_PERMISSION[ref.section as AccountSettingsSection];
    return required === undefined || hasPermission(ctx, required);
  }
  return hasPermission(
    ctx,
    ORGANIZATION_SECTION_PERMISSION[ref.section as OrganizationSettingsSection],
  );
}
