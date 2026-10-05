import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ClinicHomeEmpty } from './ClinicHomeEmpty.tsx';

describe('ClinicHomeEmpty', () => {
  it('says nothing is switched on, in the clinic empty-state look', async () => {
    renderWithProviders(<ClinicHomeEmpty />);

    expect(
      await screen.findByRole('heading', { name: 'Nothing is switched on here yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your clinic's sections appear here as soon as they're switched on for you.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toHaveAttribute('data-tone', 'stone');
  });

  it('offers nothing to press — it is a state, never a way off the page', async () => {
    renderWithProviders(<ClinicHomeEmpty />);

    await screen.findByTestId('clinic-home-empty');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<ClinicHomeEmpty />);
    await screen.findByTestId('clinic-home-empty');
    expect(await axe(container)).toHaveNoViolations();
  });
});
