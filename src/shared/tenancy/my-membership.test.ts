import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./session-context.ts', () => ({ ensureSessionContext: vi.fn() }));
import { findMyMembershipId } from './my-membership.ts';
import { ensureSessionContext } from './session-context.ts';

describe('findMyMembershipId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads the caller’s membership off the session context — no member list scan', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      membershipId: 'mem_me',
    } as Awaited<ReturnType<typeof ensureSessionContext>>);

    await expect(findMyMembershipId()).resolves.toBe('mem_me');
  });

  it('answers null without a membership in the active organization', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      membershipId: null,
    } as Awaited<ReturnType<typeof ensureSessionContext>>);

    await expect(findMyMembershipId()).resolves.toBeNull();
  });
});
