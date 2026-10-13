import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { i18n } from '@/lib/i18n/index.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  isGlobalPrivacyControlOn,
  REJECT_ALL_CONSENT_PREFERENCES,
  selectConsentCardOpen,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

import { CONSENT_KEYS, CONSENT_NS } from './consent-banner.constants.ts';
import { ConsentCategoryRow } from './ConsentCategoryRow/index.ts';
import { saveConsentPreferences } from './save-consent-preferences.ts';

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

/** Wraps on a narrow card in long languages instead of overflowing it. */
const BUTTON_CLASS = 'h-auto min-h-9 min-w-0 px-2 whitespace-normal sm:px-3.5';

type ConsentCardView = 'summary' | 'customize';

/**
 * The cookie card, on claude.com's cookie banner (D1–D15): "Cookie settings", one paragraph and
 * the Privacy Policy link, then **Customize cookie settings · Reject all cookies · Accept all
 * cookies** ("Customize · Reject · Accept" in one row on a phone). Customize swaps the same card
 * to the categories — Necessary (Required) and Analytics (On/Off) — and **Save preferences**.
 *
 * - **Non-modal** (`<dialog open>`, as claude.com's `dialog.show()`): the page stays usable, and
 *   opening takes no focus. Customize moves focus to the Analytics switch, since the pressed
 *   button goes away (D14).
 * - **Escape inside the card rejects all** (D7) — never document-wide: Escape also closes the
 *   app's drawers, dialogs and menus. There is no close button.
 * - **Reject is as easy as Accept**: on the first view, the same size.
 * - **Global Privacy Control** (D6): the card never opens on its own; opened from Privacy
 *   choices it says why Analytics is off, and Accept all and the Analytics switch are locked.
 * - **The bottom-START corner** (D8): the feedback trigger owns bottom-end. At most 456px wide
 *   (claude.com's), 24px in; below `sm` a full-width inset sheet that rides above the tab bar
 *   through `--floating-bottom-offset` (see `index.css`). Logical `start-*`, so it mirrors under RTL.
 * - **Tighter than claude.com** (D23): 24px of padding from `sm` (claude.com: 32px) and 24px above
 *   Save preferences (32px), as asked; phones keep claude.com's 16px.
 *
 * The answer is saved by `saveConsentPreferences` (this browser's cookie and {@link useConsentStore});
 * PostHog and Sentry's recording react to the store. `ConsentBannerLazy` decides when it is mounted.
 */
export function ConsentBanner() {
  const { t } = useTranslation(CONSENT_NS);
  const { t: tCommon } = useTranslation(LOCALE_NS);
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLDialogElement>(null);
  const analyticsSwitchRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const open = useConsentStore(selectConsentCardOpen);
  const preferences = useConsentStore((s) => s.preferences);
  const globalPrivacyControl = isGlobalPrivacyControlOn();
  const [view, setView] = useState<ConsentCardView>('summary');
  const [analytics, setAnalytics] = useState(
    !globalPrivacyControl && preferences?.analytics === true,
  );

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!(open && card)) return;
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
  }, [open]);

  useEffect(() => {
    if (view !== 'customize') return;
    (globalPrivacyControl ? saveRef.current : analyticsSwitchRef.current)?.focus();
  }, [view, globalPrivacyControl]);

  const acceptAll = () =>
    saveConsentPreferences(ACCEPT_ALL_CONSENT_PREFERENCES, 'consent_banner');
  const rejectAll = () =>
    saveConsentPreferences(REJECT_ALL_CONSENT_PREFERENCES, 'consent_banner');
  const saveCustomized = () =>
    saveConsentPreferences(
      { analytics: !globalPrivacyControl && analytics },
      'consent_banner',
    );

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    rejectAll();
  };

  if (!open) return null;

  return (
    <dialog // NOSONAR(S6847): the dialog's own Escape key (WAI-ARIA dialog), bubbling from its focused control; a document listener would also fire for Escape elsewhere
      ref={cardRef}
      open
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={onKeyDown}
      data-testid="consent-banner"
      data-view={view}
      // A floating surface: elevation, separation and shape come from the theme.
      // `data-floating` gives it a default lift (it has no scrim) — index.css.
      data-slot="surface"
      data-floating=""
      className={cn(
        'bg-card text-card-foreground fixed z-50 m-0 flex h-auto max-h-[calc(100dvh-1.5rem)] w-auto flex-col overflow-y-auto rounded-3xl border p-4 sm:p-6',
        'inset-x-3 bottom-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom,0rem)+0.75rem)]',
        'sm:inset-x-auto sm:start-6 sm:w-[28.5rem]',
        'sm:bottom-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom,0rem)+1.5rem)]',
        'animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none',
      )}
    >
      <h2 id={titleId} className="text-lg leading-6 font-semibold">
        {tCommon(LOCALE_KEYS.consentTitle)}
      </h2>
      <p
        id={descriptionId}
        className="text-muted-foreground mt-4 text-sm leading-relaxed"
      >
        {view === 'summary'
          ? t(CONSENT_KEYS.description)
          : t(CONSENT_KEYS.customizeDescription)}
        {view === 'summary' && platformConfig.privacyPolicyUrl ? (
          <>
            {' '}
            {/*
              The app's own instance, handed over rather than found through context: it keeps
              this lazy chunk reaching `@/lib/i18n` beside the `i18next` core `Trans` imports,
              so the bundler leaves that core inside the first-paint i18n chunk instead of
              splitting it into a chunk of its own (+0.2 kB gzipped on every first paint,
              `pnpm size`).
            */}
            <Trans
              i18n={i18n}
              ns={CONSENT_NS}
              i18nKey={CONSENT_KEYS.policy}
              components={{
                // Trans replaces the link's text with the translation's <1>…</1>;
                // the address stands in only if a translation drops the tag.
                1: (
                  <a
                    href={platformConfig.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground font-medium underline underline-offset-4"
                    data-testid="consent-policy-link"
                  >
                    {platformConfig.privacyPolicyUrl}
                  </a>
                ),
              }}
            />
          </>
        ) : null}
      </p>
      {globalPrivacyControl ? (
        <p
          className="text-muted-foreground mt-2 text-xs leading-[1.45]"
          data-testid="consent-gpc-note"
        >
          {t(CONSENT_KEYS.gpcNote)}
        </p>
      ) : null}

      {view === 'summary' ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className={cn(BUTTON_CLASS, 'sm:col-span-2')}
            onClick={() => setView('customize')}
            data-testid="consent-customize"
          >
            <span className="sm:hidden">{t(CONSENT_KEYS.customizeShort)}</span>
            <span className="max-sm:hidden">{t(CONSENT_KEYS.customize)}</span>
          </Button>
          <Button
            variant="outline"
            className={BUTTON_CLASS}
            onClick={rejectAll}
            data-testid="consent-reject"
          >
            <span className="sm:hidden">{t(CONSENT_KEYS.rejectShort)}</span>
            <span className="max-sm:hidden">{t(CONSENT_KEYS.rejectAll)}</span>
          </Button>
          <Button
            className={BUTTON_CLASS}
            onClick={acceptAll}
            disabled={globalPrivacyControl}
            data-testid="consent-accept"
          >
            <span className="sm:hidden">{t(CONSENT_KEYS.acceptShort)}</span>
            <span className="max-sm:hidden">{t(CONSENT_KEYS.acceptAll)}</span>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2">
            <ConsentCategoryRow
              testId="consent-option-necessary"
              title={t(CONSENT_KEYS.necessaryTitle)}
              description={t(CONSENT_KEYS.necessaryDescription)}
              status={t(CONSENT_KEYS.required)}
              checked
              disabled
            />
            <ConsentCategoryRow
              testId="consent-option-analytics"
              title={t(CONSENT_KEYS.analyticsTitle)}
              description={t(CONSENT_KEYS.analyticsDescription)}
              status={t(analytics ? CONSENT_KEYS.on : CONSENT_KEYS.off)}
              checked={analytics}
              disabled={globalPrivacyControl}
              onCheckedChange={setAnalytics}
              switchRef={analyticsSwitchRef}
            />
          </div>
          <Button
            ref={saveRef}
            className="mt-6 w-full"
            onClick={saveCustomized}
            data-testid="consent-save"
          >
            {t(CONSENT_KEYS.save)}
          </Button>
        </>
      )}
    </dialog>
  );
}
