import { act, render, screen } from '@testing-library/react';
import { use } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissAppSplash, markAppContentSettled } from '@/lib/app-splash.ts';
import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import type { AppSplashSlotProps } from './AppSplashSlot.tsx';

const route = vi.hoisted(() => ({ pathname: '/login' }));
/** While true, the slot's chunk is "still loading" — the mock suspends forever. */
const chunk = vi.hoisted(() => ({ loading: false }));
const neverResolves = new Promise<never>(() => undefined);

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: route.pathname } }),
}));

// The real slot is covered by its own suite; here, only WHEN it loads matters.
vi.mock('./AppSplashSlot.tsx', () => ({
  AppSplashSlot: ({ offlineAtMount, greets }: AppSplashSlotProps) => {
    if (chunk.loading) use(neverResolves);
    return (
      <span
        data-testid="splash-slot"
        data-offline={String(offlineAtMount)}
        data-greets={String(greets)}
      />
    );
  },
}));

const { AppSplashSlotLazy } = await import('./AppSplashSlotLazy.tsx');

function mountSplash() {
  const splash = document.createElement('div');
  splash.id = 'app-splash';
  splash.setAttribute('aria-label', `Loading ${PRODUCT_NAME}`);
  document.body.prepend(splash);
  return splash;
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

describe('AppSplashSlotLazy', () => {
  beforeEach(() => {
    route.pathname = '/login';
    setOnline(true);
  });

  afterEach(() => {
    document.getElementById('app-splash')?.remove();
    vi.restoreAllMocks();
  });

  it('renders nothing once the splash is gone', () => {
    const { container } = render(<AppSplashSlotLazy />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the splash with the translated label', () => {
    const splash = mountSplash();
    splash.setAttribute('aria-label', 'placeholder');
    render(<AppSplashSlotLazy />);
    expect(splash).toHaveAttribute('aria-label', `Loading ${PRODUCT_NAME}`);
  });

  it('does not load the slot for a guest boot — frames 1–4 only', () => {
    mountSplash();
    render(<AppSplashSlotLazy />);
    expect(screen.queryByTestId('splash-slot')).not.toBeInTheDocument();
  });

  it.each([
    '/organization/acme',
    '/organization/acme/today',
    '/organization/acme/medical/sales',
  ])(
    'loads the greeting slot when the boot lands in the org layout (%s)',
    async (pathname) => {
      route.pathname = pathname;
      mountSplash();
      render(<AppSplashSlotLazy />);
      const slot = await screen.findByTestId('splash-slot');
      expect(slot).toHaveAttribute('data-greets', 'true');
      expect(slot).toHaveAttribute('data-offline', 'false');
    },
  );

  it.each(['/organization', '/organization/Not A Slug', '/dashboard', '/onboarding'])(
    'does not greet outside the org layout (%s)',
    (pathname) => {
      route.pathname = pathname;
      mountSplash();
      render(<AppSplashSlotLazy />);
      expect(screen.queryByTestId('splash-slot')).not.toBeInTheDocument();
    },
  );

  it('loads the slot on any boot when the device is offline at mount', async () => {
    setOnline(false);
    mountSplash();
    render(<AppSplashSlotLazy />);
    const slot = await screen.findByTestId('splash-slot');
    expect(slot).toHaveAttribute('data-offline', 'true');
    expect(slot).toHaveAttribute('data-greets', 'false');
  });

  it('holds the splash while the slot’s chunk is still loading', () => {
    vi.useFakeTimers();
    chunk.loading = true;
    try {
      route.pathname = '/organization/acme/today';
      const splash = mountSplash();
      render(<AppSplashSlotLazy />);
      dismissAppSplash();
      markAppContentSettled();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(splash).not.toHaveClass('app-splash-exiting');
    } finally {
      chunk.loading = false;
      vi.useRealTimers();
    }
  });

  it('goes away with the splash', async () => {
    route.pathname = '/organization/acme/today';
    const splash = mountSplash();
    render(<AppSplashSlotLazy />);
    await screen.findByTestId('splash-slot');

    act(() => {
      splash.remove();
      window.dispatchEvent(new CustomEvent('app-splash-dismissed'));
    });
    expect(screen.queryByTestId('splash-slot')).not.toBeInTheDocument();
  });
});
