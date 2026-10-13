import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { onceAsync } from '@/lib/lazy-module.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import {
  selectConsentCardOpen,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

// The card's copy is its own namespace (`consent-banner.constants.ts`), fetched with its chunk so
// the card never draws a key. `I18N_NAMESPACES.consent`, not `CONSENT_NS`: that module's key
// table would ride into the entry chunk with it.
const loadConsentBanner = onceAsync(async () => {
  const [, module] = await Promise.all([
    ensureNamespace(useLocaleStore.getState().locale, I18N_NAMESPACES.consent),
    import('./ConsentBanner.tsx'),
  ]);
  return module;
});

const ConsentBannerCard = lazy(() =>
  loadConsentBanner().then((m) => ({ default: m.ConsentBanner })),
);

/**
 * The cookie card, off the first-paint path.
 *
 * It is mounted on the ROOT route, so a static import put the whole card in the
 * entry chunk of every load — for a surface that a returning visitor (answer
 * already in the cookie) never sees at all, and that a new one does not need until
 * the page they came for is up. The card — and its `consent` namespace — is fetched
 * on demand, when this browser has no standing answer or when Privacy choices reopens
 * it, and slides in a beat after the content, which is how it was designed to arrive
 * anyway.
 *
 * Failure is silent on purpose. No card means no answer, and no answer means
 * analytics stays OFF (`hasAnalyticsConsent()` is false until Analytics is on) —
 * the privacy-safe outcome — while an error card in a fixed corner would have
 * nowhere sensible to sit. The throw is still reported by the boundary.
 */
export function ConsentBannerLazy() {
  const { t } = useTranslation(LOCALE_NS);
  const open = useConsentStore(selectConsentCardOpen);

  if (!open) return null;

  return (
    <SectionErrorBoundary title={t(LOCALE_KEYS.consentTitle)} variant="silent">
      <Suspense fallback={null}>
        <ConsentBannerCard />
      </Suspense>
    </SectionErrorBoundary>
  );
}
