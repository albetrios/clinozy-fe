import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { applyTheme } from '@/shared/theme/index.ts';

type Mode = 'light' | 'dark' | 'system';

const MODES: readonly string[] = ['light', 'dark', 'system'] satisfies readonly Mode[];

interface ThemeStore {
  /** Light/dark mode. */
  theme: Mode;
  setTheme: (theme: Mode) => void;
}

/**
 * The persisted mode, or the default — light, the design's default — for
 * anything else: a missing value, a corrupt one, or a payload from a build that
 * never had this key.
 */
function readMode(persisted: unknown): Mode {
  const theme =
    persisted && typeof persisted === 'object'
      ? (persisted as { theme?: unknown }).theme
      : undefined;
  return typeof theme === 'string' && MODES.includes(theme) ? (theme as Mode) : 'light';
}

/**
 * The resolved palette the retired generated looks left for the boot script
 * (`theme-boot-vars`). Nothing reads it any more; cleared once, with the
 * migration that retires the looks.
 */
const RETIRED_BOOT_SNAPSHOT_KEY = 'theme-boot-vars';

function dropRetiredBootSnapshot(): void {
  try {
    localStorage.removeItem(RETIRED_BOOT_SNAPSHOT_KEY);
  } catch {
    // Storage unavailable (private mode): nothing was written there either.
  }
}

function applyMode(theme: Mode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'system' && systemDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * The mode — light, dark or the OS's — over the app's one look. Persisted on
 * the device (`theme-preference`); `public/theme-init.js` applies the same mode
 * and look before first paint, so the boot never flashes the other one.
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        applyMode(theme);
        set({ theme });
      },
    }),
    {
      name: 'theme-preference',
      // v8 retires the Appearance studio: presets, the generated look and its
      // seed, base colour, menu style, icon weight / colour / library and the
      // content width are no longer the user's to pick. Only the mode survives
      // the migration; every other field an earlier build saved is dropped, so
      // no old value can reach the page.
      version: 8,
      migrate: (persisted) => {
        dropRetiredBootSnapshot();
        return { theme: readMode(persisted) } as ThemeStore;
      },
      // A stored mode outside the three (a hand edit, a corrupt write) falls
      // back to light instead of reaching the page.
      merge: (persisted, current) => ({ ...current, theme: readMode(persisted) }),
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        applyMode(state?.theme ?? 'light');
        applyTheme();
      },
    },
  ),
);

// Listen for system theme changes with proper cleanup via AbortController
const themeListenerController = new AbortController();

if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (useThemeStore.getState().theme !== 'system') return;
    applyMode('system');
  };

  mediaQuery.addEventListener('change', handler, {
    signal: themeListenerController.signal,
  });

  // Cleanup on HMR
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      themeListenerController.abort();
    });
  }
}
