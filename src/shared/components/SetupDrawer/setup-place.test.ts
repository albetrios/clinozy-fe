import { describe, expect, it } from 'vitest';

import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';

import {
  canonicalSetupPlace,
  drawerStepsDone,
  firstOpenStep,
  isStepUnlocked,
} from './setup-place.ts';

/** A clinic's setup, answered up to `answered` steps (the main branch is step 2's record). */
function setupAt(
  answered: 0 | 1 | 2 | 3,
  overrides: Partial<OnboardingSetup> = {},
): OnboardingSetup {
  return {
    answeredSteps: [
      ...(answered >= 1 ? (['clinic_type'] as const) : []),
      ...(answered >= 3 ? (['you'] as const) : []),
    ],
    skippedItems: [],
    mainBranchId: answered >= 2 ? 'brn_mainaaaaaaaaaaaaaaaaa' : null,
    nextStep: null,
    liveChecks: {
      clinic_type: answered >= 1,
      main_branch: answered >= 2,
      services: false,
    },
    isLive: false,
    hasSomeoneToBook: false,
    guideItems: [],
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

describe('drawerStepsDone', () => {
  it('names the steps by their hash names', () => {
    expect(drawerStepsDone(setupAt(0))).toEqual({
      'clinic-type': false,
      location: false,
      you: false,
    });
    expect(drawerStepsDone(setupAt(2))).toEqual({
      'clinic-type': true,
      location: true,
      you: false,
    });
  });

  it('reads step 2 from the main branch, not an answer', () => {
    const setup = setupAt(1, {
      liveChecks: { clinic_type: true, main_branch: true, services: false },
    });
    expect(drawerStepsDone(setup).location).toBe(true);
  });
});

describe('firstOpenStep', () => {
  it('is the first step not done', () => {
    expect(firstOpenStep(setupAt(0))).toBe('clinic-type');
    expect(firstOpenStep(setupAt(1))).toBe('location');
    expect(firstOpenStep(setupAt(2))).toBe('you');
  });

  it('is the last step once every step is done — it holds "Go live"', () => {
    expect(firstOpenStep(setupAt(3))).toBe('you');
  });

  it('is a step left open before a done one', () => {
    const setup = setupAt(0, {
      liveChecks: { clinic_type: false, main_branch: true, services: false },
    });
    expect(firstOpenStep(setup)).toBe('clinic-type');
  });
});

describe('isStepUnlocked (D14 — in order)', () => {
  it('opens the done steps and the first open one only', () => {
    const setup = setupAt(1);
    expect(isStepUnlocked(setup, 'clinic-type')).toBe(true);
    expect(isStepUnlocked(setup, 'location')).toBe(true);
    expect(isStepUnlocked(setup, 'you')).toBe(false);
  });

  it('locks every later step at the start', () => {
    expect(isStepUnlocked(setupAt(0), 'location')).toBe(false);
    expect(isStepUnlocked(setupAt(0), 'you')).toBe(false);
  });
});

describe('canonicalSetupPlace', () => {
  it('keeps a step that may open', () => {
    expect(canonicalSetupPlace(setupAt(2), 'clinic-type')).toBe('clinic-type');
    expect(canonicalSetupPlace(setupAt(2), 'location')).toBe('location');
    expect(canonicalSetupPlace(setupAt(2), 'you')).toBe('you');
  });

  it('moves a locked step, the bare #setup or an unknown place to the first open step', () => {
    expect(canonicalSetupPlace(setupAt(0), 'you')).toBe('clinic-type');
    expect(canonicalSetupPlace(setupAt(1), null)).toBe('location');
    expect(canonicalSetupPlace(setupAt(1), 'live')).toBe('location');
    expect(canonicalSetupPlace(setupAt(1), 'guide')).toBe('location');
  });

  it('once live: “You’re live” when asked for (or still on the last step), else the guide', () => {
    const live = setupAt(3, { isLive: true });
    expect(canonicalSetupPlace(live, 'live')).toBe('live');
    expect(canonicalSetupPlace(live, 'you')).toBe('live');
    expect(canonicalSetupPlace(live, 'guide')).toBe('guide');
    expect(canonicalSetupPlace(live, null)).toBe('guide');
    expect(canonicalSetupPlace(live, 'clinic-type')).toBe('guide');
    expect(canonicalSetupPlace(live, 'location')).toBe('guide');
  });
});
