import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  changeOnboardingSetup,
  completeOnboardingSetup,
  fetchOnboardingSetup,
  onboardingSetupQueryKeys,
} from './onboarding-setup-api.ts';

/** The setup object clinozy-be answers with. */
function setupRow(overrides: Record<string, unknown> = {}) {
  return {
    answered_steps: ['clinic_type'],
    skipped_items: [],
    main_branch_id: 'brn_mainaaaaaaaaaaaaaaaaa',
    next_step: 'you',
    live_checks: { clinic_type: true, main_branch: true, services: false },
    is_live: false,
    has_someone_to_book: false,
    guide_items: [
      { key: 'treatments', is_done: false, is_skipped: false, can_skip: true },
      { key: 'invite_team', is_done: false, is_skipped: false, can_skip: true },
      { key: 'first_appointment', is_done: false, is_skipped: false, can_skip: false },
    ],
    guide_done_count: 0,
    guide_total_count: 3,
    deferred_at: null,
    completed_at: null,
    guide_hidden_at: null,
    guide_done_at: null,
    completed_by_membership_id: null,
    updated_at: '2026-10-13T04:30:00Z',
    ...overrides,
  };
}

const answer = (data: unknown) => ({ data, meta: { request_id: 'req_1' } }) as never;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('onboardingSetupQueryKeys', () => {
  it('carries the organization', () => {
    expect(onboardingSetupQueryKeys.detail('org_a')).toEqual([
      'app',
      'onboarding-setup',
      'org_a',
    ]);
    expect(onboardingSetupQueryKeys.detail(null)).toEqual([
      'app',
      'onboarding-setup',
      null,
    ]);
  });
});

describe('fetchOnboardingSetup', () => {
  it('reads GET /app/onboarding-setup into the client’s words', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(answer(setupRow()));

    const setup = await fetchOnboardingSetup();

    expect(api.get).toHaveBeenCalledWith('/app/onboarding-setup');
    expect(setup).toEqual(
      expect.objectContaining({
        answeredSteps: ['clinic_type'],
        mainBranchId: 'brn_mainaaaaaaaaaaaaaaaaa',
        nextStep: 'you',
        isLive: false,
        guideTotalCount: 3,
      }),
    );
  });

  it('refuses an answer shaped differently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(answer(setupRow({ is_live: 'yes' })));
    await expect(fetchOnboardingSetup()).rejects.toThrow();
  });
});

describe('changeOnboardingSetup', () => {
  it('PATCHes only the set fields, in snake_case, with the action’s key', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(
      answer(setupRow({ skipped_items: ['treatments'] })),
    );

    const setup = await changeOnboardingSetup({
      change: { skippedItemsAdd: ['treatments'] },
      idempotencyKey: 'key-1',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/onboarding-setup', {
      body: { skipped_items_add: ['treatments'] },
      idempotencyKey: 'key-1',
    });
    expect(setup.skippedItems).toEqual(['treatments']);
  });

  it('defers with deferred: true', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(
      answer(setupRow({ deferred_at: '2026-10-13T04:40:00Z' })),
    );

    const setup = await changeOnboardingSetup({
      change: { deferred: true },
      idempotencyKey: 'key-2',
    });

    expect(api.patch).toHaveBeenCalledWith('/app/onboarding-setup', {
      body: { deferred: true },
      idempotencyKey: 'key-2',
    });
    expect(setup.deferredAt).toBe('2026-10-13T04:40:00Z');
  });
});

describe('completeOnboardingSetup', () => {
  it('POSTs …/complete with the action’s key and reads the live setup', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(
      answer(
        setupRow({
          is_live: true,
          next_step: null,
          completed_at: '2026-10-13T05:00:00Z',
          completed_by_membership_id: 'mem_owneraaaaaaaaaaaaaaaa',
        }),
      ),
    );

    const setup = await completeOnboardingSetup({ idempotencyKey: 'key-3' });

    expect(api.post).toHaveBeenCalledWith('/app/onboarding-setup/complete', {
      idempotencyKey: 'key-3',
    });
    expect(setup.isLive).toBe(true);
    expect(setup.completedByMembershipId).toBe('mem_owneraaaaaaaaaaaaaaaa');
  });

  it('passes the API’s refusal on as it came', async () => {
    const refusal = new Error('409');
    vi.mocked(api.post).mockRejectedValueOnce(refusal);
    await expect(completeOnboardingSetup({ idempotencyKey: 'key-4' })).rejects.toBe(
      refusal,
    );
  });
});
