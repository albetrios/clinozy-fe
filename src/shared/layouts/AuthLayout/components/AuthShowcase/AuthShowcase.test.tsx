import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { JOURNEY_STOPS } from './auth-showcase.constants.ts';
import {
  AuthShowcaseBoard,
  AuthShowcaseCanvas,
  AuthShowcaseHero,
  AuthShowcasePrivacy,
} from './AuthShowcase.tsx';

describe('AuthShowcase', () => {
  it('says who the product is for, the promise, and what it replaces', async () => {
    const { findByTestId } = renderWithProviders(<AuthShowcaseHero />);
    const hero = await findByTestId('auth-showcase-hero');
    expect(
      within(hero).getByText('For skin, hair & aesthetic clinics'),
    ).toBeInTheDocument();
    expect(within(hero).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Your whole clinic, calm in one place.',
    );
    expect(hero).toHaveTextContent(
      /no more WhatsApp threads, paper registers or spreadsheets/,
    );
    // The section is named by its own headline.
    expect(within(hero.parentElement ?? hero).getByRole('region')).toBe(hero);
  });

  it('walks one patient through the seven rooms, each stop in its room’s tone', async () => {
    const { findByRole } = renderWithProviders(<AuthShowcaseBoard />);
    const journey = await findByRole('list', {
      name: `A patient’s journey through ${PRODUCT_NAME}`,
    });
    const stops = within(journey).getAllByRole('listitem');
    expect(stops.map((stop) => stop.textContent)).toEqual([
      'Enquiry',
      'Booked',
      'Waiting',
      'With doctor',
      'Treatment',
      'Checkout',
      'Follow-up',
    ]);
    stops.forEach((stop, index) => {
      const pill = stop.querySelector('[data-slot="pill"]');
      expect(pill).toHaveAttribute('data-tone', JOURNEY_STOPS[index]?.tone);
      // The wave lights them in turn — and stands still under reduced motion.
      expect(pill).toHaveClass('animate-journey-wave', 'motion-reduce:animate-none');
      expect(pill).toHaveClass(JOURNEY_STOPS[index]?.delay ?? '');
    });
  });

  it('shows three anonymous moments and three reasons, with no numbers or names', async () => {
    const { findByRole, getByRole } = renderWithProviders(<AuthShowcaseBoard />);
    const moments = await findByRole('list', { name: 'Moments from a clinic day' });
    expect(within(moments).getAllByRole('listitem')).toHaveLength(3);
    for (const moment of within(moments).getAllByRole('listitem')) {
      expect(moment).toHaveClass('animate-drift', 'motion-reduce:animate-none');
    }
    const values = getByRole('list', { name: `Why clinics choose ${PRODUCT_NAME}` });
    expect(
      within(values)
        .getAllByRole('listitem')
        .map((value) => value.querySelector('p')?.textContent),
    ).toEqual(['Every room in step', 'Nothing slips through', 'Calm by design']);
    expect(values.textContent).not.toMatch(/\d/);
  });

  it('draws its washed panel from lg only, as decoration', () => {
    const { container } = render(<AuthShowcaseCanvas />);
    const canvas = container.firstElementChild;
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas).toHaveClass('hidden', 'lg:block');
  });

  it('has no accessibility violations', async () => {
    const { container, findByTestId } = renderWithProviders(
      <main>
        <AuthShowcaseHero />
        <AuthShowcasePrivacy />
        <AuthShowcaseBoard />
      </main>,
    );
    await findByTestId('auth-showcase');
    expect(await axe(container)).toHaveNoViolations();
  });
});
