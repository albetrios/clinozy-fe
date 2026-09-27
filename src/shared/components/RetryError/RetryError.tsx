import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { AlertCircle } from '@/shared/icons/index.ts';

interface RetryErrorProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Shared error fallback with retry button.
 * Used when API calls fail and the user can attempt to reload.
 */
export function RetryError({ message, onRetry, isRetrying = false }: RetryErrorProps) {
  const { t } = useTranslation(ERRORS_NS);
  const displayMessage = message ?? t(ERRORS_KEYS.route.generic);

  return (
    <div
      role="alert"
      data-testid="retry-error"
      className="flex flex-col items-center gap-4 py-12"
    >
      <AlertCircle className="text-destructive h-12 w-12" aria-hidden="true" />
      <p className="text-muted-foreground">{displayMessage}</p>
      <Button onClick={onRetry} isLoading={isRetrying} data-testid="retry-button">
        {t(ERRORS_KEYS.frontend.query.retry)}
      </Button>
    </div>
  );
}
