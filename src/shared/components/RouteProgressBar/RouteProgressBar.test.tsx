import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useRouterStateMock } = vi.hoisted(() => ({ useRouterStateMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useRouterState: useRouterStateMock }));

import { RouteProgressBar } from './RouteProgressBar.tsx';

describe('RouteProgressBar', () => {
  it('renders a progress bar while a navigation is pending', () => {
    useRouterStateMock.mockReturnValue(true); // status === 'pending'
    render(<RouteProgressBar />);
    // The shared line, pinned to the page's top edge above the shell, named for assistive tech.
    expect(screen.getByTestId('route-progress')).toHaveClass(
      'fixed',
      'inset-x-0',
      'top-0',
      'z-[60]',
      'h-0.5',
    );
    expect(screen.getByRole('progressbar', { name: 'Loading page' })).toBeInTheDocument();
  });

  it('renders nothing when idle', () => {
    useRouterStateMock.mockReturnValue(false);
    render(<RouteProgressBar />);
    expect(screen.queryByTestId('route-progress')).not.toBeInTheDocument();
  });
});
