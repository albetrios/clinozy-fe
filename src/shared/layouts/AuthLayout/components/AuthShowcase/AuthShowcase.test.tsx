import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { JOURNEY_STOPS, SHOWCASE_MOMENTS } from './auth-showcase.constants.ts';
import {
  AuthShowcaseBackdrop,
  AuthShowcaseDial,
  AuthShowcaseHero,
  AuthShowcasePrivacy,
  AuthShowcaseValues,
} from './AuthShowcase.tsx';

/** The dial's own stylesheet — it loads with the lazy chunk, not with `index.css`. */
const CSS = readFileSync(
  join(
    process.cwd(),
    'src/shared/layouts/AuthLayout/components/AuthShowcase/auth-showcase.css',
  ),
  'utf8',
);

/** A rule's body: everything between `selector {` and its closing brace. */
function ruleBody(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf('}', start));
}

/** A keyframe block, from its name to the next `@keyframes`. */
function keyframes(name: string): string {
  const start = CSS.indexOf(`@keyframes ${name} `);
  expect(start, name).toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf('@keyframes', start + 1));
}

/** The `--stop` a rule gives, or NaN. */
function stopIndexOf(body: string): number {
  const match = /--stop:\s*(\d+);/.exec(body);
  return match ? Number(match[1]) : Number.NaN;
}

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

  it('draws one patient’s journey as a dial: seven stops, each in its room’s tone', async () => {
    const { findByRole } = renderWithProviders(<AuthShowcaseDial />);
    const journey = await findByRole('list', {
      name: `A patient’s journey through ${PRODUCT_NAME}`,
    });
    const stops = within(journey).getAllByRole('listitem');
    // Every stop is named on the dial — the centre label is decoration on top.
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
      expect(stop).toHaveAttribute('data-stop', JOURNEY_STOPS[index]?.id);
      expect(stop).toHaveClass('auth-dial-stop');
      const pill = stop.querySelector('[data-slot="pill"]');
      expect(pill).toHaveAttribute('data-tone', JOURNEY_STOPS[index]?.tone);
      // It lifts as the thread arrives (`auth-dial-node`).
      expect(pill).toHaveClass('auth-dial-node');
    });
  });

  it('keeps the dial in step: each stop starts a seventh of a turn after the last', () => {
    // The CSS places and times each stop by its index in JOURNEY_STOPS.
    JOURNEY_STOPS.forEach((stop, index) => {
      expect(stopIndexOf(ruleBody(`.auth-dial [data-stop='${stop.id}']`))).toBe(index);
    });
    // A stop is a seventh of a turn: 15.4s round, 2.2s a stop.
    const dial = ruleBody('.auth-dial');
    expect(dial).toContain('--dial-turn: 15400ms;');
    expect(dial).toContain(`--dial-step: ${15_400 / JOURNEY_STOPS.length}ms;`);
    // Every synced motion starts `--stop` steps in.
    for (const selector of [
      '.auth-dial-node',
      '.auth-dial-halo',
      '.auth-dial-now > *',
      '.auth-moment',
      '.auth-moment::after',
    ]) {
      expect(ruleBody(selector), selector).toContain(
        'animation-delay: calc(var(--stop) * var(--dial-step));',
      );
    }
    // The thread holds on each stop: seven holds, 360° / 7 apart.
    const holds = [
      ...keyframes('auth-dial-thread').matchAll(/rotate\(([\d.]+)deg\)/g),
    ].map((match) => Number(match[1]));
    expect(holds).toHaveLength(8);
    holds.forEach((degrees, index) => {
      expect(degrees).toBeCloseTo((360 / JOURNEY_STOPS.length) * index, 2);
    });
  });

  it('never dims a stop: its lift is scale only, its label always full strength', () => {
    // The stops' labels are text (12–13px). The launch's wave dimmed them, and
    // dimming text costs WCAG AA contrast; the dial lifts a stop instead.
    expect(keyframes('auth-dial-lift-stop')).not.toMatch(/opacity/);
    expect(ruleBody('.auth-dial-label')).not.toMatch(/opacity/);
  });

  it('lifts each moment as the thread reaches its stop', async () => {
    const { findByRole } = renderWithProviders(<AuthShowcaseDial />);
    const moments = await findByRole('list', { name: 'Moments from a clinic day' });
    const items = within(moments).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    for (const moment of SHOWCASE_MOMENTS) {
      // Each card takes its stop's place in the turn.
      const stopIndex = JOURNEY_STOPS.findIndex((stop) => stop.id === moment.stop);
      expect(stopIndexOf(ruleBody(`.auth-moments [data-moment='${moment.id}']`))).toBe(
        stopIndex,
      );
    }
    for (const item of items) {
      expect(item.querySelector('[data-slot="card"]')).toHaveClass('auth-moment');
    }
    // No numbers or names: anonymous moments (D11) — "Tuesday" is not a number.
    expect(moments.textContent).not.toMatch(/\d/);
  });

  it('names three reasons, with no numbers or names', async () => {
    const { findByRole } = renderWithProviders(<AuthShowcaseValues />);
    const values = await findByRole('list', {
      name: `Why clinics choose ${PRODUCT_NAME}`,
    });
    expect(
      within(values)
        .getAllByRole('listitem')
        .map((value) => value.querySelector('p')?.textContent),
    ).toEqual(['Every room in step', 'Nothing slips through', 'Calm by design']);
    expect(values.textContent).not.toMatch(/\d/);
  });

  it('paints its backdrop as decoration only', () => {
    const { container } = render(<AuthShowcaseBackdrop />);
    const backdrop = container.firstElementChild;
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveClass('auth-backdrop', 'pointer-events-none', '-z-10');
  });

  it('stands the dial still under reduced motion, every stop still named', () => {
    const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.auth-dial \*[\s\S]*animation: none;/);
    expect(reduced).toMatch(
      /\.auth-dial-thread,\s*\.auth-dial-halo,\s*\.auth-dial-now \{\s*display: none;/,
    );
  });

  it('has no accessibility violations', async () => {
    const { container, findByTestId } = renderWithProviders(
      <main>
        <AuthShowcaseHero />
        <AuthShowcasePrivacy />
        <AuthShowcaseDial />
        <AuthShowcaseValues />
      </main>,
    );
    await findByTestId('auth-showcase');
    expect(await axe(container)).toHaveNoViolations();
  });
});
