import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Switch } from '@/shared/components/ui/switch.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  selectCurrentConsent,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

/**
 * Settings › Account › Privacy: the person's analytics consent — on or off, when it was given,
 * and the policy (D161). Withdrawing is as easy as giving: one switch, saved to the account like
 * the card's answer (`shared/analytics/consent-account-sync.ts`). Off stops PostHog and Sentry's
 * session recording at once; error reports run either way.
 */
export function AccountPrivacyCard() {
  const { t } = useTranslation(SETTINGS_NS);
  const keys = SETTINGS_KEYS.panels.account;
  const { formatDate } = useLocaleFormat();
  const switchId = useId();
  const hintId = useId();
  const decision = useConsentStore(selectCurrentConsent);
  const decidedAt = useConsentStore((s) => s.decidedAt);
  const setConsent = useConsentStore((s) => s.setAnalyticsConsent);

  const onCheckedChange = (checked: boolean) => {
    const next = checked ? 'granted' : 'denied';
    setConsent(next);
    import('@/shared/analytics/capture-consent-decision.ts')
      .then((m) => m.captureAnalyticsConsentDecision(next, 'settings'))
      .catch(() => undefined);
  };

  let status = t(keys.consentUnanswered);
  if (decision !== null && decidedAt) {
    status = t(decision === 'granted' ? keys.consentGrantedOn : keys.consentDeniedOn, {
      date: formatDate(decidedAt),
    });
  }

  return (
    <SettingsCard
      title={t(keys.privacyTitle)}
      description={t(keys.privacyDescription)}
      data-testid="account-privacy"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <label htmlFor={switchId} className="text-body font-medium">
            {t(keys.analyticsLabel)}
          </label>
          <p id={hintId} className="text-muted-foreground text-xs leading-[1.45]">
            {t(keys.analyticsHint)}
          </p>
          <p
            className="text-muted-foreground text-xs leading-[1.45]"
            data-testid="account-privacy-status"
          >
            {status}
          </p>
        </div>
        <Switch
          id={switchId}
          checked={decision === 'granted'}
          onCheckedChange={onCheckedChange}
          aria-describedby={hintId}
          data-testid="account-privacy-analytics"
        />
      </div>
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
