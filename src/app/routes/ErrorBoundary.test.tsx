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
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(
      screen.getByText(/The page you are looking for does not exist/i),
    ).toBeInTheDocument();
  });

  it('renders generic error message for non-404 status', async () => {
    renderBoundary({ status: 500, statusText: 'Server Error' });
    const boundary = await screen.findByTestId('route-error-boundary');
    expect(boundary).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText(/Server Error/)).toBeInTheDocument();
  });

  it('renders generic message for unknown error', async () => {
    renderBoundary(new Error('Unexpected'));
    const boundary = await screen.findByTestId('route-error-boundary');
    expect(boundary).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected error occurred. Please try reloading/i),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderBoundary({
      status: 404,
      statusText: 'Not Found',
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
