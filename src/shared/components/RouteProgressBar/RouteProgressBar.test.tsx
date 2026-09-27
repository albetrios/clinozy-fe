import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useRouterStateMock } = vi.hoisted(() => ({ useRouterStateMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useRouterState: useRouterStateMock }));

import { RouteProgressBar } from './RouteProgressBar.tsx';

describe('RouteProgressBar', () => {
  it('renders a progress bar while a navigation is pending', () => {
    useRouterStateMock.mockReturnValue(true); // status === 'pending'
    render(<RouteProgressBar />);
    expect(screen.getByTestId('route-progress')).toBeInTheDocument();
  });

  it('renders nothing when idle', () => {
    useRouterStateMock.mockReturnValue(false);
    render(<RouteProgressBar />);
    expect(screen.queryByTestId('route-progress')).not.toBeInTheDocument();
  });
});
