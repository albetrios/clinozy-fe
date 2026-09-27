import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { AlertTriangle } from '@/shared/icons/index.ts';

/**
 * Route-level error component wired as `errorComponent` on every route in
 * routeTree.tsx. Scopes a render/loader crash to the island that threw it.
 */
export function RouteErrorBoundary({ error, reset }: Readonly<ErrorComponentProps>) {
  const { t } = useTranslation(ERRORS_NS);

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center"
      data-testid="route-error-boundary"
    >
      <AlertTriangle className="text-destructive size-10" aria-hidden />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t(ERRORS_KEYS.route.pageTitle)}</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {error instanceof Error ? error.message : t(ERRORS_KEYS.route.pageMessage)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} data-testid="route-error-retry">
          {t(ERRORS_KEYS.route.tryAgain)}
        </Button>
        <Button variant="outline" asChild>
          <a href="/">{t(ERRORS_KEYS.route.goHome)}</a>
        </Button>
      </div>
    </div>
  );
}
