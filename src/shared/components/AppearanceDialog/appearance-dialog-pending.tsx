import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { isMultiLocaleBuild } from '@/lib/i18n/build-runtime.ts';
import { LOCALE_KEYS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';

import { APPEARANCE_KEYS, APPEARANCE_NS } from './appearance.constants.ts';
import {
  APPEARANCE_DIALOG_KEYS,
  APPEARANCE_DIALOG_NS,
  APPEARANCE_PENDING_WIDTH_CLASS,
  APPEARANCE_TEST_IDS,
} from './appearance-dialog.constants.ts';

/**
 * The Appearance drawer while its chunk loads (SHELL-4: no dead click) — the
 * drawer's own frame, drawn without the drawer: the 45% backdrop, the panel at
 * the inline end at the drawer's width (full screen below `md`), its header
 * with the title and sub line, and the cards as the design's flat bars on the
 * canvas. Plain markup on purpose: this is on the entry chunk, and the record
 * drawer — or even the skeleton module — would ride it onto every first paint.
 * A press on the backdrop closes it, as on the drawer; Esc and the × are the
 * lazy overlay's.
 */
export function AppearanceDialogPending({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(APPEARANCE_DIALOG_NS);
  // The card titles: the panel's own (`common`, where the locale cards' live too).
  const { t: tCommon } = useTranslation(APPEARANCE_NS);
  const titleId = useId();
  const sections = [
    platformConfig.themeLock ? APPEARANCE_KEYS.themeTitle : APPEARANCE_KEYS.modeTitle,
    isMultiLocaleBuild() ? LOCALE_KEYS.languageHeading : LOCALE_KEYS.textDirectionHeading,
    LOCALE_KEYS.dateTimeHeading,
    LOCALE_KEYS.numberStyleHeading,
  ];

  return (
    <>
      <div
        aria-hidden="true"
        data-slot="sheet-overlay"
        onClick={onClose}
        className="bg-overlay/45 animate-backdrop-in fixed inset-0 z-50"
      />
      {/* A named region, busy: the drawer, still loading. */}
      <section
        aria-labelledby={titleId}
        aria-busy="true"
        data-slot="sheet-content"
        data-testid={APPEARANCE_TEST_IDS.pending}
        className={cn(
          'bg-background text-foreground animate-drawer-in fixed inset-y-0 end-0 z-50 flex w-full flex-col',
          APPEARANCE_PENDING_WIDTH_CLASS,
        )}
      >
        <output className="sr-only">{tCommon(LOCALE_KEYS.loading)}</output>
        <div className="flex h-(--drawer-header-height) shrink-0 flex-col justify-center gap-0.5 border-b p-(--drawer-header-pad) max-md:h-auto max-md:min-h-(--drawer-header-height) max-md:pe-14">
          <h2 id={titleId} className="truncate text-lg font-semibold tracking-[-0.01em]">
            {t(APPEARANCE_DIALOG_KEYS.title)}
          </h2>
          <p className="text-muted-foreground text-body truncate">
            {t(APPEARANCE_DIALOG_KEYS.description)}
          </p>
        </div>
        <div className="bg-canvas flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-(--drawer-body-pad)">
          {sections.map((section) => (
            <div
              key={section}
              data-slot="card"
              className="bg-card flex flex-col gap-3 rounded-xl border p-(--step-pad)"
            >
              <h3 className="text-field leading-[1.3] font-semibold">
                {tCommon(section)}
              </h3>
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="bg-muted-strong h-7 w-16 rounded-lg" />
                <span className="bg-muted-strong h-7 w-16 rounded-lg" />
                <span className="bg-muted-strong h-7 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
