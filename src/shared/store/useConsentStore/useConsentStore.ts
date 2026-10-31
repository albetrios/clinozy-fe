import { create } from 'zustand';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

/**
 * The answer per optional cookie category. Necessary cookies are not a choice, so they have no
 * entry; a category added later is one more key here.
 */
export interface ConsentPreferences {
  /** Product analytics (PostHog, web-vitals) and Sentry's session recording and profiling. */
  analytics: boolean;
}

/** "Accept all cookies" (claude.com's name for the same constant). */
export const ACCEPT_ALL_CONSENT_PREFERENCES: Readonly<ConsentPreferences> = Object.freeze(
  {
    analytics: true,
  },
);

/** "Reject all cookies" — also what Escape on the card and Global Privacy Control mean. */
export const REJECT_ALL_CONSENT_PREFERENCES: Readonly<ConsentPreferences> = Object.freeze(
  {
    analytics: false,
  },
);

/**
 * The consent notice the card shows. Bump it when what is collected, or by whom, changes: an
 * answer to another version is asked again. Version 2 is the claude.com-style card.
 */
export const CONSENT_POLICY_VERSION = 2;

/** The first-party cookie that holds this browser's answer (claude.com: `anthropic-consent-preferences`). */
export const CONSENT_COOKIE_NAME = `${PRODUCT_NAMESPACE}-consent-preferences`;

/** One year, as claude.com — the cookie's expiry is when the card asks again. */
export const CONSENT_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/** Where the launch kept the answer (localStorage, per account); removed by {@link startConsentFollow}. */
const LEGACY_CONSENT_STORAGE_KEY = `${PRODUCT_NAMESPACE}-consent`;

/** The cookie's value, as JSON. */
interface StoredConsent {
  analytics: boolean;
  version: number;
  decidedAt: string;
  /** Who answered: the signed-in user's id, `null` signed out (absent on a launch-era cookie). */
  decidedBy?: string | null;
}

/** This browser's standing answer, or `null` while there is none. */
interface StandingAnswer {
  preferences: ConsentPreferences;
  decidedAt: string;
  decidedBy: string | null;
}

function isStoredConsent(value: unknown): value is StoredConsent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.analytics === 'boolean' &&
    typeof candidate.version === 'number' &&
    typeof candidate.decidedAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.decidedAt)) &&
    (candidate.decidedBy === undefined ||
      candidate.decidedBy === null ||
      typeof candidate.decidedBy === 'string')
  );
}

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

/**
 * The cookie's answer while it stands: present, readable and given to the current
 * {@link CONSENT_POLICY_VERSION}. Its age needs no check — the cookie expires after a year.
 */
function readStandingAnswer(): StandingAnswer | null {
  const raw = readCookieValue(CONSENT_COOKIE_NAME);
  if (raw === null) return null;
  try {
    const stored: unknown = JSON.parse(decodeURIComponent(raw));
    if (!isStoredConsent(stored) || stored.version !== CONSENT_POLICY_VERSION)
      return null;
    return {
      preferences: { analytics: stored.analytics },
      decidedAt: stored.decidedAt,
      decidedBy: stored.decidedBy ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * True while the browser sends Global Privacy Control: every optional category is off, the card
 * never asks on its own, and Analytics cannot be switched on (D6).
 */
export function isGlobalPrivacyControlOn(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ===
    true
  );
}

interface ConsentState {
  /** This browser's answer; `null` while there is none (nothing optional runs). */
  preferences: ConsentPreferences | null;
  /** When the answer was given (ISO 8601); `null` with `preferences`. */
  decidedAt: string | null;
  /** Who gave it: the user signed in then, `null` signed out (or with `preferences`). */
  decidedBy: string | null;
  /**
   * Who is signed in now (`useAuthStore`'s user id), `null` signed out — kept in step by this
   * module, so the selectors below stay pure on this store and re-run when someone signs in.
   */
  viewerId: string | null;
  /** The card was reopened from Privacy choices, whatever the answer. */
  preferencesOpen: boolean;
  /** Reopen the card (Privacy choices). */
  openPreferences: () => void;
  /** Take the cookie's answer again — another tab may have changed it. */
  reloadFromCookie: () => void;
}

function stateFromCookie(): Pick<
  ConsentState,
  'preferences' | 'decidedAt' | 'decidedBy'
> {
  const answer = readStandingAnswer();
  return {
    preferences: answer?.preferences ?? null,
    decidedAt: answer?.decidedAt ?? null,
    decidedBy: answer?.decidedBy ?? null,
  };
}

/** The signed-in user's id, or `null`. */
const currentViewerId = (): string | null => useAuthStore.getState().user?.id ?? null;

/**
 * This browser's cookie-consent answer (D1, claude.com's model). PostHog (and its web-vitals) and
 * Sentry's session recording and profiling start only while Analytics is allowed — see `main.tsx`,
 * `app/analytics/posthog.ts` and `app/observability/sentry.ts`. Error reports run under legitimate
 * interest and are not gated here.
 *
 * @remarks
 * - **The person's who gave it.** One first-party cookie ({@link CONSENT_COOKIE_NAME}, one
 *   year, `SameSite=Lax`, `Secure` on https) holds it, with `decidedBy` — the user signed in when it
 *   was given (F-4). A clinic PC is shared: an answer stands for that person alone, so when someone
 *   else signs in (or the answer was given signed out) the card asks again and nothing optional
 *   runs until they answer. Signed out, the browser's last answer stands. An answer given while
 *   signed in is also sent to the account as a receipt
 *   (`shared/analytics/record-consent-decision.ts`), never read back.
 * - **Read here, written by the card.** This store only reads the cookie: it is on every first
 *   paint, and only the card and Settings answer — through
 *   `shared/components/ConsentBanner/save-consent-preferences.ts`, which writes the cookie and
 *   sets this store.
 * - **Asked again** when the cookie expires, is unreadable, answers another
 *   {@link CONSENT_POLICY_VERSION}, or was given by someone other than the signed-in user.
 * - **Global Privacy Control** overrides the answer: {@link hasAnalyticsConsent} is false while
 *   the browser sends it.
 */
export const useConsentStore = create<ConsentState>()((set) => ({
  ...stateFromCookie(),
  viewerId: currentViewerId(),
  preferencesOpen: false,
  openPreferences: () => set({ preferencesOpen: true }),
  reloadFromCookie: () => set(stateFromCookie()),
}));

// Who is signed in decides whose answer stands (F-4): follow every sign-in and sign-out.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id === previous.user?.id) return;
  useConsentStore.setState({ viewerId: state.user?.id ?? null });
});

/** The parts of the state that decide whether an answer stands. */
type AnswerState = Pick<ConsentState, 'preferences' | 'decidedBy' | 'viewerId'>;

/**
 * The answer stands for whoever is here: there is one, and either nobody is signed in or the
 * signed-in user is who gave it.
 */
function answerStands(state: AnswerState): boolean {
  if (state.preferences === null) return false;
  return state.viewerId === null || state.viewerId === state.decidedBy;
}

/** Analytics may run: a standing answer that allows it, and no Global Privacy Control. */
export function selectAnalyticsAllowed(state: AnswerState): boolean {
  return (
    !isGlobalPrivacyControlOn() &&
    answerStands(state) &&
    state.preferences?.analytics === true
  );
}

/**
 * The card asks on its own: no answer that stands for whoever is here, and no Global Privacy
 * Control answering for it.
 */
export function selectShouldAsk(state: AnswerState): boolean {
  return !answerStands(state) && !isGlobalPrivacyControlOn();
}

/** The card is up: asking on its own, or reopened from Privacy choices. */
export function selectConsentCardOpen(
  state: AnswerState & Pick<ConsentState, 'preferencesOpen'>,
): boolean {
  return state.preferencesOpen || selectShouldAsk(state);
}

/** Imperative read for non-React callers (the boot sequence, analytics, Sentry). */
export function hasAnalyticsConsent(): boolean {
  return selectAnalyticsAllowed(useConsentStore.getState());
}

/**
 * Start following the answer outside this tab, once, from `main.tsx`: drop the launch's
 * localStorage answer (asked again under policy version 2), and re-read the cookie whenever the tab
 * is shown again — another tab may have answered meanwhile (cookies fire no storage event).
 *
 * @returns A stop function (tests).
 */
export function startConsentFollow(): () => void {
  try {
    localStorage.removeItem(LEGACY_CONSENT_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): nothing was kept there either.
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible')
      useConsentStore.getState().reloadFromCookie();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => document.removeEventListener('visibilitychange', onVisibilityChange);
}
