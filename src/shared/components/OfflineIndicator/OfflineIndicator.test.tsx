import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import {
  SPLASH_KEYS,
  SPLASH_NS,
} from '@/shared/components/AppSplashSlot/app-splash.constants.ts';

import { OfflineIndicator } from './OfflineIndicator.tsx';

describe('OfflineIndicator', () => {
  const originalNavigator = global.navigator;

  const goOffline = () =>
    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, onLine: false },
      writable: true,
    });

  beforeEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, onLine: true },
      writable: true,
    });
  });

  it('returns null when online (default)', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("says the splash's own offline line when offline (mock navigator.onLine)", () => {
    goOffline();

    render(<OfflineIndicator />);
    // Pinned to the splash's key table: the indicator declares the key itself
    // (entry chunk), so this is what keeps the two in step.
    expect(
      screen.getByText(i18n.t(SPLASH_KEYS.offline.message, { ns: SPLASH_NS })),
    ).toBeInTheDocument();
    expect(screen.getByText(/can’t reach/i)).toBeInTheDocument();
  });

  it('is the design notice pill: the ink pill, centred above the bottom stack', () => {
    goOffline();

    render(<OfflineIndicator />);
    const pill = screen.getByTestId('offline-indicator');
    expect(pill).toHaveAttribute('data-slot', 'pill');
    expect(pill).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
      'rounded-full',
      'h-11',
    );
    expect(pill.className).toContain('var(--floating-bottom-offset');
  });

  it('has role="alert" when visible', () => {
    goOffline();

    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations when visible', async () => {
    goOffline();

    const { container } = render(<OfflineIndicator />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
