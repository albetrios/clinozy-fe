import { Link } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { reloadOntoLatestBuild } from '@/core/version/check.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { BrandLogo } from '@/shared/components/ProductMark/index.ts';
import {
  FALLBACK_BUTTON_CLASS,
  FallbackState,
} from '@/shared/components/RouteErrorBoundary/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { AlertTriangle, Compass } from '@/shared/icons/index.ts';

/** Error-like with optional status (e.g. from TanStack Router or Response). */
function hasStatus(e: unknown): e is { status: number; statusText?: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    typeof (e as { status: unknown }).status === 'number'
  );
}

/**
 * The page around the app-level fallback: the signed-out canvas with the logo
 * where the clinic header draws it and the state centred on the viewport — the
 * `PublicFrame` look in plain markup, because this boundary lives in the entry
 * chunk and stays on what the entry already carries.
 */
function FallbackPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-canvas text-foreground flex min-h-dvh flex-col"
      data-testid="route-error-boundary"
    >
      <header className="flex min-h-13 flex-none items-center px-(--room-header-pad-x) md:min-h-15">
        <BrandLogo wordmark="always" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center pb-13 md:pb-15">
        {children}
      </main>
    </div>
  );
}

/**
 * Top-level error boundary for TanStack Router.
 * Receives error from route errorComponent. Reports non-404 errors to Sentry.
 */
export function ErrorBoundary({ error }: { error?: unknown }) {
  const { t } = useTranslation(ERRORS_NS);
  const err = error;

  useEffect(() => {
    if (err != null && (!hasStatus(err) || (hasStatus(err) && err.status !== 404))) {
      reportError(err);
    }
  }, [err]);

  if (err != null && hasStatus(err)) {
    const missing = err.status === 404;
    return (
      <FallbackPage>
        <FallbackState
          headingLevel={1}
          tone={missing ? 'stone' : 'blush'}
          icon={missing ? <Compass /> : <AlertTriangle />}
          emblem={missing ? 'missing' : 'broken'}
          label={t(ERRORS_KEYS.public.status, { status: err.status })}
          title={
            missing ? t(ERRORS_KEYS.public.missingTitle) : t(ERRORS_KEYS.global.title)
          }
          description={
            missing
              ? t(ERRORS_KEYS.route.notFound)
              : (err.statusText ?? t(ERRORS_KEYS.route.generic))
          }
          actions={
            <Button asChild className={FALLBACK_BUTTON_CLASS}>
              <Link to="/">{t(ERRORS_KEYS.route.goHome)}</Link>
            </Button>
          }
        />
      </FallbackPage>
    );
  }

  return (
    <FallbackPage>
      <FallbackState
        headingLevel={1}
        tone="blush"
        icon={<AlertTriangle />}
        emblem="broken"
        label={t(ERRORS_KEYS.public.brokenLabel)}
        title={t(ERRORS_KEYS.global.title)}
        description={t(ERRORS_KEYS.global.message)}
        actions={
          // SW-aware reload — a raw location.reload() under an old controlling
          // worker re-serves the exact stale shell/chunks that just crashed.
          <Button
            type="button"
            className={FALLBACK_BUTTON_CLASS}
            onClick={reloadOntoLatestBuild}
          >
            {t(ERRORS_KEYS.route.refresh)}
          </Button>
        }
      />
    </FallbackPage>
  );
}
