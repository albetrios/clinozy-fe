import { beforeEach, describe, expect, it } from 'vitest';

import { ONBOARDING_STEPS, useOnboardingStore } from './useOnboardingStore.ts';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('starts at the first step with empty data', () => {
    const state = useOnboardingStore.getState();
    expect(state.stepIndex).toBe(0);
    expect(state.completed).toBe(false);
    expect(state.data.firstName).toBe('');
    expect(state.data.lastName).toBe('');
  });

  it('advances and clamps at the last step', () => {
    const { next } = useOnboardingStore.getState();
    for (let i = 0; i < ONBOARDING_STEPS.length + 3; i++) next();
    expect(useOnboardingStore.getState().stepIndex).toBe(ONBOARDING_STEPS.length - 1);
  });

  it('goes back and clamps at zero', () => {
    useOnboardingStore.getState().setStepIndex(2);
    useOnboardingStore.getState().back();
    expect(useOnboardingStore.getState().stepIndex).toBe(1);
    useOnboardingStore.getState().back();
    useOnboardingStore.getState().back();
    expect(useOnboardingStore.getState().stepIndex).toBe(0);
  });

  it('patches data and marks complete', () => {
    useOnboardingStore.getState().patch({ firstName: 'Ada', lastName: 'Lovelace' });
    useOnboardingStore.getState().complete();
    const state = useOnboardingStore.getState();
    expect(state.data.firstName).toBe('Ada');
    expect(state.data.lastName).toBe('Lovelace');
    expect(state.completed).toBe(true);
  });

  describe('claimForUser (cross-user leak guard)', () => {
    it("wipes a DIFFERENT user's persisted progress and binds the new owner", () => {
      const store = useOnboardingStore.getState();
      store.claimForUser('usr_previous');
      store.patch({ firstName: 'Prev', lastName: 'User', organizationName: 'Prev Org' });
      store.setStepIndex(3);
      store.setCreatedOrganizationId('org_prev');

      useOnboardingStore.getState().claimForUser('usr_next');

      const state = useOnboardingStore.getState();
      expect(state.forUserId).toBe('usr_next');
      expect(state.stepIndex).toBe(0);
      expect(state.data.firstName).toBe('');
      expect(state.data.organizationName).toBe('');
      expect(state.createdOrganizationId).toBeNull();
    });

    it('keeps progress when the SAME owner claims again (resume mid-wizard)', () => {
      const store = useOnboardingStore.getState();
      store.claimForUser('usr_same');
      store.patch({ firstName: 'Ada' });
      store.setStepIndex(2);

      useOnboardingStore.getState().claimForUser('usr_same');

      const state = useOnboardingStore.getState();
      expect(state.forUserId).toBe('usr_same');
      expect(state.stepIndex).toBe(2);
      expect(state.data.firstName).toBe('Ada');
    });

    it('wipes a legacy unclaimed store (pre-ownership data self-heals)', () => {
      // Simulates state persisted before forUserId existed: data, no owner.
      const store = useOnboardingStore.getState();
      store.patch({ firstName: 'Legacy' });
      store.setStepIndex(4);
      expect(useOnboardingStore.getState().forUserId).toBeNull();

      useOnboardingStore.getState().claimForUser('usr_fresh');

      const state = useOnboardingStore.getState();
      expect(state.forUserId).toBe('usr_fresh');
      expect(state.stepIndex).toBe(0);
      expect(state.data.firstName).toBe('');
    });

    it('reset clears the owner too', () => {
      useOnboardingStore.getState().claimForUser('usr_x');
      useOnboardingStore.getState().reset();
      expect(useOnboardingStore.getState().forUserId).toBeNull();
    });
  });
});
