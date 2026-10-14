import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./session-context.ts', () => ({ ensureSessionContext: vi.fn() }));
vi.mock('./me-context.ts', () => ({ fetchMeContext: vi.fn() }));
import { fetchMeContext } from './me-context.ts';
import { findMyMembershipId } from './my-membership.ts';
import { ensureSessionContext } from './session-context.ts';

type Context = Awaited<ReturnType<typeof ensureSessionContext>>;
const contextFor = (organizationId: string, membershipId: string | null) =>
  ({ activeOrganization: { id: organizationId }, membershipId }) as Context;

describe('findMyMembershipId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads the caller’s membership off the session context — no member list scan', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(contextFor('org_a', 'mem_me'));

    await expect(findMyMembershipId('org_a')).resolves.toBe('mem_me');
    expect(fetchMeContext).not.toHaveBeenCalled();
  });

  it('answers null without a membership in the active organization', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(contextFor('org_a', null));

    await expect(findMyMembershipId('org_a')).resolves.toBeNull();
  });

  it('reads the context again when the cached one is still the previous workspace’s', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(
      contextFor('org_personal', 'mem_personal'),
    );
    vi.mocked(fetchMeContext).mockResolvedValue(contextFor('org_clinic', 'mem_clinic'));

    await expect(findMyMembershipId('org_clinic')).resolves.toBe('mem_clinic');
  });

  it('fails — to be retried — while the server still answers for another workspace', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(
      contextFor('org_personal', 'mem_personal'),
    );
    vi.mocked(fetchMeContext).mockResolvedValue(
      contextFor('org_personal', 'mem_personal'),
    );

    await expect(findMyMembershipId('org_clinic')).rejects.toThrow(
      'another organization',
    );
  });
});
