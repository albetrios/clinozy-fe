import { Link, useRouterState } from '@tanstack/react-router';
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
import { iconOnBrandSurface } from '@/lib/icon-surface.ts';
import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { cn } from '@/lib/utils.ts';
import type { PickerSingleProps } from '@/shared/components/Picker/index.ts';
import { ProductMark } from '@/shared/components/ProductMark/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { ChevronDown, ShieldCheck, Sparkles, Users, Zap } from '@/shared/icons/index.ts';
import {
  AUTH_LAYOUT_STAT_KEYS,
  LAYOUT_KEYS,
  LAYOUT_NS,
} from '@/shared/layouts/layout.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

/** The keyframe class on the form slot. Replayed imperatively — see {@link AuthForm}. */
const AUTH_FORM_ANIMATION_CLASS = 'animate-fade-in-up';

// eslint-disable-next-line react-refresh/only-export-components -- static config colocated with the layout shell
export const AUTH_MARKETING_FEATURES = [
  { ...LAYOUT_KEYS.auth.features.multiOrg, Icon: Users },
  { ...LAYOUT_KEYS.auth.features.secure, Icon: ShieldCheck },
  { ...LAYOUT_KEYS.auth.features.fast, Icon: Zap },
] as const;

export type AuthLayoutShellProps = {
  children: ReactNode;
};

export function SkipLink() {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <a
      href="#main-content"
      className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:underline"
    >
      {t(LAYOUT_KEYS.a11y.skipToMain)}
    </a>
  );
}

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

/** Theme + language controls for auth shell variants (single auth screen). */
export function AuthControls({ surface = 'default' }: { surface?: 'default' | 'brand' }) {
  // Subscribe to the layout namespace so the control re-renders on locale change.
  useTranslation(LAYOUT_NS);
  return (
    <div className="flex items-center gap-3">
      <AuthLocalePicker />
      <ThemeModeToggle surface={surface === 'brand' ? 'brand' : 'default'} />
    </div>
  );
}

export function BrandMark({ className }: { className?: string }) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <Link to="/login" className={cn('flex items-center gap-2.5', className)}>
      <ProductMark className="size-9" />
      <span className="text-lg font-semibold tracking-tight">
        {t(LAYOUT_KEYS.brand.name)}
      </span>
    </Link>
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

export function AuthHeroBadge() {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <span
      data-slot="pill"
      className="border-brand-foreground/20 bg-brand-foreground/10 text-brand-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
    >
      <Sparkles className={cn('h-3 w-3', iconOnBrandSurface)} aria-hidden="true" />{' '}
      {t(LAYOUT_KEYS.auth.badge)}
    </span>
  );
}

export function MobileBrandMark() {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <Link
      to="/login"
      className="flex items-center gap-2 lg:hidden"
      data-testid="auth-mobile-logo"
    >
      <ProductMark className="size-8" />
      <span className="text-sm font-semibold">{t(LAYOUT_KEYS.brand.name)}</span>
    </Link>
  );
}

export function AuthMarketingStats() {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <div className="border-primary/20 flex items-center gap-8 border-t pt-6">
      {AUTH_LAYOUT_STAT_KEYS.map((stat) => (
        <div key={stat.labelKey}>
          <p className="text-xl font-semibold tracking-tight">{stat.value}</p>
          <p className="text-brand-foreground/50 text-xs">{t(stat.labelKey)}</p>
        </div>
      ))}
    </div>
  );
}
