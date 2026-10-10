export {
  CONSENT_MAX_AGE_DAYS,
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
  type ConsentDecision,
  type ConsentRecord,
  currentAnalyticsConsent,
  hasAnalyticsConsent,
  selectCurrentConsent,
  useConsentStore,
} from './useConsentStore.ts';
