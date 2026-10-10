import { useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { iconChipClassName } from '@/lib/icon-surface.ts';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { ShieldCheck, X } from '@/shared/icons/index.ts';
import {
  selectCurrentConsent,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

/**
 * The card's rendered height, published on `<html>` for as long as it is up.
 *
 * Below `sm` the card spans the width, so it can land on top of a page's LAST
 * control — the onboarding wizard's Continue button sits exactly there. Being
 * `fixed`, it cannot be scrolled out of the way, and the page has no reason to
 * scroll any further. `index.css` adds this much room to the end of whatever
 * scrolls, so that control can always be brought clear of the card. Measured
 * rather than guessed: the copy wraps differently in every locale.
 */
const CARD_HEIGHT_VAR = '--consent-card-height';

/**
 * Analytics consent card. Shown while there is no standing answer — none yet, one older than six
 * months, or one to an older policy version (D161); Accept/Decline persist to
 * {@link useConsentStore}, and signed in they are saved to the account. PostHog and Sentry's
 * session recording and profiling start only on a grant — the boot sequence in `main.tsx` and
 * `app/observability/sentry.ts` react to the store. Error reports run under legitimate interest
 * and are not gated here.
 *
 * **Closing is declining.** The close button answers No, so the card stops following the person
 * around; it asks again after six months.
 *
 * **A corner card, not a full-width bar.** The bar spanned the viewport, so its
 * Accept button landed in the bottom-end corner — directly underneath the Sentry
 * feedback trigger, which owns that corner. It also sat on top of the mobile tab
 * bar. The card takes the bottom-START corner instead (`start-*`, so it mirrors
 * under RTL) and rides above the tab bar through `--floating-bottom-offset`,
 * which a shell publishes whenever it renders one (see `index.css`). Below `sm`
 * it widens into an inset sheet so both buttons stay full-size touch targets.
 *
 * Accept and Decline are deliberately the same size: consent has to be as easy
 * to refuse as to give.
 */
export function ConsentBanner() {
  const { t } = useTranslation(LOCALE_NS);
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const decision = useConsentStore(selectCurrentConsent);
  const setConsent = useConsentStore((s) => s.setAnalyticsConsent);
  const visible = decision === null;

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!(visible && card)) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty(
        CARD_HEIGHT_VAR,
        `${Math.ceil(card.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(publish);
    observer?.observe(card);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(CARD_HEIGHT_VAR);
    };
  }, [visible]);

  const handleAccept = () => {
    setConsent('granted');
    import('@/shared/analytics/capture-consent-decision.ts')
      .then((m) => m.captureAnalyticsConsentDecision('granted'))
      .catch(() => undefined);
  };

  const handleDecline = () => {
    setConsent('denied');
    import('@/shared/analytics/capture-consent-decision.ts')
      .then((m) => m.captureAnalyticsConsentDecision('denied'))
      .catch(() => undefined);
  };

  if (!visible) return null;

  return (
    <section
      ref={cardRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="consent-banner"
      // A floating surface: elevation, separation and shape come from the theme.
      // `data-floating` gives it a default lift (it has no scrim) — index.css.
      data-slot="surface"
      data-floating=""
      className={cn(
        'bg-card text-card-foreground fixed z-50 flex flex-col gap-4 rounded-xl border p-4',
        'inset-x-3 bottom-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom,0rem)+0.75rem)]',
        'sm:inset-x-auto sm:start-4 sm:w-[23rem] sm:p-5',
        'sm:bottom-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom,0rem)+1rem)]',
        '2xl:start-6',
        'animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none',
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute end-2 top-2"
        aria-label={t(LOCALE_KEYS.consentCloseAndDecline)}
        onClick={handleDecline}
        data-testid="consent-close"
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
      <div className="flex items-start gap-3 pe-6">
        <span
          data-slot="icon-chip"
          className={cn('bg-primary/10 text-primary size-9', iconChipClassName)}
          aria-hidden="true"
        >
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={titleId} className="text-sm leading-5 font-semibold">
            {t(LOCALE_KEYS.cookieConsent)}
          </h2>
          <p id={descriptionId} className="text-muted-foreground text-sm leading-relaxed">
            {t(LOCALE_KEYS.consentDescription)}
            {platformConfig.privacyPolicyUrl ? (
              <>
                {' '}
                <a
                  href={platformConfig.privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  {t(LOCALE_KEYS.consentPrivacyPolicy)}
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleDecline}
          data-testid="consent-decline"
        >
          {t(LOCALE_KEYS.consentDecline)}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleAccept}
          data-testid="consent-accept"
        >
          {t(LOCALE_KEYS.consentAccept)}
        </Button>
      </div>
    </section>
  );
}
