import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
  type ConsentRecord,
  currentAnalyticsConsent,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

import { purgeAnalyticsOnConsentRevoked } from './capture.ts';

/*
 * The analytics consent is the person's, not the browser's (D161, clinozy-be D85): signed in, the
 * latest answer — the account's or this browser's — wins and is kept on both; a new answer is
 * saved to the account; the end of a session forgets this browser's answer and PostHog's stored
 * identifiers, so the next person at a shared computer is asked afresh.
 */

const accountConsentWire = z.object({
  analytics_consent: z.enum(['granted', 'denied']).nullable().optional(),
  analytics_consent_version: z.number().int().nullable().optional(),
  analytics_consent_at: z.string().nullable().optional(),
});

/** The account's saved answer as a {@link ConsentRecord}; undecided when it has none. */
export async function fetchAccountConsent(): Promise<ConsentRecord> {
  const response = await api.get('/users/me/settings');
  const wire = accountConsentWire.parse(response.data ?? {});
  if (!(
    wire.analytics_consent &&
    wire.analytics_consent_version &&
    wire.analytics_consent_at
  )) {
    return { analyticsConsent: null, decidedAt: null, policyVersion: null };
  }
  return {
    analyticsConsent: wire.analytics_consent,
    decidedAt: wire.analytics_consent_at,
    policyVersion: wire.analytics_consent_version,
  };
}

/** Save an answer to the account (`PATCH /users/me/settings`, with the policy version it answers). */
export async function saveAccountConsent(decision: 'granted' | 'denied'): Promise<void> {
  await api.patch('/users/me/settings', {
    body: {
      analytics_consent: decision,
      analytics_consent_version: CONSENT_POLICY_VERSION,
    },
  });
}

/** True while a change to the store is the account's or another tab's — not this person, here. */
let applyingElsewhereAnswer = false;

function applyElsewhereAnswer(apply: () => void): void {
  applyingElsewhereAnswer = true;
  try {
    apply();
  } finally {
    applyingElsewhereAnswer = false;
  }
}

/**
 * Settle the answer at sign-in: the later of the account's and this browser's standing answers
 * wins — the account's is applied here, this browser's (given before signing in, say) is saved to
 * the account. Neither standing → nothing; the card asks and the answer is saved then.
 *
 * @remarks Never throws: consent must not stand between a person and the app. A failed read or
 * save leaves this browser's answer as it is.
 */
export async function reconcileConsentWithAccount(): Promise<void> {
  let account: ConsentRecord;
  try {
    account = await fetchAccountConsent();
  } catch {
    return;
  }
  const device = useConsentStore.getState();
  const accountDecision = currentAnalyticsConsent(account);
  const deviceDecision = currentAnalyticsConsent(device);
  const accountIsLater =
    accountDecision !== null &&
    (deviceDecision === null ||
      Date.parse(account.decidedAt ?? '') >= Date.parse(device.decidedAt ?? ''));

  if (accountIsLater && account.decidedAt && account.policyVersion) {
    const { decidedAt, policyVersion } = account;
    applyElsewhereAnswer(() =>
      useConsentStore
        .getState()
        .setAnalyticsConsent(accountDecision, { decidedAt, policyVersion }),
    );
    return;
  }
  if (deviceDecision !== null) {
    await saveAccountConsent(deviceDecision).catch(() => undefined);
  }
}

/**
 * Keep the consent with the person: settle it at each sign-in (and for a session already restored
 * when this starts), save each new answer while signed in, forget this browser's answer when the
 * session ends, and follow an answer given in another tab.
 *
 * @returns A stop function (tests).
 */
export function startConsentAccountSync(): () => void {
  let signedIn = useAuthStore.getState().user !== null;
  if (signedIn) void reconcileConsentWithAccount();

  const stopAuth = useAuthStore.subscribe((state) => {
    const nowSignedIn = state.user !== null;
    if (nowSignedIn && !signedIn) void reconcileConsentWithAccount();
    if (!nowSignedIn && signedIn) {
      applyElsewhereAnswer(() => useConsentStore.getState().resetAnalyticsConsent());
      purgeAnalyticsOnConsentRevoked();
    }
    signedIn = nowSignedIn;
  });

  const stopConsent = useConsentStore.subscribe((state, previous) => {
    if (applyingElsewhereAnswer) return;
    // A new answer changes the decision or its time; two stamped in the same millisecond still
    // differ by decision, so the time alone cannot tell them apart.
    const unchanged =
      state.analyticsConsent === previous.analyticsConsent &&
      state.decidedAt === previous.decidedAt;
    if (unchanged) return;
    if (state.analyticsConsent === null || useAuthStore.getState().user === null) return;
    void saveAccountConsent(state.analyticsConsent).catch(() => undefined);
  });

  // Another tab answered (or forgot): take its answer without saving it a second time.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CONSENT_STORAGE_KEY) return;
    applyingElsewhereAnswer = true;
    void Promise.resolve(useConsentStore.persist.rehydrate()).finally(() => {
      applyingElsewhereAnswer = false;
    });
  };
  window.addEventListener('storage', onStorage);

  return () => {
    stopAuth();
    stopConsent();
    window.removeEventListener('storage', onStorage);
  };
}
