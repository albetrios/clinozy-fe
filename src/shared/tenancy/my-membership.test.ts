import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./me-context.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchMeContext: vi.fn(),
}));
import { queryClient } from '@/core/http/queryClient.ts';

import { fetchMeContext, type MeContext, meContextQueryKey } from './me-context.ts';
import { findMyMembershipId } from './my-membership.ts';

const contextFor = (organizationId: string, membershipId: string | null) =>
  ({ activeOrganization: { id: organizationId }, membershipId }) as MeContext;

describe('findMyMembershipId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    queryClient.removeQueries({ queryKey: meContextQueryKey });
  });

  it('reads the caller’s membership off the session context — no member list scan', async () => {
    vi.mocked(fetchMeContext).mockResolvedValue(contextFor('org_a', 'mem_me'));

    await expect(findMyMembershipId('org_a')).resolves.toBe('mem_me');
  });

  it('answers null without a membership in the active organization', async () => {
    vi.mocked(fetchMeContext).mockResolvedValue(contextFor('org_a', null));

    await expect(findMyMembershipId('org_a')).resolves.toBeNull();
  });

  it('never takes the cached context, which a switch leaves with the previous membership', async () => {
    // An organization switch rewrites the cached context's organization but not its membership.
    queryClient.setQueryData(meContextQueryKey, contextFor('org_clinic', 'mem_personal'));
    vi.mocked(fetchMeContext).mockResolvedValue(contextFor('org_clinic', 'mem_clinic'));

    await expect(findMyMembershipId('org_clinic')).resolves.toBe('mem_clinic');
    expect(fetchMeContext).toHaveBeenCalledOnce();
  });

  it('fails — to be retried — while the server still answers for another workspace', async () => {
    vi.mocked(fetchMeContext).mockResolvedValue(
      contextFor('org_personal', 'mem_personal'),
    );

    await expect(findMyMembershipId('org_clinic')).rejects.toThrow(
      'another organization',
    );
  });
});
