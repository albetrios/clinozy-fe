import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The global setup stubs `matchMedia` with inert listeners, so the store's
 * module-level `change` subscription can never fire. This one records its
 * listeners and can flip the OS preference under them.
 */
function installMatchMedia(initialDark: boolean) {
  const listeners = new Set<() => void>();
  let prefersDark = initialDark;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return query.includes('prefers-color-scheme: dark') ? prefersDark : false;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => false,
    }),
  });

  return {
    /** Move the OS preference and notify whoever subscribed. */
    flip(nextDark: boolean) {
      prefersDark = nextDark;
      for (const listener of listeners) listener();
    },
  };
}

/** Re-import the store so its module-level listener binds to the stub above. */
async function freshStore() {
  vi.resetModules();
  return (await import('./useThemeStore.ts')).useThemeStore;
}

/**
 * `system` mode follows the OS, so an OS flip is a third way into `applyMode`
 * beside the in-app switcher and the boot.
 */
describe('useThemeStore — OS colour-scheme changes', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    vi.resetModules();
  });

  it('an OS flip switches system mode with it', async () => {
    const media = installMatchMedia(false);
    const useThemeStore = await freshStore();
    useThemeStore.setState({ theme: 'system' });

    media.flip(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    media.flip(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('leaves a pinned mode alone when the OS flips under it', async () => {
    const media = installMatchMedia(false);
    const useThemeStore = await freshStore();
    useThemeStore.setState({ theme: 'light' });

    media.flip(true);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
