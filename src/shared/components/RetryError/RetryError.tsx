import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { AlertTriangle } from '@/shared/icons/index.ts';

interface RetryErrorProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Shared error fallback with retry button.
 * Used when API calls fail and the user can attempt to reload: the design's
 * 40px empty-state tile in the blush tone of trouble, the 12.5px muted line
 * and the retry — compact, because it stands in for one panel's content.
 */
export function RetryError({ message, onRetry, isRetrying = false }: RetryErrorProps) {
  const { t } = useTranslation(ERRORS_NS);
  const displayMessage = message ?? t(ERRORS_KEYS.route.generic);

  return (
    <div
      role="alert"
      data-testid="retry-error"
      className="flex flex-col items-center gap-3 px-4 py-12 text-center"
    >
      <span
        aria-hidden="true"
        className="bg-tone-blush text-tone-blush-foreground flex size-10 items-center justify-center rounded-xl"
      >
        <AlertTriangle className="size-4.5" />
      </span>
      <p className="text-muted-foreground text-detail max-w-80 text-pretty">
        {displayMessage}
      </p>
      <Button onClick={onRetry} isLoading={isRetrying} data-testid="retry-button">
        {t(ERRORS_KEYS.frontend.query.retry)}
      </Button>
    </div>
  );
}
