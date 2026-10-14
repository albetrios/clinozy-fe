import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

/**
 * Ordered steps of the post-signup onboarding wizard: Welcome → Your name →
 * Clinic name → Done. Questions and invitations are not asked here (clinic-setup
 * D4): inviting is the setup guide's, with real roles and the main branch.
 */
export const ONBOARDING_STEPS = ['welcome', 'profile', 'workspace', 'done'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Data collected across the onboarding wizard (persisted so it is resumable). */
interface OnboardingData {
  /** Profile name — split fields mirror clinozy-be `first_name` / `last_name`. */
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationSlug: string;
}

interface OnboardingStore {
  /** Current step index into the derived step list (`deriveOnboardingSteps`). */
  stepIndex: number;
  data: OnboardingData;
  completed: boolean;
  /**
   * Public id of the user this persisted progress belongs to. localStorage
   * outlives the session, so without an owner a NEW user on the same browser
   * would inherit the previous user's wizard step and data — and submit the
   * previous user's name onto their own account. `null` until first claimed
   * (also the shape of pre-existing stores from before this field existed —
   * those self-heal on the first {@link OnboardingStore.claimForUser}).
   */
  forUserId: string | null;
  /**
   * Id of the organization created by the finish step, if any. Set the moment
   * creation succeeds so a partial failure (e.g. the profile or the switch
   * rejects) never re-creates a DUPLICATE org when the user retries — the retry
   * reuses this.
   */
  createdOrganizationId: string | null;
  /**
   * Slug of the created org (mirrors {@link createdOrganizationId}) — drives the
   * post-onboarding navigation to the team's `/organization/$organizationSlug/*`
   * space (FE-22). Kept alongside the id so a retry after a partial failure
   * still knows where to land.
   */
  createdOrganizationSlug: string | null;

  setStepIndex: (index: number) => void;
  next: () => void;
  back: () => void;
  patch: (data: Partial<OnboardingData>) => void;
  setCreatedOrganizationId: (id: string | null) => void;
  setCreatedOrganizationSlug: (slug: string | null) => void;
  complete: () => void;
  reset: () => void;
  /**
   * Bind the persisted progress to `userId`, WIPING it first when it belongs
   * to a different (or unknown) user. Call before trusting any persisted
   * wizard state — the `/onboarding` route guard (`requireOnboardingWorkspace`
   * in `app/guards/route-guards.ts`) does this in `beforeLoad`, as soon as the
   * session context resolves and before the page renders, so one browser
   * profile can never leak one user's onboarding data into another user's
   * account — nor paint it for a frame on the way (ONB-4).
   */
  claimForUser: (userId: string) => void;
}

/** The persisted part of {@link OnboardingStore} — everything but the actions. */
type OnboardingProgress = Pick<
  OnboardingStore,
  | 'stepIndex'
  | 'data'
  | 'completed'
  | 'forUserId'
  | 'createdOrganizationId'
  | 'createdOrganizationSlug'
>;

const INITIAL_DATA: OnboardingData = {
  firstName: '',
  lastName: '',
  organizationName: '',
  organizationSlug: '',
};

/**
 * Version of the persisted shape. Version 1 dropped the Questions step (third in
 * every flow) and the Invite step (always just before Done) with their fields.
 */
const ONBOARDING_STORE_VERSION = 1;

/** Index of the step every version-0 flow had third: Questions. */
const REMOVED_QUESTIONS_STEP_INDEX = 2;

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function idOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Bring progress persisted by an earlier version up to the current shape.
 *
 * Version 0 still holds the removed steps: Questions was the third step of every
 * flow and Invite always sat just before Done, so a step past Questions moves
 * back by one — Questions itself lands on the step that followed it, Invite on
 * Done (the page clamps whatever runs past the end). What the removed steps
 * collected (team size, use case, referral, invite emails) is dropped.
 */
function migrateOnboardingProgress(
  persisted: unknown,
  version: number,
): OnboardingProgress {
  const stored = (persisted ?? {}) as Partial<Record<keyof OnboardingProgress, unknown>>;
  const data = (stored.data ?? {}) as Partial<Record<keyof OnboardingData, unknown>>;
  const stepIndex = typeof stored.stepIndex === 'number' ? stored.stepIndex : 0;
  return {
    stepIndex:
      version < ONBOARDING_STORE_VERSION && stepIndex > REMOVED_QUESTIONS_STEP_INDEX
        ? stepIndex - 1
        : stepIndex,
    data: {
      firstName: textOrEmpty(data.firstName),
      lastName: textOrEmpty(data.lastName),
      organizationName: textOrEmpty(data.organizationName),
      organizationSlug: textOrEmpty(data.organizationSlug),
    },
    completed: stored.completed === true,
    forUserId: idOrNull(stored.forUserId),
    createdOrganizationId: idOrNull(stored.createdOrganizationId),
    createdOrganizationSlug: idOrNull(stored.createdOrganizationSlug),
  };
}

/**
 * Client-side onboarding progress. Persisted to localStorage so a user can
 * close the tab mid-flow and resume where they left off. This is UI/session
 * state only — the final submission goes through the API.
 */
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      stepIndex: 0,
      data: INITIAL_DATA,
      completed: false,
      createdOrganizationId: null,
      createdOrganizationSlug: null,
      forUserId: null,

      setStepIndex: (stepIndex) => set({ stepIndex }),
      next: () =>
        set((s) => ({
          stepIndex: Math.min(s.stepIndex + 1, ONBOARDING_STEPS.length - 1),
        })),
      back: () => set((s) => ({ stepIndex: Math.max(s.stepIndex - 1, 0) })),
      patch: (data) => set((s) => ({ data: { ...s.data, ...data } })),
      setCreatedOrganizationId: (createdOrganizationId) => set({ createdOrganizationId }),
      setCreatedOrganizationSlug: (createdOrganizationSlug) =>
        set({ createdOrganizationSlug }),
      complete: () => set({ completed: true }),
      reset: () =>
        set({
          stepIndex: 0,
          data: INITIAL_DATA,
          completed: false,
          createdOrganizationId: null,
          createdOrganizationSlug: null,
          forUserId: null,
        }),
      claimForUser: (userId) =>
        set((s) =>
          s.forUserId === userId
            ? s
            : {
                stepIndex: 0,
                data: INITIAL_DATA,
                completed: false,
                createdOrganizationId: null,
                createdOrganizationSlug: null,
                forUserId: userId,
              },
        ),
    }),
    {
      name: `${PRODUCT_NAMESPACE}-onboarding`,
      version: ONBOARDING_STORE_VERSION,
      migrate: (persisted, version) =>
        migrateOnboardingProgress(persisted, version) as OnboardingStore,
    },
  ),
);
