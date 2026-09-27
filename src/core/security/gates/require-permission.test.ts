import { isNotFound, isRedirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/auth/service.ts', () => ({
  awaitAuthBootstrap: vi.fn().mockResolvedValue(undefined),
}));

import type { GateContext } from '@/core/security/gate.types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { requirePermissionGate } from './require-permission.ts';

/** Minimal gate context; `organizationSlug` set only for org-scoped routes. */
const gateCtx = (organizationSlug?: string): GateContext => ({
  location: { pathname: '/', search: '', hash: '', href: '/' },
  params: organizationSlug ? { organizationSlug } : {},
});

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.test', role: 'user' },
    isAuthenticated: true,
  });
  useOrganizationStore.getState().clearOrganization();
});

describe('requirePermissionGate (L5)', () => {
  it('passes when the active org grants the permission', async () => {
    useOrganizationStore.setState({ permissions: ['membership:read'] });
    await expect(
      requirePermissionGate('membership:read')(gateCtx()),
    ).resolves.toBeUndefined();
  });

  it('throws (redirect) when the permission is missing', async () => {
    useOrganizationStore.setState({ permissions: [] });
    await expect(requirePermissionGate('membership:read')(gateCtx())).rejects.toSatisfy(
      (error) => isRedirect(error),
    );
  });

  it('hides the surface as a 404 when onDeny is "notFound" (FE-52)', async () => {
    useOrganizationStore.setState({ permissions: [] });
    await expect(
      requirePermissionGate('membership:read', 'notFound')(gateCtx()),
    ).rejects.toSatisfy((error) => isNotFound(error));
  });

  it('fails closed when the route org differs from the synced context (2.1)', async () => {
    useOrganizationStore.setState({
      permissions: ['membership:read'],
      organizationSlug: 'acme',
    });
    await expect(
      requirePermissionGate('membership:read')(gateCtx('globex')),
    ).rejects.toSatisfy((error) => isRedirect(error));
  });
});
