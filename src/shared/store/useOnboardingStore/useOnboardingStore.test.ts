import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  // Clinic setup (D4): the wizard asks Welcome → Your name → Clinic name → Done.
  // The Questions and Invite steps are gone, and with them what they collected.
  it('asks four steps and keeps only the name and the clinic name', () => {
    expect(ONBOARDING_STEPS).toEqual(['welcome', 'profile', 'workspace', 'done']);
    expect(Object.keys(useOnboardingStore.getState().data).sort()).toEqual([
      'firstName',
      'lastName',
      'organizationName',
      'organizationSlug',
    ]);
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

  // A reset wizard is a new wizard: a `completed` left behind would send the next run
  // straight past every step with nothing asked.
  it('reset puts every field of a completed wizard back to its initial value', () => {
    const store = useOnboardingStore.getState();
    store.claimForUser('usr_done');
    store.patch({
      firstName: 'Ada',
      lastName: 'Lovelace',
      organizationName: 'Acme Inc.',
      organizationSlug: 'acme',
    });
    store.setStepIndex(ONBOARDING_STEPS.length - 1);
    store.setCreatedOrganizationId('org_done');
    store.setCreatedOrganizationSlug('acme');
    store.complete();
    expect(useOnboardingStore.getState().completed).toBe(true);

    useOnboardingStore.getState().reset();

    /** The store's values without its actions — what a reset has to put back. */
    const progressOf = (state: object) =>
      Object.fromEntries(
        Object.entries(state).filter(([, value]) => typeof value !== 'function'),
      );
    const initial = {
      stepIndex: 0,
      data: { firstName: '', lastName: '', organizationName: '', organizationSlug: '' },
      completed: false,
      forUserId: null,
      createdOrganizationId: null,
      createdOrganizationSlug: null,
    };
    expect(progressOf(useOnboardingStore.getInitialState())).toEqual(initial);
    expect(progressOf(useOnboardingStore.getState())).toEqual(initial);
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

  /*
   * Progress saved before the Questions and Invite steps were removed (version 0)
   * still counts them: Questions was every flow's third step and Invite sat just
   * before Done. Restored as is, a user mid-way would land a step too far — on
   * Done with the clinic name never asked.
   */
  describe('progress saved by the six-step wizard', () => {
    const storageKey = useOnboardingStore.persist.getOptions().name ?? '';

    /** Write a version-0 entry and restore the store from it. */
    async function restoreSaved(state: Record<string, unknown>) {
      localStorage.setItem(storageKey, JSON.stringify({ state, version: 0 }));
      await useOnboardingStore.persist.rehydrate();
    }

    afterEach(() => {
      localStorage.removeItem(storageKey);
    });

    it('resumes on the same step and drops what the removed steps collected', async () => {
      await restoreSaved({
        // Team-only, six steps: welcome/profile/questions/WORKSPACE/invite/done.
        stepIndex: 3,
        data: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          teamSize: '2–10',
          primaryUseCase: 'Internal tools',
          referralSource: 'Search',
          organizationName: 'Acme Inc.',
          organizationSlug: 'acme',
          invites: ['a@acme.test'],
        },
        completed: false,
        forUserId: 'usr_saved',
        createdOrganizationId: 'org_saved',
        createdOrganizationSlug: 'acme',
      });

      const state = useOnboardingStore.getState();
      expect(ONBOARDING_STEPS[state.stepIndex]).toBe('workspace');
      expect(state.data).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
        organizationName: 'Acme Inc.',
        organizationSlug: 'acme',
      });
      expect(state.forUserId).toBe('usr_saved');
      expect(state.createdOrganizationId).toBe('org_saved');
      expect(state.createdOrganizationSlug).toBe('acme');
    });

    it.each([
      { saved: 0, step: 'welcome' },
      { saved: 1, step: 'profile' },
      // Questions → the step that followed it.
      { saved: 2, step: 'workspace' },
      // Invite → Done.
      { saved: 4, step: 'done' },
    ])('moves saved step $saved to $step', async ({ saved, step }) => {
      await restoreSaved({ stepIndex: saved, data: {}, forUserId: 'usr_saved' });
      expect(ONBOARDING_STEPS[useOnboardingStore.getState().stepIndex]).toBe(step);
    });

    it('restores progress saved by this version unchanged', async () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: { stepIndex: 3, data: { firstName: 'Ada' }, forUserId: 'usr_now' },
          version: 1,
        }),
      );

      await useOnboardingStore.persist.rehydrate();

      expect(useOnboardingStore.getState().stepIndex).toBe(3);
      expect(useOnboardingStore.getState().forUserId).toBe('usr_now');
    });
  });
});
