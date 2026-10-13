import { api } from '@/core/http/api.ts';

import {
  type OnboardingSetup,
  type OnboardingSetupChange,
  onboardingSetupChangeBody,
  onboardingSetupWire,
  toOnboardingSetup,
} from './onboarding-setup-contracts.ts';

/*
 * The clinic setup on clinozy-be (routes-final §2.A, RC-1…RC-3): read it, merge one change, go
 * live. Managers only (`organization:update`), team clinics only — the shell asks for it only then.
 */

/** TanStack Query keys for the clinic setup, each carrying the organization (KICKOFF §5). */
export const onboardingSetupQueryKeys = {
  all: ['app', 'onboarding-setup'] as const,
  detail: (organizationId: string | null) =>
    [...onboardingSetupQueryKeys.all, organizationId] as const,
};

/** The clinic's setup — `GET /app/onboarding-setup` (RC-1). */
export async function fetchOnboardingSetup(): Promise<OnboardingSetup> {
  const response = await api.get('/app/onboarding-setup');
  return toOnboardingSetup(onboardingSetupWire.parse(response.data));
}

/**
 * Answers a step, skips or un-skips a guide item, defers, hides or reopens the guide —
 * `PATCH /app/onboarding-setup` (RC-2); answers with the new setup.
 */
export async function changeOnboardingSetup({
  change,
  idempotencyKey,
}: {
  change: OnboardingSetupChange;
  idempotencyKey: string;
}): Promise<OnboardingSetup> {
  const response = await api.patch('/app/onboarding-setup', {
    body: onboardingSetupChangeBody(change),
    idempotencyKey,
  });
  return toOnboardingSetup(onboardingSetupWire.parse(response.data));
}

/**
 * Takes the clinic live — `POST /app/onboarding-setup/complete` (RC-3). A clinic already live
 * answers as it stands; `409 onboarding_setup_incomplete` while a live check fails.
 */
export async function completeOnboardingSetup({
  idempotencyKey,
}: {
  idempotencyKey: string;
}): Promise<OnboardingSetup> {
  const response = await api.post('/app/onboarding-setup/complete', { idempotencyKey });
  return toOnboardingSetup(onboardingSetupWire.parse(response.data));
}
