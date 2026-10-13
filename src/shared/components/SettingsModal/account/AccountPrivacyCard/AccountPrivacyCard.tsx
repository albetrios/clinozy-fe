import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { ConsentCategoryRow } from '@/shared/components/ConsentBanner/ConsentCategoryRow/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  isGlobalPrivacyControlOn,
  selectAnalyticsAllowed,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

/**
 * Settings › Account › Privacy: this browser's cookie settings, as the consent card's Customize
 * view draws them — Necessary (Required) and Analytics (a switch that saves at once), when the
 * answer was saved, and the policy. The signed-in counterpart of the signed-out frame's "Privacy
 * choices" (D12). Off stops PostHog and Sentry's session recording at once; error reports run
 * either way. Under Global Privacy Control the switch is locked off and says why (D6).
 */
export function AccountPrivacyCard() {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tCommon } = useTranslation(LOCALE_NS);
  const keys = SETTINGS_KEYS.panels.account;
  const { formatDate } = useLocaleFormat();
  const analytics = useConsentStore(selectAnalyticsAllowed);
  const answered = useConsentStore((s) => s.preferences !== null);
  const decidedAt = useConsentStore((s) => s.decidedAt);
  const savePreferences = useConsentStore((s) => s.savePreferences);
  const globalPrivacyControl = isGlobalPrivacyControlOn();

  const onCheckedChange = (checked: boolean) => {
    const preferences = { analytics: checked };
    savePreferences(preferences);
    import('@/shared/analytics/record-consent-decision.ts')
      .then((m) => m.recordConsentDecision(preferences, 'settings'))
      .catch(() => undefined);
  };

  const status =
    answered && decidedAt
      ? t(keys.consentSavedOn, { date: formatDate(decidedAt) })
      : t(keys.consentUnanswered);

  return (
    <SettingsCard
      title={t(keys.privacyTitle)}
      description={t(keys.privacyDescription)}
      data-testid="account-privacy"
    >
      <div className="flex flex-col gap-2">
        <ConsentCategoryRow
          testId="account-privacy-necessary"
          title={tCommon(LOCALE_KEYS.consentNecessaryTitle)}
          description={tCommon(LOCALE_KEYS.consentNecessaryDescription)}
          status={tCommon(LOCALE_KEYS.consentRequired)}
          checked
          disabled
        />
        <ConsentCategoryRow
          testId="account-privacy-analytics"
          title={tCommon(LOCALE_KEYS.consentAnalyticsTitle)}
          description={tCommon(LOCALE_KEYS.consentAnalyticsDescription)}
          status={tCommon(analytics ? LOCALE_KEYS.consentOn : LOCALE_KEYS.consentOff)}
          checked={analytics}
          disabled={globalPrivacyControl}
          onCheckedChange={onCheckedChange}
          footer={
            <span
              className="text-muted-foreground block text-xs leading-[1.45]"
              data-testid="account-privacy-status"
            >
              {status}
            </span>
          }
        />
      </div>
      {globalPrivacyControl ? (
        <p
          className="text-muted-foreground text-xs leading-[1.45]"
          data-testid="consent-gpc-note"
        >
          {tCommon(LOCALE_KEYS.consentGpcNote)}
        </p>
      ) : null}
      {platformConfig.privacyPolicyUrl ? (
        <a
          href={platformConfig.privacyPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground text-body font-medium underline underline-offset-4"
          data-testid="account-privacy-policy"
        >
          {t(keys.privacyPolicyLink)}
        </a>
      ) : null}
    </SettingsCard>
  );
}
