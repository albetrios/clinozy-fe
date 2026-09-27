import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { OfflineIndicator } from './OfflineIndicator.tsx';

describe('OfflineIndicator', () => {
  const originalNavigator = global.navigator;

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

  it('shows message when offline (mock navigator.onLine)', () => {
    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, onLine: false },
      writable: true,
    });

    render(<OfflineIndicator />);
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });

  it('has role="alert" when visible', () => {
    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, onLine: false },
      writable: true,
    });

    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations when visible', async () => {
    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, onLine: false },
      writable: true,
    });

    const { container } = render(<OfflineIndicator />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
