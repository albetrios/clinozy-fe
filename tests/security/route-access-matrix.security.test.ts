/**
 * Route-access matrix (FE-52). Composes the real security gateway for a few
 * representative route policies and asserts, across a matrix of user states
 * (signed-out / limited / read-only member / admin), exactly which routes are
 * reachable. This is the adversarial backstop for authorization: every "blocked"
 * cell proves an unauthorized caller is turned away by the gateway (L1 session →
 * L5 permission → L6b module), not merely by a hidden nav item.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireModuleGate } from '@/core/security/gates/require-module.ts';
import { requirePermissionGate } from '@/core/security/gates/require-permission.ts';
import { requireSession } from '@/core/security/gates/require-session.ts';
import { gateway, gatewayFromManifest } from '@/core/security/gateway.ts';
import { manifest as todayManifest } from '@/pages/organization/$organizationSlug/today/today.manifest.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const disabledModulesRef = vi.hoisted(() => ({ value: new Set<string>() }));
vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    get disabledModules() {
      return disabledModulesRef.value;
    },
  },
}));

const ctx = {
  location: { pathname: '/x', search: '', hash: '', href: '/x' },
  params: {},
};

const GUARDS = {
  'authed-only': gateway(requireSession),
  'members:read': gateway(requireSession, requirePermissionGate('membership:read')),
  'members:manage': gateway(
    requireSession,
    requirePermissionGate('membership:read'),
    requirePermissionGate('membership:update'),
  ),
  'today-manifest': gatewayFromManifest(todayManifest),
} as const;

type GuardName = keyof typeof GUARDS;
type Perm = 'membership:read' | 'membership:update' | 'organization:read';

interface UserState {
  name: string;
  authed: boolean;
  perms: Perm[];
  /** Whether the deployment switches the Today room's module (`clinic-today`) on. */
  todayEnabled: boolean;
}

const STATES: UserState[] = [
  { name: 'signed-out', authed: false, perms: [], todayEnabled: true },
  { name: 'limited (no perms)', authed: true, perms: [], todayEnabled: true },
  {
    name: 'member (read-only)',
    authed: true,
    perms: ['membership:read', 'organization:read'],
    todayEnabled: true,
  },
  {
    name: 'admin',
    authed: true,
    perms: ['membership:read', 'membership:update', 'organization:read'],
    todayEnabled: true,
  },
  {
    name: 'admin (Today switched off)',
    authed: true,
    perms: ['organization:read'],
    todayEnabled: false,
  },
];

/** The authoritative expectation, as explicit logic (no dynamic lookup). */
function expectedReachable(state: UserState, guard: GuardName): boolean {
  if (!state.authed) return false;
  if (guard === 'authed-only') return true;
  if (guard === 'today-manifest') {
    if (!state.todayEnabled) return false;
    return state.perms.includes('organization:read');
  }
  const canRead = state.perms.includes('membership:read');
  if (guard === 'members:read') return canRead;
  return canRead && state.perms.includes('membership:update');
}

function applyState(state: UserState) {
  disabledModulesRef.value = state.todayEnabled ? new Set() : new Set(['clinic-today']);
  if (state.authed) {
    useAuthStore.setState({
      user: { id: 'u', email: 'a@b.test', role: 'user' },
      isAuthenticated: true,
    });
  } else {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  }
  useOrganizationStore.setState({ permissions: state.perms });
}

beforeEach(() => {
  useOrganizationStore.getState().clearOrganization();
  disabledModulesRef.value = new Set();
});

describe('route access matrix', () => {
  for (const state of STATES) {
    for (const [guardName, guard] of Object.entries(GUARDS)) {
      const reachable = expectedReachable(state, guardName as GuardName);
      it(`${state.name} → ${guardName} → ${reachable ? 'reachable' : 'blocked'}`, async () => {
        applyState(state);
        const run = guard(ctx);
        if (reachable) {
          await expect(run).resolves.toBeUndefined();
        } else {
          await expect(run).rejects.toBeDefined();
        }
      });
    }
  }
});

describe('requireModuleGate in gateway chain', () => {
  it('blocks when billing module is disabled', async () => {
    disabledModulesRef.value = new Set(['billing']);
    useAuthStore.setState({
      user: { id: 'u', email: 'a@b.test', role: 'user' },
      isAuthenticated: true,
    });
    useOrganizationStore.setState({ permissions: ['organization:read'] });
    await expect(
      gateway(requireSession, requireModuleGate('billing'))(ctx),
    ).rejects.toBeDefined();
  });
});
