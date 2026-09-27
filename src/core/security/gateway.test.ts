import { isNotFound, isRedirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PlatformConfigModule from '@/core/config/platform-config.ts';
import { isPlatformModuleEnabled } from '@/core/config/platform-config.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { gateway, gatewayFromManifest, gatewayFromPolicy } from './gateway.ts';

vi.mock('@/core/config/platform-config.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof PlatformConfigModule>();
  // Default: every module enabled — individual tests override per call.
  return { ...actual, isPlatformModuleEnabled: vi.fn(() => true) };
});

const ctx = {
  location: { pathname: '/x', search: '', hash: '', href: '/x' },
  params: {},
};

function signIn() {
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.test', role: 'user' },
    isAuthenticated: true,
  });
}

describe('gateway', () => {
  it('runs gates in order and threads the context', async () => {
    const calls: string[] = [];
    const run = gateway<{ n: number }>(
      (ctx) => {
        calls.push(`a:${ctx.n}`);
      },
      async (ctx) => {
        calls.push(`b:${ctx.n}`);
      },
    );

    await run({ n: 1 });

    expect(calls).toEqual(['a:1', 'b:1']);
  });

  it('short-circuits on the first gate that throws (later gates do not run)', async () => {
    const later = vi.fn();
    const run = gateway<unknown>(() => {
      throw new Error('halt');
    }, later);

    await expect(run({})).rejects.toThrow('halt');
    expect(later).not.toHaveBeenCalled();
  });

  it('rejects when an async gate rejects', async () => {
    const later = vi.fn();
    const run = gateway<unknown>(async () => {
      await Promise.reject(new Error('async-halt'));
    }, later);

    await expect(run({})).rejects.toThrow('async-halt');
    expect(later).not.toHaveBeenCalled();
  });

  it('passes when there are no gates', async () => {
    await expect(gateway<unknown>()({})).resolves.toBeUndefined();
  });
});

describe('gatewayFromPolicy (default-deny)', () => {
  beforeEach(() => {
    useOrganizationStore.getState().clearOrganization();
  });

  it('requires a session even for an empty policy', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    await expect(gatewayFromPolicy({})(ctx)).rejects.toBeDefined();
  });

  it('lets an authed user through an empty policy', async () => {
    signIn();
    await expect(gatewayFromPolicy({})(ctx)).resolves.toBeUndefined();
  });

  it('adds the permission gate when the policy names one', async () => {
    signIn();
    useOrganizationStore.setState({ permissions: [] });
    await expect(
      gatewayFromPolicy({ permission: 'membership:read' })(ctx),
    ).rejects.toBeDefined();
    useOrganizationStore.setState({ permissions: ['membership:read'] });
    await expect(
      gatewayFromPolicy({ permission: 'membership:read' })(ctx),
    ).resolves.toBeUndefined();
  });

  it('runs the static module gate before the permission gate (disabled module → notFound, permission unreached)', async () => {
    signIn();
    // Empty permissions would 403 if the permission gate ran first — it must not.
    useOrganizationStore.setState({ permissions: [] });
    vi.mocked(isPlatformModuleEnabled).mockReturnValueOnce(false);

    const run = gatewayFromPolicy({
      permission: 'membership:read',
      module: 'billing',
      onDeny: 'unauthorized',
    });
    const err = await run(ctx).then(
      () => undefined,
      (e: unknown) => e,
    );

    expect(isNotFound(err)).toBe(true); // module gate (404) won → ran before permission
    expect(isRedirect(err)).toBe(false); // not the /unauthorized redirect
  });
});

describe('gatewayFromManifest', () => {
  beforeEach(() => {
    useOrganizationStore.getState().clearOrganization();
  });

  it('maps manifest permission and module into the policy gateway', async () => {
    signIn();
    useOrganizationStore.setState({ permissions: ['organization:read'] });
    const run = gatewayFromManifest({
      permission: 'organization:read',
      module: 'billing',
      onDeny: 'unauthorized',
    });
    await expect(run(ctx)).resolves.toBeUndefined();
  });
});
