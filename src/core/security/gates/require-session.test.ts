import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/auth/service.ts', () => ({
  awaitAuthBootstrap: vi.fn().mockResolvedValue(undefined),
}));

import type { GateContext } from '@/core/security/gate.types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import { requireSession } from './require-session.ts';

const ctx: GateContext = {
  location: { pathname: '/dashboard', search: '', hash: '', href: '/dashboard' },
  params: {},
};

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('requireSession (L1)', () => {
  it('throws a redirect when unauthenticated', async () => {
    await expect(requireSession(ctx)).rejects.toThrow();
  });

  it('passes when authenticated', async () => {
    useAuthStore.setState({
      user: { id: 'u', email: 'a@b.test', role: 'user' },
      isAuthenticated: true,
    });
    await expect(requireSession(ctx)).resolves.toBeUndefined();
  });
});
