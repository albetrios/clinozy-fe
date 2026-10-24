import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ErrorBoundary } from './ErrorBoundary.tsx';

vi.mock('@/shared/errors/errorHandler.ts', () => ({
  reportError: vi.fn(),
}));

describe('ErrorBoundary', () => {
  const renderBoundary = (error?: unknown) =>
    renderWithProviders(<ErrorBoundary error={error} />);

  it('renders 404 message for status 404', async () => {
    renderBoundary({ status: 404, statusText: 'Not Found' });
    const boundary = await screen.findByTestId('route-error-boundary');
    expect(boundary).toBeInTheDocument();
    expect(screen.getByText('Error 404')).toBeInTheDocument();
    expect(screen.getByText(/The link may be out of date/i)).toBeInTheDocument();
  });

  it('renders generic error message for non-404 status', async () => {
    renderBoundary({ status: 500, statusText: 'Server Error' });
    const boundary = await screen.findByTestId('route-error-boundary');
    expect(boundary).toBeInTheDocument();
    expect(screen.getByText('Error 500')).toBeInTheDocument();
    expect(screen.getByText(/Server Error/)).toBeInTheDocument();
  });

  it('renders generic message for unknown error', async () => {
    renderBoundary(new Error('Unexpected'));
    const boundary = await screen.findByTestId('route-error-boundary');
    expect(boundary).toBeInTheDocument();
    expect(screen.getByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByText(/Refresh to try again/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderBoundary({
      status: 404,
      statusText: 'Not Found',
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('lays the signed-out canvas: the logo, then the state as the page heading', async () => {
    renderBoundary(new Error('Unexpected'));
    const boundary = await screen.findByTestId('route-error-boundary');
    expect(boundary).toHaveClass('bg-canvas', 'min-h-dvh');
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /^Something broke\s*Something went wrong on our side$/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh page' })).toBeInTheDocument();
  });

  it('draws a missing page’s emblem and a failure’s, the status in a pill in the heading', async () => {
    const { unmount } = renderBoundary({ status: 404 });
    await screen.findByTestId('route-error-boundary');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Error 404We can’t find that page',
    );
    expect(screen.getByText('Error 404')).toHaveAttribute('data-slot', 'pill');
    expect(screen.getByTestId('fallback-emblem')).toHaveAttribute(
      'data-emblem',
      'missing',
    );
    unmount();

    renderBoundary({ status: 500 });
    await screen.findByTestId('route-error-boundary');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Error 500Something went wrong on our side',
    );
    expect(screen.getByTestId('fallback-emblem')).toHaveAttribute(
      'data-emblem',
      'broken',
    );
    // No status text: the generic line.
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });
});
