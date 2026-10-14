import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as OnboardingSetupApiModule from '@/shared/api/app/onboarding-setup-api.ts';
import { onboardingSetupQueryKeys } from '@/shared/api/app/onboarding-setup-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

const api = vi.hoisted(() => ({
  fetchOnboardingSetup: vi.fn(),
  changeOnboardingSetup: vi.fn(),
  completeOnboardingSetup: vi.fn(),
}));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OnboardingSetupApiModule>()),
  ...api,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  useChangeOnboardingSetup,
  useCompleteOnboardingSetup,
  useOnboardingSetup,
  useSetupAccess,
  useSetupInvalidation,
  useSetupUnfinished,
} from './useOnboardingSetup.ts';

const KEY = onboardingSetupQueryKeys.detail('org_test');

/** A clinic's setup, not live yet unless the overrides say so. */
function setupOf(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: [],
    skippedItems: [],
    mainBranchId: null,
    nextStep: 'clinic_type',
    liveChecks: { clinic_type: false, main_branch: false, services: false },
    isLive: false,
    hasSomeoneToBook: false,
    guideItems: [
      { key: 'treatments', isDone: false, isSkipped: false, canSkip: true },
      { key: 'invite_team', isDone: false, isSkipped: false, canSkip: true },
      { key: 'first_appointment', isDone: false, isSkipped: false, canSkip: false },
    ],
    guideDoneCount: 0,
    guideTotalCount: 3,
    deferredAt: null,
    completedAt: null,
    guideHiddenAt: null,
    guideDoneAt: null,
    completedByMembershipId: null,
    updatedAt: '2026-10-13T04:30:00Z',
    ...overrides,
  };
}

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** A manager (`organization:update`) of a team clinic, access known. */
function signInManager() {
  useAuthStore.setState({
    user: { id: 'usr_1', email: 'owner@acme.test', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.setState({ organizationType: 'TEAM' });
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'organization:update']);
}

beforeEach(() => {
  vi.resetAllMocks();
  useOrganizationStore.getState().clearOrganization();
  useUIStore.setState({ previewRole: null });
  signInManager();
  api.fetchOnboardingSetup.mockResolvedValue(setupOf());
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useAuthStore.setState({ user: null });
});

describe('useSetupAccess', () => {
  it('lets a manager of a team clinic manage setup', () => {
    const { result } = renderHook(() => useSetupAccess());
    expect(result.current).toEqual({ canManageSetup: true, isResolved: true });
  });

  it('never in a personal workspace', () => {
    useOrganizationStore.setState({ organizationType: 'PERSONAL' });
    expect(renderHook(() => useSetupAccess()).result.current.canManageSetup).toBe(false);
  });

  it('never for a member without organization:update', () => {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    expect(renderHook(() => useSetupAccess()).result.current).toEqual({
      canManageSetup: false,
      isResolved: true,
    });
  });

  it('never in a View-as preview', () => {
    useUIStore.setState({ previewRole: 'rol_marketing' });
    expect(renderHook(() => useSetupAccess()).result.current.canManageSetup).toBe(false);
  });

  it('never while the permission set is not known yet', () => {
    useOrganizationStore.setState({
      permissions: ['organization:update'],
      permissionsResolved: false,
    });
    expect(renderHook(() => useSetupAccess()).result.current).toEqual({
      canManageSetup: false,
      isResolved: false,
    });
  });
});

describe('useOnboardingSetup', () => {
  it('reads the setup for a manager, under the organization’s key', async () => {
    const client = freshClient();
    const { result } = renderHook(() => useOnboardingSetup(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.fetchOnboardingSetup).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(KEY)).toEqual(setupOf());
  });

  it('reads nothing for a member, in a personal workspace, a preview or before access is known', async () => {
    const cases: (() => void)[] = [
      () => useOrganizationStore.getState().setPermissions(['organization:read']),
      () => useOrganizationStore.setState({ organizationType: 'PERSONAL' }),
      () => useUIStore.setState({ previewRole: 'rol_marketing' }),
      () => useOrganizationStore.getState().clearPermissions(),
    ];
    for (const arrange of cases) {
      signInManager();
      useUIStore.setState({ previewRole: null });
      arrange();
      const { result, unmount } = renderHook(() => useOnboardingSetup(), {
        wrapper: wrapperFor(freshClient()),
      });
      await act(async () => {});
      expect(result.current.fetchStatus).toBe('idle');
      unmount();
    }
    expect(api.fetchOnboardingSetup).not.toHaveBeenCalled();
  });
});

describe('useSetupUnfinished', () => {
  it('is false until the setup is read, then whether it asks for attention', async () => {
    const { result } = renderHook(() => useSetupUnfinished(), {
      wrapper: wrapperFor(freshClient()),
    });
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is false for a clinic live before setup shipped (D7)', async () => {
    api.fetchOnboardingSetup.mockResolvedValue(setupOf({ isLive: true, nextStep: null }));
    const client = freshClient();
    const { result } = renderHook(() => useSetupUnfinished(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(client.getQueryData(KEY)).toBeDefined());
    expect(result.current).toBe(false);
  });
});

describe('useSetupInvalidation', () => {
  /** The host's subscription beside any write, as the shell mounts them. */
  function renderWithWrite(client: QueryClient, write: () => Promise<unknown>) {
    return renderHook(
      () => {
        useSetupInvalidation();
        return useMutation({ mutationFn: write });
      },
      { wrapper: wrapperFor(client) },
    );
  }

  it('reads the setup again after a successful write while it is unfinished', async () => {
    const client = freshClient();
    client.setQueryData(KEY, setupOf());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderWithWrite(client, async () => 'saved');

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('leaves a finished setup alone', async () => {
    const client = freshClient();
    client.setQueryData(KEY, setupOf({ guideHiddenAt: '2026-10-13T06:00:00Z' }));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderWithWrite(client, async () => 'saved');

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('ignores a failed write, and a setup never read', async () => {
    const client = freshClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const succeeding = renderWithWrite(client, async () => 'saved');
    await act(async () => {
      await succeeding.result.current.mutateAsync();
    });
    succeeding.unmount();

    client.setQueryData(KEY, setupOf());
    const failing = renderWithWrite(client, async () => {
      throw new Error('refused');
    });
    await act(async () => {
      await failing.result.current.mutateAsync().catch(() => undefined);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useChangeOnboardingSetup', () => {
  it('sends the change with an idempotency key and stores the answer as the setup', async () => {
    const answer = setupOf({ deferredAt: '2026-10-13T04:40:00Z' });
    api.changeOnboardingSetup.mockResolvedValue(answer);
    const client = freshClient();
    client.setQueryData(KEY, setupOf());
    const { result } = renderHook(() => useChangeOnboardingSetup(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ deferred: true });
    });

    expect(api.changeOnboardingSetup).toHaveBeenCalledWith({
      change: { deferred: true },
      idempotencyKey: expect.any(String),
    });
    expect(client.getQueryData(KEY)).toEqual(answer);
  });
});

describe('useCompleteOnboardingSetup', () => {
  it('goes live with an idempotency key and stores the live setup', async () => {
    const live = setupOf({
      isLive: true,
      nextStep: null,
      completedByMembershipId: 'mem_owneraaaaaaaaaaaaaaaa',
    });
    api.completeOnboardingSetup.mockResolvedValue(live);
    const client = freshClient();
    const { result } = renderHook(() => useCompleteOnboardingSetup(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(api.completeOnboardingSetup).toHaveBeenCalledWith({
      idempotencyKey: expect.any(String),
    });
    expect(client.getQueryData(KEY)).toEqual(live);
  });

  it('keeps the setup as it was when going live is refused', async () => {
    api.completeOnboardingSetup.mockRejectedValue(new Error('409'));
    const client = freshClient();
    client.setQueryData(KEY, setupOf());
    const { result } = renderHook(() => useCompleteOnboardingSetup(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).rejects.toThrow('409');
    });

    expect(client.getQueryData(KEY)).toEqual(setupOf());
  });
});
