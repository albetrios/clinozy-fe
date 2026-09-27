import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import {
  formatRateLimitMessage,
  getRateLimitRetryAfterSeconds,
  isRateLimitError,
} from '@/shared/errors/rate-limit.ts';

export interface RateLimitNoticeProps {
  error: unknown;
  className?: string;
  onDismiss?: () => void;
}

/**
 * Inline alert when an API call returns HTTP 429. Shows a countdown when the
 * server supplies `retry_after`.
 */
export function RateLimitNotice({ error, className, onDismiss }: RateLimitNoticeProps) {
  const retryAfter = getRateLimitRetryAfterSeconds(error);
  const [secondsLeft, setSecondsLeft] = useState(retryAfter);
  // Reset the countdown during render when a fresh 429 arrives (React-endorsed
  // "adjust state on prop change" — avoids a setState-in-effect cascade).
  const [lastRetryAfter, setLastRetryAfter] = useState(retryAfter);
  if (retryAfter !== lastRetryAfter) {
    setLastRetryAfter(retryAfter);
    setSecondsLeft(retryAfter);
  }

  useEffect(() => {
    if (!secondsLeft || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  if (!isRateLimitError(error)) return null;

  // A missing or finished countdown (0) falls back to the server's retry-after.
  const message = formatRateLimitMessage(
    secondsLeft !== undefined && secondsLeft > 0 ? secondsLeft : retryAfter,
  );

  return (
    <div
      role="alert"
      data-testid="rate-limit-notice"
      className={cn(
        'bg-destructive/10 text-destructive border-destructive/30 rounded-md border px-3 py-2 text-sm',
        className,
      )}
    >
      <p>{message}</p>
      {onDismiss ? (
        <button
          type="button"
          className="text-destructive mt-1 text-xs underline"
          onClick={onDismiss}
          data-testid="rate-limit-dismiss"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
