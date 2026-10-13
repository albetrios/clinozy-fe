import { useSyncExternalStore } from 'react';

/** What the browser believes right now — `navigator.onLine`, true where unknown. */
export function readOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Live `navigator.onLine`: re-renders on the window's `online` / `offline`
 * events. `false` means the browser knows it has no network; `true` is its best
 * guess, not a promise that a request will land.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, readOnline, () => true);
}
