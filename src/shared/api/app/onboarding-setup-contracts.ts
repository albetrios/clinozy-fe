import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { apiErrorReason } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

/*
 * The clinic setup as the shell, the setup drawer and the guide read it (feat-clinic-setup KICKOFF
 * §5; clinozy-be routes-final §2.A — `GET`/`PATCH /app/onboarding-setup`,
 * `POST /app/onboarding-setup/complete`). Every tick is read from the clinic's records by the
 * server; the client never ticks anything but a skip (D5, OS3).
 */

/** The steps the drawer walks, in order — what `next_step` names (D26). */
const ONBOARDING_SETUP_STEP_VALUES = [
  'clinic_type',
  'location',
  'you',
  'go_live',
] as const;
/** One step of {@link ONBOARDING_SETUP_STEP_VALUES}. */
type OnboardingSetupStep = (typeof ONBOARDING_SETUP_STEP_VALUES)[number];

/** The steps the server stores as answered — the other steps read from records. */
const ONBOARDING_SETUP_ANSWERED_STEP_VALUES = ['clinic_type', 'you'] as const;
/** One answer of {@link ONBOARDING_SETUP_ANSWERED_STEP_VALUES}. */
type OnboardingSetupAnsweredStep = (typeof ONBOARDING_SETUP_ANSWERED_STEP_VALUES)[number];

/** The short guide's three items, in their order (D28). */
const ONBOARDING_SETUP_GUIDE_ITEM_VALUES = [
  'treatments',
  'invite_team',
  'first_appointment',
] as const;
/** One item of {@link ONBOARDING_SETUP_GUIDE_ITEM_VALUES}. */
export type OnboardingSetupGuideItemKey =
  (typeof ONBOARDING_SETUP_GUIDE_ITEM_VALUES)[number];

/** The guide items a manager may skip — the first appointment cannot be (RF§2.A.9). */
const ONBOARDING_SETUP_SKIPPABLE_ITEM_VALUES = ['treatments', 'invite_team'] as const;
/** One item of {@link ONBOARDING_SETUP_SKIPPABLE_ITEM_VALUES}. */
export type OnboardingSetupSkippableItem =
  (typeof ONBOARDING_SETUP_SKIPPABLE_ITEM_VALUES)[number];

/** The checks going live needs (D26) — each named when going live is refused. */
type OnboardingSetupLiveCheck = 'clinic_type' | 'main_branch' | 'services';

/** `GET /app/onboarding-setup`'s object, as the API types it. */
type ApiOnboardingSetup = NonNullable<ApiData<'/app/onboarding-setup', 'get'>>;

/** The setup object on the wire (routes-final §2.A.6); every field is present in practice. */
export const onboardingSetupWire = wireSchema<ApiOnboardingSetup>()(
  z.object({
    answered_steps: z.array(z.enum(ONBOARDING_SETUP_ANSWERED_STEP_VALUES)),
    skipped_items: z.array(z.enum(ONBOARDING_SETUP_SKIPPABLE_ITEM_VALUES)),
    main_branch_id: z.string().nullable(),
    next_step: z.enum(ONBOARDING_SETUP_STEP_VALUES).nullable(),
    live_checks: z.object({
      clinic_type: z.boolean(),
      main_branch: z.boolean(),
      services: z.boolean(),
    }),
    is_live: z.boolean(),
    has_someone_to_book: z.boolean(),
    guide_items: z.array(
      z.object({
        key: z.enum(ONBOARDING_SETUP_GUIDE_ITEM_VALUES),
        is_done: z.boolean(),
        is_skipped: z.boolean(),
        can_skip: z.boolean(),
      }),
    ),
    guide_done_count: z.number().int(),
    guide_total_count: z.number().int(),
    deferred_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    guide_hidden_at: z.string().nullable(),
    guide_done_at: z.string().nullable(),
    completed_by_membership_id: z.string().nullable(),
    updated_at: z.string(),
  }),
);

/** One item of the guide, ticked by the server from the clinic's records. */
export interface OnboardingSetupGuideItem {
  key: OnboardingSetupGuideItemKey;
  isDone: boolean;
  isSkipped: boolean;
  canSkip: boolean;
}

/** The clinic's setup, as the shell, the drawer and the guide read it. */
export interface OnboardingSetup {
  answeredSteps: OnboardingSetupAnsweredStep[];
  skippedItems: OnboardingSetupSkippableItem[];
  /** The active main branch (`brn_…`), or null before step 2. */
  mainBranchId: string | null;
  /** The drawer's next step; null once the clinic is live. */
  nextStep: OnboardingSetupStep | null;
  liveChecks: Record<OnboardingSetupLiveCheck, boolean>;
  isLive: boolean;
  /** A Doctor or Therapist (main or extra role) can be booked (D15). */
  hasSomeoneToBook: boolean;
  guideItems: OnboardingSetupGuideItem[];
  /** Done or skipped. */
  guideDoneCount: number;
  guideTotalCount: number;
  /** "Explore first" — the drawer stops opening by itself. */
  deferredAt: string | null;
  completedAt: string | null;
  guideHiddenAt: string | null;
  /** When every guide item was first done or skipped — stored once (D20). */
  guideDoneAt: string | null;
  completedByMembershipId: string | null;
  updatedAt: string;
}

/** A wire object as the client reads it. */
export function toOnboardingSetup(
  row: z.output<typeof onboardingSetupWire>,
): OnboardingSetup {
  return {
    answeredSteps: row.answered_steps,
    skippedItems: row.skipped_items,
    mainBranchId: row.main_branch_id,
    nextStep: row.next_step,
    liveChecks: {
      clinic_type: row.live_checks.clinic_type,
      main_branch: row.live_checks.main_branch,
      services: row.live_checks.services,
    },
    isLive: row.is_live,
    hasSomeoneToBook: row.has_someone_to_book,
    guideItems: row.guide_items.map((item) => ({
      key: item.key,
      isDone: item.is_done,
      isSkipped: item.is_skipped,
      canSkip: item.can_skip,
    })),
    guideDoneCount: row.guide_done_count,
    guideTotalCount: row.guide_total_count,
    deferredAt: row.deferred_at,
    completedAt: row.completed_at,
    guideHiddenAt: row.guide_hidden_at,
    guideDoneAt: row.guide_done_at,
    completedByMembershipId: row.completed_by_membership_id,
    updatedAt: row.updated_at,
  };
}

/**
 * One change to the setup — merged by the server, never overwriting what another admin saved
 * (OS5). At least one field is required.
 */
export interface OnboardingSetupChange {
  answeredStepsAdd?: OnboardingSetupAnsweredStep[];
  skippedItemsAdd?: OnboardingSetupSkippableItem[];
  skippedItemsRemove?: OnboardingSetupSkippableItem[];
  /** "Explore first" — only ever `true`. */
  deferred?: true;
  /** Hide (`true`) or reopen (`false`) the guide. */
  guideHidden?: boolean;
}

/** A change in the API's words (snake_case, unset fields left out). */
export function onboardingSetupChangeBody(change: OnboardingSetupChange) {
  return {
    ...(change.answeredStepsAdd ? { answered_steps_add: change.answeredStepsAdd } : {}),
    ...(change.skippedItemsAdd ? { skipped_items_add: change.skippedItemsAdd } : {}),
    ...(change.skippedItemsRemove
      ? { skipped_items_remove: change.skippedItemsRemove }
      : {}),
    ...(change.deferred ? { deferred: true as const } : {}),
    ...(change.guideHidden === undefined ? {} : { guide_hidden: change.guideHidden }),
  };
}

/** The guide's first open item, or null when every item is done or skipped. */
export function firstOpenGuideItem(
  setup: OnboardingSetup,
): OnboardingSetupGuideItem | null {
  return setup.guideItems.find((item) => !item.isDone && !item.isSkipped) ?? null;
}

/**
 * A clinic marked live by the one-time fill when this shipped — live with no member who took it
 * live (OS8): it sees no drawer and no ring, the guide only when opened (D7).
 */
export function wasLiveBeforeSetup(setup: OnboardingSetup): boolean {
  return setup.isLive && setup.completedByMembershipId === null;
}

/**
 * Whether setup still asks for attention — the steps while not live, the guide after until it is
 * done, skipped or hidden: the avatar ring, "Finish setup · n of 3" and ⌘K "Finish setup" show
 * while it does (BRIEF.md:82–115, 269–272). Never for a clinic live before setup shipped (D7).
 */
export function isSetupUnfinished(setup: OnboardingSetup): boolean {
  if (setup.guideHiddenAt !== null || wasLiveBeforeSetup(setup)) return false;
  if (!setup.isLive) return true;
  return setup.guideDoneAt === null && firstOpenGuideItem(setup) !== null;
}

/** The drawer's three steps (D26) — the count shown while the clinic is not live. */
export const ONBOARDING_SETUP_STEP_COUNT = 3;

/** Whether each of the three steps is done: the answers, and the main branch read from records. */
export function setupStepsDone(
  setup: OnboardingSetup,
): Record<'clinic_type' | 'location' | 'you', boolean> {
  return {
    clinic_type: setup.answeredSteps.includes('clinic_type'),
    location: setup.liveChecks.main_branch,
    you: setup.answeredSteps.includes('you'),
  };
}

/**
 * "n of 3" — the steps done while not live, the guide's items done or skipped after
 * (BRIEF.md:85–88).
 */
export function setupProgress(setup: OnboardingSetup): { done: number; total: number } {
  if (setup.isLive) return { done: setup.guideDoneCount, total: setup.guideTotalCount };
  const done = Object.values(setupStepsDone(setup)).filter(Boolean).length;
  return { done, total: ONBOARDING_SETUP_STEP_COUNT };
}

/** The 409 reason of going live while a live check fails (RF§2.A.9). */
const ONBOARDING_SETUP_INCOMPLETE = 'onboarding_setup_incomplete';

/** Whether going live was refused because a live check fails. */
export function isOnboardingSetupIncomplete(error: unknown): boolean {
  return (
    isHttpError(error) &&
    error.status === 409 &&
    apiErrorReason(error) === ONBOARDING_SETUP_INCOMPLETE
  );
}
