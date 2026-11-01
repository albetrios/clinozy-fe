import { afterEach, describe, expect, it } from 'vitest';

import { queryClient } from '@/core/http/queryClient.ts';
import { billingQueryKeys } from '@/shared/api/billing-query-keys.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';

import { meContextQueryKey } from './me-context.ts';
import { myOrganizationsQueryKey } from './my-organization-summaries.ts';
import {
  cancelOrganizationQueries,
  isOrganizationQuery,
  removeOrganizationQueries,
} from './organization-queries.ts';

const CLINIC = 'org_clinicaaaaaaaaaaaaaaaa';
const OTHER_CLINIC = 'org_clinicbbbbbbbbbbbbbbbb';

afterEach(() => {
  queryClient.clear();
});

describe('organization-queries', () => {
  it('knows a key by the organization it carries, wherever the key puts it', () => {
    expect(
      isOrganizationQuery({ queryKey: ['app', 'patients', CLINIC, 'list'] }, CLINIC),
    ).toBe(true);
    expect(isOrganizationQuery({ queryKey: orgQueryKeys.members(CLINIC) }, CLINIC)).toBe(
      true,
    );
    expect(
      isOrganizationQuery(
        { queryKey: billingQueryKeys.activeSubscription(CLINIC) },
        CLINIC,
      ),
    ).toBe(true);
    expect(
      isOrganizationQuery({ queryKey: orgQueryKeys.members(OTHER_CLINIC) }, CLINIC),
    ).toBe(false);
    expect(isOrganizationQuery({ queryKey: meContextQueryKey }, CLINIC)).toBe(false);
  });

  it('drops one clinic’s cache and nothing else', () => {
    queryClient.setQueryData(['app', 'patients', CLINIC, 'list'], ['patient']);
    queryClient.setQueryData(['app', 'patients', OTHER_CLINIC, 'list'], ['other']);
    queryClient.setQueryData(myOrganizationsQueryKey, []);

    removeOrganizationQueries(CLINIC);

    expect(queryClient.getQueryData(['app', 'patients', CLINIC, 'list'])).toBeUndefined();
    expect(queryClient.getQueryData(['app', 'patients', OTHER_CLINIC, 'list'])).toEqual([
      'other',
    ]);
    expect(queryClient.getQueryData(myOrganizationsQueryKey)).toEqual([]);
  });

  it('cancels one clinic’s reads in flight, keeping what they already had', async () => {
    const key = ['app', 'patients', CLINIC, 'list'];
    queryClient.setQueryData(key, ['cached']);
    let answer: (rows: string[]) => void = (_rows) => undefined;
    const read = queryClient.fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: () =>
        new Promise<string[]>((resolve) => {
          answer = resolve;
        }),
    });

    cancelOrganizationQueries(CLINIC);
    answer(['late answer']);

    await expect(read).resolves.toEqual(['cached']);
    expect(queryClient.getQueryData(key)).toEqual(['cached']);
  });

  it('cancels nothing without an organization', () => {
    expect(() => cancelOrganizationQueries(null)).not.toThrow();
  });
});
