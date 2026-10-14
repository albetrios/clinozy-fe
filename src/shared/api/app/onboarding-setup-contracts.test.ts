import { describe, expect, it } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

import {
  firstOpenGuideItem,
  isOnboardingSetupIncomplete,
  isSetupUnfinished,
  type OnboardingSetup,
  onboardingSetupChangeBody,
  onboardingSetupWire,
  setupProgress,
  setupStepsDone,
  toOnboardingSetup,
  wasLiveBeforeSetup,
} from './onboarding-setup-contracts.ts';

/** `GET /app/onboarding-setup` for a clinic that has just started setup. */
function wireRow(overrides: Record<string, unknown> = {}) {
  return {
    answered_steps: [],
    skipped_items: [],
    main_branch_id: null,
    next_step: 'clinic_type',
    live_checks: { clinic_type: false, main_branch: false, services: false },
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

/** The client's setup, from a fresh one with the given fields changed. */
function setupOf(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return { ...toOnboardingSetup(onboardingSetupWire.parse(wireRow())), ...overrides };
}

const LIVE: Partial<OnboardingSetup> = {
  isLive: true,
  nextStep: null,
  completedAt: '2026-10-13T05:00:00Z',
  completedByMembershipId: 'mem_owneraaaaaaaaaaaaaaaa',
};

describe('the setup on the wire', () => {
  it('reads every field into the client’s words', () => {
    const setup = toOnboardingSetup(
      onboardingSetupWire.parse(
        wireRow({
          answered_steps: ['clinic_type'],
          skipped_items: ['invite_team'],
          main_branch_id: 'brn_mainaaaaaaaaaaaaaaaaa',
          next_step: 'you',
          live_checks: { clinic_type: true, main_branch: true, services: false },
          has_someone_to_book: true,
          guide_items: [
            { key: 'treatments', is_done: true, is_skipped: false, can_skip: true },
            { key: 'invite_team', is_done: false, is_skipped: true, can_skip: true },
            {
              key: 'first_appointment',
              is_done: false,
              is_skipped: false,
              can_skip: false,
            },
          ],
          guide_done_count: 2,
          deferred_at: '2026-10-13T04:40:00Z',
          guide_hidden_at: '2026-10-13T04:50:00Z',
          guide_done_at: '2026-10-13T04:55:00Z',
        }),
      ),
    );

    expect(setup).toEqual({
      answeredSteps: ['clinic_type'],
      skippedItems: ['invite_team'],
      mainBranchId: 'brn_mainaaaaaaaaaaaaaaaaa',
      nextStep: 'you',
      liveChecks: { clinic_type: true, main_branch: true, services: false },
      isLive: false,
      hasSomeoneToBook: true,
      guideItems: [
        { key: 'treatments', isDone: true, isSkipped: false, canSkip: true },
        { key: 'invite_team', isDone: false, isSkipped: true, canSkip: true },
        { key: 'first_appointment', isDone: false, isSkipped: false, canSkip: false },
      ],
      guideDoneCount: 2,
      guideTotalCount: 3,
      deferredAt: '2026-10-13T04:40:00Z',
      completedAt: null,
      guideHiddenAt: '2026-10-13T04:50:00Z',
      guideDoneAt: '2026-10-13T04:55:00Z',
      completedByMembershipId: null,
      updatedAt: '2026-10-13T04:30:00Z',
    });
  });

  it('refuses a step, an answer or a guide item it does not know', () => {
    expect(() => onboardingSetupWire.parse(wireRow({ next_step: 'team' }))).toThrow();
    expect(() =>
      onboardingSetupWire.parse(wireRow({ answered_steps: ['location'] })),
    ).toThrow();
    expect(() =>
      onboardingSetupWire.parse(wireRow({ skipped_items: ['first_appointment'] })),
    ).toThrow();
    expect(() =>
      onboardingSetupWire.parse(
        wireRow({
          guide_items: [
            { key: 'logo', is_done: false, is_skipped: false, can_skip: true },
          ],
        }),
      ),
    ).toThrow();
  });
});

describe('onboardingSetupChangeBody', () => {
  it('sends each set field in the API’s words', () => {
    expect(
      onboardingSetupChangeBody({
        answeredStepsAdd: ['clinic_type'],
        skippedItemsAdd: ['treatments'],
        skippedItemsRemove: ['invite_team'],
        deferred: true,
        guideHidden: true,
      }),
    ).toEqual({
      answered_steps_add: ['clinic_type'],
      skipped_items_add: ['treatments'],
      skipped_items_remove: ['invite_team'],
      deferred: true,
      guide_hidden: true,
    });
  });

  it('leaves out what is not set, and keeps reopening the guide (false)', () => {
    expect(onboardingSetupChangeBody({ answeredStepsAdd: ['you'] })).toEqual({
      answered_steps_add: ['you'],
    });
    expect(onboardingSetupChangeBody({ guideHidden: false })).toEqual({
      guide_hidden: false,
    });
    expect(onboardingSetupChangeBody({})).toEqual({});
  });
});

describe('firstOpenGuideItem', () => {
  it('is the first item neither done nor skipped', () => {
    const setup = setupOf({
      guideItems: [
        { key: 'treatments', isDone: true, isSkipped: false, canSkip: true },
        { key: 'invite_team', isDone: false, isSkipped: true, canSkip: true },
        { key: 'first_appointment', isDone: false, isSkipped: false, canSkip: false },
      ],
    });
    expect(firstOpenGuideItem(setup)?.key).toBe('first_appointment');
  });

  it('is null once every item is done or skipped', () => {
    const setup = setupOf({
      guideItems: setupOf().guideItems.map((item) => ({
        ...item,
        isDone: item.key !== 'invite_team',
        isSkipped: item.key === 'invite_team',
      })),
    });
    expect(firstOpenGuideItem(setup)).toBeNull();
  });
});

describe('wasLiveBeforeSetup', () => {
  it('is a live clinic nobody took live (the one-time fill, OS8)', () => {
    expect(wasLiveBeforeSetup(setupOf({ ...LIVE, completedByMembershipId: null }))).toBe(
      true,
    );
    expect(wasLiveBeforeSetup(setupOf(LIVE))).toBe(false);
    expect(wasLiveBeforeSetup(setupOf())).toBe(false);
  });
});

describe('isSetupUnfinished', () => {
  it('asks for attention while the clinic is not live', () => {
    expect(isSetupUnfinished(setupOf())).toBe(true);
    expect(isSetupUnfinished(setupOf({ deferredAt: '2026-10-13T04:40:00Z' }))).toBe(true);
  });

  it('never once the guide is hidden', () => {
    expect(isSetupUnfinished(setupOf({ guideHiddenAt: '2026-10-13T04:50:00Z' }))).toBe(
      false,
    );
    expect(
      isSetupUnfinished(setupOf({ ...LIVE, guideHiddenAt: '2026-10-13T04:50:00Z' })),
    ).toBe(false);
  });

  it('never for a clinic live before setup shipped (D7)', () => {
    expect(isSetupUnfinished(setupOf({ ...LIVE, completedByMembershipId: null }))).toBe(
      false,
    );
  });

  it('asks for the guide after going live, until it is done', () => {
    expect(isSetupUnfinished(setupOf(LIVE))).toBe(true);
    expect(
      isSetupUnfinished(setupOf({ ...LIVE, guideDoneAt: '2026-10-13T06:00:00Z' })),
    ).toBe(false);
  });

  it('stops asking once every guide item is done or skipped', () => {
    const finished = setupOf().guideItems.map((item) => ({ ...item, isDone: true }));
    expect(isSetupUnfinished(setupOf({ ...LIVE, guideItems: finished }))).toBe(false);
  });
});

describe('setupStepsDone', () => {
  it('reads the answers and the main branch', () => {
    expect(setupStepsDone(setupOf())).toEqual({
      clinic_type: false,
      location: false,
      you: false,
    });
    expect(
      setupStepsDone(
        setupOf({
          answeredSteps: ['clinic_type', 'you'],
          liveChecks: { clinic_type: true, main_branch: true, services: false },
        }),
      ),
    ).toEqual({ clinic_type: true, location: true, you: true });
  });
});

describe('setupProgress', () => {
  it('counts the steps done of three while not live', () => {
    expect(setupProgress(setupOf())).toEqual({ done: 0, total: 3 });
    expect(
      setupProgress(
        setupOf({
          answeredSteps: ['clinic_type'],
          liveChecks: { clinic_type: true, main_branch: true, services: false },
        }),
      ),
    ).toEqual({ done: 2, total: 3 });
  });

  it('counts the guide’s items done or skipped once live', () => {
    expect(
      setupProgress(
        setupOf({ ...LIVE, answeredSteps: ['clinic_type', 'you'], guideDoneCount: 1 }),
      ),
    ).toEqual({ done: 1, total: 3 });
  });
});

describe('isOnboardingSetupIncomplete', () => {
  const refusal = (status: number, reason: string) =>
    new HttpError('refused', status, '/app/onboarding-setup/complete', 'POST', {
      error: { reason, detail: 'Setup is not complete.' },
    });

  it('is a 409 with the reason onboarding_setup_incomplete', () => {
    expect(isOnboardingSetupIncomplete(refusal(409, 'onboarding_setup_incomplete'))).toBe(
      true,
    );
  });

  it('is nothing else', () => {
    expect(isOnboardingSetupIncomplete(refusal(409, 'record_changed'))).toBe(false);
    expect(isOnboardingSetupIncomplete(refusal(422, 'onboarding_setup_incomplete'))).toBe(
      false,
    );
    expect(isOnboardingSetupIncomplete(new Error('onboarding_setup_incomplete'))).toBe(
      false,
    );
    expect(isOnboardingSetupIncomplete(undefined)).toBe(false);
  });
});
