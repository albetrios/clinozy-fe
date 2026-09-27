import { useSyncExternalStore } from 'react';

import { afterPaint } from '@/lib/app-splash.ts';
import { IDLE_PREFETCH_TIMEOUT_MS } from '@/lib/chunk-prefetch.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import type { IconName } from './icon-names.ts';
import type { AppIcon } from './icon-types.ts';

type IconSet = Record<IconName, AppIcon>;

// Lucide (the default) lives in the barrel and is always available; only the
// lazy alternative sets are cached here, populated when first selected.
const cache = new Map<string, IconSet>();
const listeners = new Set<() => void>();

function loadModule(lib: string): Promise<{ iconSet: IconSet }> | null {
  if (lib === 'tabler') return import('./iconset-tabler.ts');
  if (lib === 'phosphor') return import('./iconset-phosphor.ts');
  return null;
}

/** Kick the lazy chunk for a library (no-op for lucide / already-loaded / unknown). */
export function loadIconSet(lib: string): void {
  if (cache.has(lib)) return;
  const mod = loadModule(lib);
  if (!mod) return;
  mod
    .then((m) => {
      cache.set(lib, m.iconSet);
      for (const notify of listeners) notify();
    })
    .catch(() => {
      // leave it uncached — the barrel keeps falling back to Lucide
    });
}

/** The loaded alt-set for `lib`, or null while it loads / for lucide. Reactive. */
export function useIconSet(lib: string): IconSet | null {
  const get = () => cache.get(lib) ?? null;
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    get,
    get,
  );
}

function scheduleAltIconSetLoad(): void {
  const lib = useThemeStore.getState().iconLibrary;
  if (lib === 'lucide') return;

  afterPaint(() => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => loadIconSet(lib), {
        timeout: IDLE_PREFETCH_TIMEOUT_MS,
      });
    } else {
      globalThis.setTimeout(() => loadIconSet(lib), 2000);
    }
  });
}

/**
 * Defer Phosphor/Tabler chunks until after auth — Lucide covers login and boot.
 * Call once from `main.tsx`.
 */
export function initDeferredIconSets(): void {
  useAuthStore.subscribe((state, prev) => {
    const becameAuthed =
      state.isAuthenticated &&
      !state.isLoading &&
      (!prev.isAuthenticated || prev.isLoading);
    if (becameAuthed) scheduleAltIconSetLoad();
  });

  useThemeStore.subscribe((state, prev) => {
    if (state.iconLibrary === prev.iconLibrary) return;
    if (state.iconLibrary === 'lucide') return;
    const auth = useAuthStore.getState();
    if (auth.isAuthenticated && !auth.isLoading) loadIconSet(state.iconLibrary);
  });

  const auth = useAuthStore.getState();
  if (auth.isAuthenticated && !auth.isLoading) scheduleAltIconSetLoad();
}
