import { Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { isMultiLocaleBuild } from '@/lib/i18n/build-runtime.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { closeControlClassName } from '@/lib/icon-surface.ts';
import { useRetryableLazy } from '@/lib/lazy-module.ts';
import { cn } from '@/lib/utils.ts';
import { useEnterAnimationProps } from '@/shared/components/LazyOverlay/index.ts';
import { PickerLayerContext } from '@/shared/components/Picker/picker-layer.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useEscapeLayer } from '@/shared/hooks/useEscapeLayer/index.ts';
import { Sparkles, X } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { APPEARANCE_KEYS } from './appearance.constants.ts';
import {
  APPEARANCE_DIALOG_KEYS,
  APPEARANCE_DIALOG_NS,
} from './appearance-dialog.constants.ts';
import { loadAppearancePanel } from './appearance-panel-loader.ts';

function AppearanceContent() {
  const { t } = useTranslation(ERRORS_NS);
  const { t: tLocale } = useTranslation(LOCALE_NS);
  const { Component: Panel, retry } = useRetryableLazy(loadAppearancePanel);
  const localeSections = [
    isMultiLocaleBuild() ? LOCALE_KEYS.languageHeading : LOCALE_KEYS.textDirectionHeading,
    LOCALE_KEYS.dateTimeHeading,
    LOCALE_KEYS.numberStyleHeading,
  ];
  const sections = platformConfig.themeLock
    ? [APPEARANCE_KEYS.themeTitle, ...localeSections]
    : [
        ...localeSections,
        APPEARANCE_KEYS.themeTitle,
        APPEARANCE_KEYS.modeTitle,
        APPEARANCE_KEYS.colourTitle,
        APPEARANCE_KEYS.typeTitle,
        APPEARANCE_KEYS.iconsTitle,
        ...(platformConfig.layoutWidthForced === null
          ? [APPEARANCE_KEYS.layoutTitle]
          : []),
        APPEARANCE_KEYS.surfaceTitle,
      ];

  return (
    <SectionErrorBoundary
      title={t(ERRORS_KEYS.widget.appearance)}
      testId="appearance-dialog-error"
      variant="inline"
      onReset={retry}
    >
      <Suspense
        fallback={
          <div data-testid="appearance-dialog-pending" className="flex flex-col gap-3">
            <output className="sr-only">{tLocale(LOCALE_KEYS.loading)}</output>
            {/* The cards' own frame and head, their pills as the design's flat
                bars (`muted-strong`, no shimmer). Plain spans, not SkeletonBar:
                this shell is on the entry chunk, and the import would carry the
                skeleton module onto first paint. */}
            {sections.map((section) => (
              <div
                key={section}
                data-slot="card"
                className="bg-card flex flex-col gap-3 rounded-xl border p-(--step-pad)"
              >
                <h3 className="text-field leading-[1.3] font-semibold">
                  {tLocale(section)}
                </h3>
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="bg-muted-strong h-7 w-16 rounded-lg" />
                  <span className="bg-muted-strong h-7 w-16 rounded-lg" />
                  <span className="bg-muted-strong h-7 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <Panel />
      </Suspense>
    </SectionErrorBoundary>
  );
}

/**
 * Dedicated Appearance popup — a NON-MODAL side panel pinned to the inline-end
 * edge, in the launch's panel language: 12px corners, the panel elevation (its
 * `popover-content` slot), a hairline-edged head in the 15px title step, and the
 * settings cards on the canvas beneath it.
 * No scrim, no focus trap, no scroll lock: the page behind stays fully visible +
 * interactive while you tweak the theme. Sits above modals and any other layer
 * (z-80, pointer-events re-enabled), and is mounted at the route root, so it works
 * on every layout — auth, public, and app. Open state lives in useUIStore; Esc,
 * the close button, or a click outside dismisses it.
 */
export function AppearanceDialog() {
  const { t } = useTranslation(LOCALE_NS);
  const { t: tSettings } = useTranslation(APPEARANCE_DIALOG_NS);
  const open = useUIStore((s) => s.appearanceOpen);
  const setOpen = useUIStore((s) => s.setAppearanceOpen);
  const shuffleTheme = useThemeStore((s) => s.shuffleTheme);
  const panelRef = useRef<HTMLElement>(null);

  // Esc closes the panel alone — not the drawer under it — and leaves the key
  // to a picker or dialog opened over it (the top-most surface first).
  useEscapeLayer(open ? () => setOpen(false) : undefined);

  useEffect(() => {
    if (!open) return;
    // Click-outside dismiss. Clicks inside portaled overlays (the pickers' lists
    // — a popover, or a phone's bottom sheet and its dim layer — menus, toasts)
    // count as "inside" so they don't close the popup.
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (
        !target ||
        panelRef.current?.contains(target) ||
        target.closest(
          '[data-picker-surface],[data-slot="drawer-overlay"],[data-slot="popover-content"],[data-slot="dropdown-menu-content"],[data-sonner-toaster]',
        )
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open, setOpen]);

  const enterProps = useEnterAnimationProps();

  const handleShuffle = () => {
    shuffleTheme();
    notify.info('Theme shuffled', { description: 'A fresh look across every axis.' });
  };

  if (!open) return null;

  return (
    <aside
      // Suppressed when a placeholder already painted this panel — replaying the
      // slide-in there makes it blink out and slide back in from the edge.
      {...enterProps}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="appearance-popover-title"
      data-testid="appearance-dialog"
      data-slot="popover-content"
      className="bg-popover text-popover-foreground border-border animate-in slide-in-from-end-2 fade-in rtl:slide-in-from-start-2 pointer-events-auto fixed end-3 top-3 z-[80] flex max-h-[calc(100dvh-1.5rem)] w-[min(100vw-1.5rem,480px)] flex-col overflow-hidden rounded-xl border transition"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b px-(--drawer-pad-x) py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id="appearance-popover-title"
            className="text-title leading-[1.3] font-semibold tracking-[-0.01em]"
          >
            {tSettings(APPEARANCE_DIALOG_KEYS.title)}
          </h2>
          <p className="text-muted-foreground text-xs leading-[1.45]">
            {tSettings(APPEARANCE_DIALOG_KEYS.description)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            data-testid="theme-shuffle"
          >
            <Sparkles className="me-1.5 size-3.5" aria-hidden="true" />
            {tSettings(APPEARANCE_DIALOG_KEYS.shuffle)}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t(LOCALE_KEYS.closeAria)}
            data-testid="appearance-close"
            data-slot="button"
            className={cn(closeControlClassName, '-me-1')}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="bg-canvas min-h-0 flex-1 overflow-y-auto px-(--drawer-pad-x) py-4">
        {/* The panel sits at z-80, over the app's overlays: its pickers open above it. */}
        <PickerLayerContext value="raised">
          <AppearanceContent />
        </PickerLayerContext>
      </div>
    </aside>
  );
}
