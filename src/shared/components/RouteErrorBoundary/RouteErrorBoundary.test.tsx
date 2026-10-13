import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  FALLBACK_BUTTON_CLASS,
  FallbackState,
  RouteErrorBoundary,
} from './RouteErrorBoundary.tsx';

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

  it("draws the design's empty state in the blush tone of trouble", () => {
    renderBoundary(new Error('boom'));
    const boundary = screen.getByTestId('route-error-boundary');
    expect(boundary).toHaveAttribute('data-tone', 'blush');
    expect(
      screen.getByRole('heading', { level: 2, name: 'This page hit an error' }),
    ).toHaveClass('text-title');
    // The 36px buttons in EmptyStateAction's look.
    expect(screen.getByTestId('route-error-retry')).toHaveClass(
      ...FALLBACK_BUTTON_CLASS.split(' '),
    );
  });

  it('lets a long technical message wrap instead of running off a phone', () => {
    renderBoundary(
      new Error('Failed to fetch dynamically imported module: https://x.test/a.js'),
    );
    expect(screen.getByText(/Failed to fetch/)).toHaveClass('wrap-anywhere');
  });
});

describe('FallbackState', () => {
  it('draws the illustration — ring, disc, tile, dots — in its tone', () => {
    render(
      <FallbackState
        tone="stone"
        icon={<svg data-testid="icon" />}
        title="Page not found"
        testId="state"
      />,
    );
    const art = screen.getByTestId('fallback-illustration');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(art).toHaveClass('size-24');
    const [ring, disc, tile, dot, smallDot] = Array.from(art.children);
    expect(ring).toHaveClass('border-dashed', 'rounded-full');
    expect(disc).toHaveClass('bg-tone-stone', 'rounded-full');
    expect(tile).toHaveClass('size-10', 'rounded-xl', 'text-tone-stone-foreground');
    expect(tile).toContainElement(screen.getByTestId('icon'));
    expect(dot).toHaveClass('bg-tone-stone-dot', 'size-2.5');
    expect(smallDot).toHaveClass('bg-border', 'size-1.5');
    expect(screen.getByTestId('state')).toHaveAttribute('data-tone', 'stone');
  });

  it('names the page with an h1 when it is the page, and lays out its actions', () => {
    render(
      <FallbackState
        tone="blush"
        icon={<svg />}
        headingLevel={1}
        title="Something went wrong"
        description="Reload the page."
        actions={<button type="button">Refresh</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Reload the page.')).toHaveClass('text-detail', 'max-w-80');
    expect(screen.getByRole('button', { name: 'Refresh' }).parentElement).toHaveClass(
      'flex-wrap',
      'justify-center',
    );
  });

  it('leaves out the line and the actions it is not given', () => {
    const { container } = render(
      <FallbackState tone="stone" icon={<svg />} title="Gone" />,
    );
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
