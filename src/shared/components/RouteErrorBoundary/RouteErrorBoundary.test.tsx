import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RouteErrorBoundary } from './RouteErrorBoundary.tsx';

function renderBoundary(error: unknown, reset = vi.fn()) {
  return {
    reset,
    // ErrorComponentProps also carries router internals we don't use; the
    // component only reads `error` and `reset`.
    ...render(
      <RouteErrorBoundary
        error={error as Error}
        reset={reset}
        info={{ componentStack: '' }}
      />,
    ),
  };
}

describe('RouteErrorBoundary', () => {
  it('renders the thrown error message scoped to the island', () => {
    renderBoundary(new Error('island exploded'));
    expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();
    expect(screen.getByText('island exploded')).toBeInTheDocument();
  });

  it('falls back to a generic message for non-Error throws', () => {
    renderBoundary('string throw');
    expect(
      screen.getByText('Something went wrong rendering this page.'),
    ).toBeInTheDocument();
  });

  it('calls reset when Try again is clicked', async () => {
    const user = userEvent.setup();
    const { reset } = renderBoundary(new Error('boom'));
    await user.click(screen.getByTestId('route-error-retry'));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('offers a way home', () => {
    renderBoundary(new Error('boom'));
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  it('has no a11y violations', async () => {
    const { container } = renderBoundary(new Error('boom'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
