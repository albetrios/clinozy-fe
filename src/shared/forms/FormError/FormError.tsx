import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import { AlertCircle } from '@/shared/icons/index.ts';

interface FormErrorProps {
  message?: string | null;
  /**
   * Optional control rendered inline after the message — a retry, typically.
   * Lives inside the banner so a recoverable error carries its own way out
   * instead of the fix being stranded in loose text next to it.
   */
  action?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/**
 * Standalone error display for non-field errors (API errors, general form errors):
 * the design's "danger soft" — `destructive-tint` with `destructive` text and a
 * `destructive-border` hairline, 8px corners, 13px copy (`preset.md` Status and
 * soft fills). Flat: an inline message, not a card, so it casts no shadow.
 */
export function FormError({
  message,
  action,
  className,
  'data-testid': dataTestId,
}: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      data-testid={dataTestId ?? 'form-error'}
      className={cn(
        'border-destructive-border bg-destructive-tint text-destructive text-body flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2.5',
        className,
      )}
      role="alert"
    >
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-pretty">{message}</span>
      {action}
    </div>
  );
}
