import {
  type OnboardingSetup,
  setupStepsDone,
} from '@/shared/api/app/onboarding-setup-contracts.ts';

import type { SetupHashStep } from './setup-hash-grammar.ts';

/** The drawer's three steps, in order — their hash names (KICKOFF §4). */
export const SETUP_DRAWER_STEPS = ['clinic-type', 'location', 'you'] as const;

/** One of {@link SETUP_DRAWER_STEPS}. */
export type SetupDrawerStep = (typeof SETUP_DRAWER_STEPS)[number];

/** A step's done flag as {@link setupStepsDone} names it. */
const DONE_KEY = {
  'clinic-type': 'clinic_type',
  location: 'location',
  you: 'you',
} as const satisfies Record<SetupDrawerStep, string>;

/** Whether each drawer step is done — answered, or read from the records (step 2). */
export function drawerStepsDone(
  setup: OnboardingSetup,
): Record<SetupDrawerStep, boolean> {
  const done = setupStepsDone(setup);
  return {
    'clinic-type': done[DONE_KEY['clinic-type']],
    location: done[DONE_KEY.location],
    you: done[DONE_KEY.you],
  };
}

/** The first step not done yet; the last when every step is done (it holds "Go live"). */
export function firstOpenStep(setup: OnboardingSetup): SetupDrawerStep {
  const done = drawerStepsDone(setup);
  return SETUP_DRAWER_STEPS.find((step) => !done[step]) ?? 'you';
}

/** Whether a step may open: done already, or the first one not done (D14 — in order). */
export function isStepUnlocked(setup: OnboardingSetup, step: SetupDrawerStep): boolean {
  const order = SETUP_DRAWER_STEPS.indexOf(step);
  return order <= SETUP_DRAWER_STEPS.indexOf(firstOpenStep(setup));
}

/**
 * Where the drawer belongs for the place the hash names (KICKOFF §4): while not live, a step that
 * may open, else the first open one; once live, "You're live" when asked for — or still on the last
 * step, the moment "Go live" lands — step 2 while the clinic has no open main branch, else the
 * guide. A place it does not belong is canonicalized
 * with a `replace`, never a new history entry.
 */
export function canonicalSetupPlace(
  setup: OnboardingSetup,
  place: SetupHashStep | null,
): SetupHashStep {
  if (setup.isLive) {
    // A live clinic whose branches were all closed is sent back to "Where is your clinic?" by
    // the create-action guard (KICKOFF §6.3).
    if (place === 'location' && !setup.liveChecks.main_branch) return 'location';
    return place === 'live' || place === 'you' ? 'live' : 'guide';
  }
  if (place === 'clinic-type' || place === 'location' || place === 'you') {
    return isStepUnlocked(setup, place) ? place : firstOpenStep(setup);
  }
  return firstOpenStep(setup);
}
