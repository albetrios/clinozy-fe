import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { reloadOntoLatestBuild } from '@/core/version/check.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { reportError } from '@/shared/errors/errorHandler.ts';

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
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-8"
        data-testid="route-error-boundary"
      >
        <h1 className="text-foreground text-4xl font-bold">{err.status}</h1>
        <p className="text-muted-foreground text-lg">
          {err.status === 404
            ? t(ERRORS_KEYS.route.notFound)
            : (err.statusText ?? t(ERRORS_KEYS.route.generic))}
        </p>
        <Button asChild className="mt-4">
          <Link to="/">{t(ERRORS_KEYS.route.goHome)}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8"
      data-testid="route-error-boundary"
    >
      <h1 className="text-foreground text-4xl font-bold">
        {t(ERRORS_KEYS.global.title)}
      </h1>
      <p className="text-muted-foreground text-lg">{t(ERRORS_KEYS.global.message)}</p>
      {/* SW-aware reload — a raw location.reload() under an old controlling
          worker re-serves the exact stale shell/chunks that just crashed. */}
      <Button type="button" className="mt-4" onClick={reloadOntoLatestBuild}>
        {t(ERRORS_KEYS.route.refresh)}
      </Button>
    </div>
  );
}
