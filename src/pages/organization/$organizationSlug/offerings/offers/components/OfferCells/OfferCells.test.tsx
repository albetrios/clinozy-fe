import { render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import type { OfferRow } from '../../offers.rows.ts';
import {
  OfferAppliesCell,
  OfferNameCell,
  OfferStatePill,
  OfferTypeCell,
  OfferValidCell,
} from './OfferCells.tsx';
import { useOfferText } from './use-offer-text.ts';

const TODAY = '2026-10-04';
const NAMES: Record<string, string> = {
  a: 'B1G1 D-Tan Facial',
  b: 'Back Peeling',
  c: 'Underarm Peel',
};
const nameOf = (id: string) => NAMES[id];

const offer = (overrides: Partial<OfferRow> = {}) =>
  ({
    name: 'Navratri glow',
    code: 'GLOW20',
    tone: 'blush',
    kind: 'percent',
    value: 20,
    offeringIds: ['a', 'b', 'c'],
    note: 'Festival offer on peels and facials',
    startsOn: '2026-09-29',
    endsOn: '2026-10-09',
    status: 'live',
    ...overrides,
  }) as OfferRow;

beforeEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-IN' });
});
afterEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-US' });
});

describe('the Offers cells (offerings.md:47)', () => {
  it('pills the offer in its tone, then its code in grey', async () => {
    const { container } = render(<OfferNameCell offer={offer()} />);
    expect(
      screen.getByText('Navratri glow').closest('[data-slot="pill"]'),
    ).toHaveAttribute('data-tone', 'blush');
    expect(screen.getByText('GLOW20').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows no code pill without a code', () => {
    render(<OfferNameCell offer={offer({ code: null })} />);
    expect(screen.queryByText('GLOW20')).not.toBeInTheDocument();
  });

  it('words each kind’s value over the kind — amounts in rupees, as the API sends them', () => {
    render(
      <>
        <OfferTypeCell offer={{ kind: 'percent', value: 20 }} />
        <OfferTypeCell offer={{ kind: 'amount', value: 100.5 }} />
        <OfferTypeCell offer={{ kind: 'fixed', value: 3999 }} />
        <OfferTypeCell offer={{ kind: 'extra', value: 2 }} />
      </>,
    );
    for (const text of [
      '20% off',
      '% off',
      '₹100.50 off',
      '₹ off',
      'at ₹3,999',
      'Fixed price',
      '+2 sessions',
      'Extra sessions',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('names two offerings and counts the rest, over the note', () => {
    render(<OfferAppliesCell offer={offer()} nameOf={nameOf} />);
    expect(screen.getByText('B1G1 D-Tan Facial, Back Peeling +1')).toBeInTheDocument();
    expect(screen.getByText('Festival offer on peels and facials')).toBeInTheDocument();
  });

  it('says so when no offering is left (OFFERINGS-M4)', () => {
    render(<OfferAppliesCell offer={offer({ offeringIds: [] })} nameOf={nameOf} />);
    expect(screen.getByText('No offerings')).toBeInTheDocument();
  });

  it('reads the dates and what they mean today', () => {
    render(<OfferValidCell row={offer()} today={TODAY} />);
    expect(screen.getByText('29 Sept 2026 – 9 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Ends in 5 days')).toBeInTheDocument();
  });

  it('pills the server’s status in its tone with a dot', () => {
    render(<OfferStatePill status="paused" />);
    expect(screen.getByText('Paused').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'butter',
    );
  });
});

describe('useOfferText', () => {
  it('reads open ends and every sub-line by the server’s status', () => {
    const { result } = renderHook(() => useOfferText());
    const text = result.current;
    expect(text.valid({ startsOn: null, endsOn: null })).toBe('Now – no end');
    expect(text.validSub(offer({ endsOn: TODAY }), TODAY)).toBe('Ends today');
    expect(text.validSub(offer({ endsOn: '2026-10-05' }), TODAY)).toBe('Ends tomorrow');
    expect(text.validSub(offer({ endsOn: null }), TODAY)).toBe('');
    expect(
      text.validSub(offer({ startsOn: '2026-11-01', status: 'scheduled' }), TODAY),
    ).toBe('Starts 1 Nov 2026');
    expect(text.validSub(offer({ status: 'ended' }), TODAY)).toBe('Over');
    expect(text.validSub(offer({ status: 'paused' }), TODAY)).toBe('');
  });

  it('leaves out an offering the catalogue no longer holds', () => {
    const { result } = renderHook(() => useOfferText());
    expect(result.current.appliesTo({ offeringIds: ['gone', 'a'] }, nameOf)).toBe(
      'B1G1 D-Tan Facial',
    );
  });
});
