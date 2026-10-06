import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { holdAppSplash } from '@/lib/app-splash.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';

/**
 * Suspense fallback while a layout variant chunk loads.
 *
 * Shell-shaped and full-bleed on purpose. The old `min-h-24` strip occupied a
 * sliver of an otherwise blank page, so a shell swap read as "the app broke"
 * rather than "the app is loading" (SHELL-1). `AppLayout` now preloads the
 * target chunk before committing a swap, so this should only ever be seen on a
 * genuine first mount — and when it is, it holds the frame's shape: the
 * launch's — the section bar's header (52px on a phone, 60px from `md`, its
 * hairline; no sidebar in the design) over the page, its content replaced in
 * place by the design's flat bars (`_patterns.md:282`).
 */
export function LayoutVariantFallback() {
  const { t } = useTranslation(LOCALE_NS);

  // Hold the HTML boot splash for as long as this is up, exactly as
  // FullPageSpinner does. On a cold load the splash used to ease out the moment
  // the route rendered — which is when THIS mounts, not when the layout arrives —
  // so the splash faded into an app-shell skeleton (nav rail, top bar) that the
  // login page never has, and sat there for seconds before the auth screen
  // replaced it. Measured on /login: fallback visible at 10.7s, splash gone by
  // 11.3s, auth form not until 16.0s. Holding keeps it one continuous screen.
  // A no-op once the splash is gone, so a runtime variant swap is unaffected.
  useLayoutEffect(() => holdAppSplash(), []);

  return (
    <output
      data-testid="layout-variant-fallback"
      className="bg-background flex min-h-0 flex-1 flex-col"
      aria-busy="true"
    >
      <span className="sr-only">{t(LOCALE_KEYS.loading)}</span>
      <div
        data-slot="app-header"
        className="bg-card min-h-13 shrink-0 border-b md:min-h-15"
        aria-hidden="true"
      />
      <div
        className="text-body flex flex-1 flex-col gap-3 p-(--room-toolbar-pad)"
        aria-hidden="true"
      >
        <SkeletonBar shape="field" className="w-40" />
        <div className="flex flex-col gap-4 rounded-xl border px-(--table-pad-x) py-4">
          <SkeletonBar index={0} />
          <SkeletonBar index={1} />
          <SkeletonBar index={2} />
        </div>
      </div>
    </output>
  );
}
