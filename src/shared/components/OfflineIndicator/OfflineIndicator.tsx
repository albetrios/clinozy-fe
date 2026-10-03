import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus/index.ts';

/**
 * Offline indicator — shows a banner when the user loses connectivity.
 * Auto-dismisses when connectivity returns.
 * Uses role="alert" and aria-live for screen reader announcement.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="offline-indicator"
      data-slot="card"
      className="bg-destructive text-destructive-foreground fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-sm"
    >
      You are offline. Some features may be unavailable.
    </div>
  );
}
