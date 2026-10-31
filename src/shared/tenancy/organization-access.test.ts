import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '@/core/http/queryClient.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import type * as MeContextModule from './me-context.ts';
import {
  type MeContext,
  meContextQueryKey,
  type OrganizationSummary,
} from './me-context.ts';
import type * as MyOrganizationSummariesModule from './my-organization-summaries.ts';
import { myOrganizationsQueryKey } from './my-organization-summaries.ts';

const { fetchMeContextMock, fetchOrganizationsMock } = vi.hoisted(() => ({
  fetchMeContextMock: vi.fn(),
  fetchOrganizationsMock: vi.fn(),
}));
vi.mock('./me-context.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MeContextModule>()),
  fetchMeContext: fetchMeContextMock,
}));
vi.mock('./my-organization-summaries.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyOrganizationSummariesModule>()),
  fetchMyOrganizationSummaries: fetchOrganizationsMock,
}));

import {
  resetOrganizationAccessFollowForTests,
  startOrganizationAccessFollow,
} from './organization-access.ts';
import { deriveOrgContext } from './organization-context.ts';

const TS = '2026-01-01T00:00:00.000Z';
const CLINIC = 'org_clinicaaaaaaaaaaaaaaaa';
const OTHER_CLINIC = 'org_clinicbbbbbbbbbbbbbbbb';

function summary(id: string, slug: string): OrganizationSummary {
  return {
    id,
    name: slug,
    slug,
    type: 'TEAM',
    status: 'ACTIVE',
    logoUrl: null,
    createdAt: TS,
    updatedAt: TS,
  };
}

function contextWith(permissions: string[]): MeContext {
  return {
    user: {
      id: 'usr_ada',
      email: 'ada@acme.test',
      isEmailVerified: true,
      isMfaEnabled: false,
      firstName: 'Ada',
      lastName: null,
      avatarUrl: null,
      status: 'ACTIVE',
      createdAt: TS,
      updatedAt: TS,
    },
    activeOrganization: summary(CLINIC, 'acme'),
    myPermissions: permissions,
    globalRole: null,
    deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
    personalOrganizationId: null,
  };
}

const PATIENTS = ['app', 'patients', CLINIC, 'list'];
const OTHER_PATIENTS = ['app', 'patients', OTHER_CLINIC, 'list'];
const BOTH_CLINICS = [summary(CLINIC, 'acme'), summary(OTHER_CLINIC, 'other')];

/** A read of the clinic that clinozy-be refuses with a 403 of this reason. */
function refusedRead(reason: string): void {
  void queryClient
    .fetchQuery({
      queryKey: ['app', 'patients', CLINIC, 'detail', 'pat_1'],
      queryFn: () =>
        Promise.reject(
          new HttpError('Forbidden', 403, '/api/v1/app/patients/pat_1', 'GET', {
            error: { reason },
          }),
        ),
    })
    .catch(() => undefined);
}

/*
 * E-3: a role downgraded or a membership ended elsewhere left this tab's permission set and its
 * cache as they were — patient files stayed on screen from cache after the member could no
 * longer open them.
 */
describe('startOrganizationAccessFollow', () => {
  const revalidate = vi.fn();
  let stop: () => void = () => undefined;

  beforeEach(() => {
    resetOrganizationAccessFollowForTests();
    fetchMeContextMock.mockReset();
    fetchOrganizationsMock.mockReset();
    revalidate.mockReset();
    const signedIn = contextWith(['patient:read', 'patient:update']);
    queryClient.setQueryData(meContextQueryKey, signedIn);
    queryClient.setQueryData(myOrganizationsQueryKey, BOTH_CLINICS);
    deriveOrgContext(signedIn);
    queryClient.setQueryData(PATIENTS, ['a patient of the clinic']);
    queryClient.setQueryData(OTHER_PATIENTS, ['a patient of the other clinic']);
    stop = startOrganizationAccessFollow({ revalidate });
  });

  afterEach(() => {
    stop();
    queryClient.clear();
    useOrganizationStore.getState().clearOrganization();
  });

  it('a downgraded role: reads its access again, drops the clinic’s cache, re-runs the guards', async () => {
    fetchMeContextMock.mockResolvedValue(contextWith(['patient:read']));
    fetchOrganizationsMock.mockResolvedValue(BOTH_CLINICS);

    refusedRead('missing_permission');

    await vi.waitFor(() => expect(revalidate).toHaveBeenCalledOnce());
    expect(fetchMeContextMock).toHaveBeenCalledOnce();
    expect(fetchOrganizationsMock).toHaveBeenCalledOnce();
    expect(useOrganizationStore.getState().permissions).toEqual(['patient:read']);
    expect(queryClient.getQueryData(PATIENTS)).toBeUndefined();
    // Another clinic's cache was read under another membership: it stays.
    expect(queryClient.getQueryData(OTHER_PATIENTS)).toEqual([
      'a patient of the other clinic',
    ]);
  });

  it('an ended membership: me/context refused, the clinic gone from the list', async () => {
    fetchMeContextMock.mockRejectedValue(
      new HttpError('Not found', 404, '/api/v1/auth/me/context', 'GET'),
    );
    fetchOrganizationsMock.mockResolvedValue([summary(OTHER_CLINIC, 'other')]);

    refusedRead('not_a_member');

    await vi.waitFor(() => expect(revalidate).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(PATIENTS)).toBeUndefined();
    expect(
      queryClient.getQueryData<OrganizationSummary[]>(myOrganizationsQueryKey),
    ).toEqual([summary(OTHER_CLINIC, 'other')]);
  });

  it('a permission the role never had: nothing dropped, no guard run, no second check soon after', async () => {
    fetchMeContextMock.mockResolvedValue(contextWith(['patient:read', 'patient:update']));
    fetchOrganizationsMock.mockResolvedValue(BOTH_CLINICS);

    refusedRead('missing_permission');
    await vi.waitFor(() => expect(fetchOrganizationsMock).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(fetchMeContextMock).toHaveBeenCalledOnce());
    refusedRead('missing_permission');
    await Promise.resolve();

    expect(revalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(PATIENTS)).toEqual(['a patient of the clinic']);
    expect(fetchMeContextMock).toHaveBeenCalledOnce();
  });

  it('ignores a 403 that is not about the access (an MFA policy, a read-only plan)', async () => {
    refusedRead('mfa_required');
    refusedRead('organization_read_only');
    await Promise.resolve();

    expect(fetchMeContextMock).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});
