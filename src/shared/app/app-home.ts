import { redirect } from '@tanstack/react-router';

import { APP_MODULES } from '@/core/config/app-modules.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import { resolveAccessFromCodes } from '@/shared/api/app/access-api.ts';
import type { Section } from '@/shared/api/app/app-schema.ts';
import { getRolePermissions } from '@/shared/api/organization-api.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { APP_SECTION_ORDER } from './app-sections.ts';

/**
 * Each room's route. `/medical` and `/stock` redirect to their first tab, so
 * a link to the room always lands somewhere real.
 */
export const APP_SECTION_ROUTES = {
  today: '/organization/$organizationSlug/today',
  leads: '/organization/$organizationSlug/leads',
  appointments: '/organization/$organizationSlug/appointments',
  patients: '/organization/$organizationSlug/patients',
  medical: '/organization/$organizationSlug/medical',
  stock: '/organization/$organizationSlug/stock',
  payments: '/organization/$organizationSlug/payments',
  tasks: '/organization/$organizationSlug/tasks',
  offerings: '/organization/$organizationSlug/offerings',
  users: '/organization/$organizationSlug/users',
  branches: '/organization/$organizationSlug/branches',
} as const satisfies Record<Section, string>;

/**
 * Where a member's work is, from their codes alone (D25 re-derived on codes, research-users §5a):
 * whoever books visits works the floor; whoever sells medicines the pharmacy counter; whoever
 * reads the money the till; whoever reads enquiries the Leads room. Each preset lands where D25
 * put it — Owner, Admin, Doctor, Therapist, Front desk and Counsellor on Today, Pharmacist on
 * Medical, Accountant on Payments, Marketing on Leads — and an edited or custom role lands by
 * what it holds. `appointment:create`, not `:read`: the Pharmacist reads appointments (D83) but
 * books none, and still sells.
 */
const HOME_BY_CODE: readonly (readonly [code: string, home: Section])[] = [
  ['appointment:create', 'today'],
  ['medicine:create', 'medical'],
  ['payment:read', 'payments'],
  ['lead:read', 'leads'],
];

/**
 * Where a member lands: the first home whose code they hold and whose room is open to them, else
 * the first open room in nav order. Null when no clinic room is open at all.
 */
export function appHomeSection(
  canCode: (code: string) => boolean,
  isOpen: (section: Section) => boolean,
): Section | null {
  const preferred = HOME_BY_CODE.find(
    ([code, home]) => canCode(code) && isOpen(home),
  )?.[1];
  return preferred ?? APP_SECTION_ORDER.find(isOpen) ?? null;
}

/**
 * The signed-in member's home route in this organization — the org index and an unknown in-org
 * path send them here (`S:115`). Uses the codes in force — their own, or the previewed role's
 * while View-as runs (the same rule as `useAppAccess`) — and the deployment's enabled modules;
 * null when no clinic room is open, and the org home shows its "nothing is switched on" state
 * instead (L-63).
 */
export async function appHomeRoute(organizationSlug: string) {
  const { permissions, organizationId } = useOrganizationStore.getState();
  const { previewRole } = useUIStore.getState();
  const codes: readonly string[] = previewRole
    ? await queryClient
        .query({
          queryKey: orgQueryKeys.rolePermissions(organizationId, previewRole),
          queryFn: () => getRolePermissions(previewRole),
        })
        .catch(() => [])
    : permissions;
  const held = new Set<string>(codes);
  const access = resolveAccessFromCodes(codes);
  const section = appHomeSection(
    (code) => held.has(code),
    (candidate) =>
      isModuleEnabled(APP_MODULES[candidate]) && access.can(candidate, 'view'),
  );
  return section
    ? { to: APP_SECTION_ROUTES[section], params: { organizationSlug } }
    : null;
}

/**
 * Where an old Users › Branches path lands (before change-branches-in-navbar): `rest` is what
 * followed `/users/branches/` — `create` opens New branch, `<id>/edit` that branch's drawer, and
 * anything else the list. The paths are spelled here rather than taken from
 * `branches-builders.ts` so the redirect pulls no other chunk.
 */
export function movedBranchesLocation({
  organizationSlug,
  rest,
}: {
  organizationSlug: string;
  rest: string;
}) {
  const params = { organizationSlug };
  const edit = /^([^/]+)\/edit\/?$/.exec(rest);
  if (edit?.[1]) {
    return {
      to: '/organization/$organizationSlug/branches/$branchId/edit',
      params: { ...params, branchId: edit[1] },
    } as const;
  }
  return {
    to: /^create\/?$/.test(rest)
      ? '/organization/$organizationSlug/branches/create'
      : APP_SECTION_ROUTES.branches,
    params,
  } as const;
}

/**
 * The redirect route's whole job, loaded on demand like {@link appHomeRoute} so it stays off the
 * entry chunk: throws the redirect to {@link movedBranchesLocation}, keeping the search and the
 * hash (Settings) as the old URL had them.
 */
export function redirectFromUsersBranches(params: {
  organizationSlug: string;
  _splat?: string;
}): never {
  throw redirect({
    ...movedBranchesLocation({
      organizationSlug: params.organizationSlug,
      rest: params._splat ?? '',
    }),
    search: true,
    hash: true,
    replace: true,
  });
}
