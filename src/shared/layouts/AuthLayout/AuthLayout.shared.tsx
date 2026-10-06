import { useRouterState } from '@tanstack/react-router';
import { type ComponentType, type ReactNode, Suspense, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';

import { useReplayedAnimation } from '@/lib/animations/index.ts';
import { isMultiLocaleBuild } from '@/lib/i18n/build-runtime.ts';
import {
  LOCALE_KEYS,
  LOCALE_LABEL_KEYS,
  LOCALE_NS,
} from '@/lib/i18n/locale.constants.ts';
import { I18N_LOCALES, isI18nLocale, LOCALE_NATIVE_LABELS } from '@/lib/i18n/locales.ts';
import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { cn } from '@/lib/utils.ts';
import type { PickerSingleProps } from '@/shared/components/Picker/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';
import { LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

/** The keyframe class on the form slot. Replayed imperatively — see {@link AuthForm}. */
const AUTH_FORM_ANIMATION_CLASS = 'animate-fade-in-up';

/**
 * The shared Picker, fetched on its own: `/login` paints its form without
 * waiting for the picker's list, bottom sheet and search.
 */
const loadLocalePicker = onceAsync(() =>
  import('@/shared/components/Picker/index.ts').then((module) => ({
    default: module.Picker as ComponentType<PickerSingleProps<unknown>>,
  })),
);

/**
 * The language trigger as it looks before the picker arrives (and if its chunk
 * fails): the picker's `sm` field with the current language — inert, so the
 * real control replaces it without a shift.
 */
function LocaleTriggerPlaceholder({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-background text-body flex min-h-8 min-w-[9.5rem] items-center gap-2 rounded-lg border ps-2.5 pe-2.5 shadow-(--elevation-control)"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronDown className="text-muted-foreground size-3.5 flex-none" />
    </span>
  );
}

/** Compact language switcher — sets UI locale (and auto RTL for Arabic) on auth. */
function AuthLocalePicker() {
  const { t } = useTranslation(LOCALE_NS);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { Component: LocalePicker } = useRetryableLazy(loadLocalePicker);

  if (!isMultiLocaleBuild()) return null;

  const options = I18N_LOCALES.map((code) => ({
    key: code,
    label: t(LOCALE_LABEL_KEYS[code], { defaultValue: LOCALE_NATIVE_LABELS[code] }),
  }));
  const placeholder = (
    <LocaleTriggerPlaceholder
      label={options.find((option) => option.key === locale)?.label ?? locale}
    />
  );
  return (
    <ErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <LocalePicker
          label={t(LOCALE_KEYS.openAria)}
          value={locale}
          options={options}
          plain
          onChange={(key) => {
            if (key && isI18nLocale(key)) void setLocale(key);
          }}
          size="sm"
          align="end"
          minWidth={180}
          testId="auth-locale-select"
          className="min-w-[9.5rem]"
        />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Theme + language controls for the sign-in screen. `frame` is the signed-out
 * canvas's header (`PublicFrame`): two 32px bordered controls, 8px apart, as
 * the clinic header draws its own.
 */
export function AuthControls({ surface = 'default' }: { surface?: 'default' | 'frame' }) {
  // Subscribe to the layout namespace so the control re-renders on locale change.
  useTranslation(LAYOUT_NS);
  return (
    <div className={cn('flex items-center', surface === 'frame' ? 'gap-2' : 'gap-3')}>
      <AuthLocalePicker />
      <ThemeModeToggle surface={surface} />
    </div>
  );
}

/**
 * The animated form slot — owns `auth-form-container`.
 *
 * The fade replays on the SAME element, and the element survives navigation.
 * This used to be `key={pathname}` off `useLocation()`, which was wrong twice
 * over. `useLocation()` reports the PENDING location: the router sets it the
 * moment `navigate()` is called, before the destination's guards, lazy chunk
 * and translations have loaded. So the key flipped while `/login` was still the
 * rendered match, React threw the login subtree away, and the freshly mounted
 * `AuthEmailPanel` came back at step "enter your email" — the user watched the
 * login form reappear after their code was accepted, then get replaced by the
 * real destination once it finally committed (LOGIN-7). The remount also wiped
 * the single-flight latches that keep a verified code from being submitted
 * twice, and the MFA hand-off latch.
 *
 * `resolvedLocation` only moves when a navigation COMMITS, so the fade plays
 * for real in-shell transitions (`/login` → `/mfa`) and never mid-flight. On
 * the very first render there is no resolved location yet, so fall back to the
 * current one.
 */
export function AuthForm({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (s) => s.resolvedLocation?.pathname ?? s.location.pathname,
  });
  const ref = useRef<HTMLDivElement>(null);
  useReplayedAnimation(ref, AUTH_FORM_ANIMATION_CLASS, pathname);
  return (
    <div
      ref={ref}
      className={cn(AUTH_FORM_ANIMATION_CLASS, 'w-full')}
      data-testid="auth-form-container"
    >
      {children}
    </div>
  );
}
