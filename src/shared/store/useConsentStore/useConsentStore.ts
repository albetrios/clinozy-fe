import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

/**
 * Analytics-consent decision. `null` = undecided (the card is shown);
 * `granted`/`denied` are explicit choices — closing the card is `denied`.
 */
export type ConsentDecision = 'granted' | 'denied' | null;

/**
 * The consent policy the card asks about. Bump it when what is collected, or by whom, changes:
 * every saved answer to an older version is asked again (D161).
 */
export const CONSENT_POLICY_VERSION = 1;

/** An answer older than this is asked again (six months, D161). */
export const CONSENT_MAX_AGE_DAYS = 182;

const DAY_MS = 86_400_000;

/** The localStorage key the decision is kept under (one per browser profile). */
export const CONSENT_STORAGE_KEY = `${PRODUCT_NAMESPACE}-consent`;

/** One saved answer: the decision, when it was given and to which policy version. */
export interface ConsentRecord {
  analyticsConsent: ConsentDecision;
  /** When the answer was given (ISO 8601); `null` while undecided. */
  decidedAt: string | null;
  /** {@link CONSENT_POLICY_VERSION} at the time; `null` while undecided. */
  policyVersion: number | null;
}

interface ConsentStore extends ConsentRecord {
  /**
   * Record a decision — the card, Settings › Privacy, or the account's saved answer at sign-in
   * (which brings its own time and version).
   */
  setAnalyticsConsent: (
    decision: Exclude<ConsentDecision, null>,
    saved?: { decidedAt: string; policyVersion: number },
  ) => void;
  /** Forget this browser's answer — a session ended, so the next person is asked afresh. */
  resetAnalyticsConsent: () => void;
}

const UNDECIDED: ConsentRecord = {
  analyticsConsent: null,
  decidedAt: null,
  policyVersion: null,
};

/**
 * The decision while it still stands, else `null`: an answer to an older policy version, or one
 * older than {@link CONSENT_MAX_AGE_DAYS}, counts as not answered.
 */
export function currentAnalyticsConsent(
  record: ConsentRecord,
  now: number = Date.now(),
): ConsentDecision {
  if (record.analyticsConsent === null || record.decidedAt === null) return null;
  if (record.policyVersion !== CONSENT_POLICY_VERSION) return null;
  const decidedAt = Date.parse(record.decidedAt);
  if (Number.isNaN(decidedAt) || now - decidedAt > CONSENT_MAX_AGE_DAYS * DAY_MS)
    return null;
  return record.analyticsConsent;
}

/**
 * Persisted analytics-consent state (GDPR / ePrivacy, DPDP). Cookie-setting analytics (PostHog)
 * and Sentry's session recording and profiling start only while the decision is `granted`; see
 * `app/analytics/posthog.ts`, `app/observability/sentry.ts` and the boot sequence in `main.tsx`.
 * Error reports run under legitimate interest and are not gated here.
 *
 * @remarks
 * - **The person's, not the browser's (D161).** Signed in, the account's saved answer wins and a
 *   new answer is saved to the account (`shared/analytics/consent-account-sync.ts`); a session's
 *   end forgets this browser's answer.
 * - **Version 1 of the stored shape** added the time and the policy version. An answer stored
 *   before has neither, so it counts as not answered and the card asks once more.
 */
export const useConsentStore = create<ConsentStore>()(
  persist(
    (set) => ({
      ...UNDECIDED,
      setAnalyticsConsent: (analyticsConsent, saved) =>
        set({
          analyticsConsent,
          decidedAt: saved?.decidedAt ?? new Date().toISOString(),
          policyVersion: saved?.policyVersion ?? CONSENT_POLICY_VERSION,
        }),
      resetAnalyticsConsent: () => set(UNDECIDED),
    }),
    {
      name: CONSENT_STORAGE_KEY,
      version: 1,
      migrate: (persisted) => {
        const stored = (persisted ?? {}) as Partial<ConsentRecord>;
        return {
          analyticsConsent: stored.analyticsConsent ?? null,
          decidedAt: stored.decidedAt ?? null,
          policyVersion: stored.policyVersion ?? null,
        } as ConsentStore;
      },
    },
  ),
);

/** The standing decision for components (`useConsentStore(selectCurrentConsent)`). */
export function selectCurrentConsent(state: ConsentRecord): ConsentDecision {
  return currentAnalyticsConsent(state);
}

/** Imperative read for non-React callers (the boot sequence, analytics, Sentry). */
export function hasAnalyticsConsent(): boolean {
  return currentAnalyticsConsent(useConsentStore.getState()) === 'granted';
}
