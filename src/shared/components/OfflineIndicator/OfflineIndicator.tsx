import { useEffect, useState } from 'react';

/**
 * Offline indicator — shows a banner when the user loses connectivity.
 * Auto-dismisses when connectivity returns.
 * Uses role="alert" and aria-live for screen reader announcement.
 */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

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
