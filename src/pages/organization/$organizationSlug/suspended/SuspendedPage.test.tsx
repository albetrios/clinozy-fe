import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SuspendedPage } from './SuspendedPage.tsx';

describe('SuspendedPage', () => {
  it('renders the page container', async () => {
    renderWithProviders(<SuspendedPage />);
    expect(await screen.findByTestId('suspended-page')).toBeInTheDocument();
  });

  it('is the empty state in the butter warning tone, naming the page', async () => {
    renderWithProviders(<SuspendedPage />);
    const page = await screen.findByTestId('suspended-page');
    expect(page.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'butter');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Organization suspended' }),
    ).toBeInTheDocument();
  });

  it('offers the organization picker as its 36px primary action', async () => {
    renderWithProviders(<SuspendedPage />);
    const action = await screen.findByTestId('suspended-switch-organization');
    expect(action.tagName).toBe('A');
    expect(action).toHaveAttribute('href', '/organization');
    expect(action).toHaveAccessibleName('Switch organization');
    expect(action).toHaveClass('h-9', 'rounded-lg');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<SuspendedPage />);
    await screen.findByTestId('suspended-page');
    expect(await axe(container)).toHaveNoViolations();
  });
});
