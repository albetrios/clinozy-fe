import { render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import type { EffectivePrice } from '@/shared/api/clinic/offerings-pricing.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import type { OfferingRow } from '../../offerings.rows.ts';
import {
  OfferingCategoryPill,
  OfferingDurationCell,
  OfferingNameCell,
  OfferingOfferCell,
  OfferingPriceCell,
  OfferingSessionsCell,
  OfferingStatusPill,
} from './OfferingCells.tsx';
import { useOfferingText } from './use-offering-text.ts';

const OFFER = {
  id: 'o1',
  name: 'Navratri glow',
  tone: 'blush',
  kind: 'percent',
  value: 20,
} as unknown as OfferRecord;

const priced = (overrides: Partial<EffectivePrice<OfferRecord>> = {}) =>
  ({
    list: 150_000,
    base: 120_000,
    final: 115_000,
    percentOff: 23,
    priceOffer: OFFER,
    extraOffer: null,
    extraSessions: 0,
    winningOffer: OFFER,
    ...overrides,
  }) satisfies EffectivePrice<OfferRecord>;

const row = (overrides: Partial<OfferingRow> = {}) =>
  ({
    name: 'B1G1 D-Tan Facial',
    description: null,
    validityDays: 60,
    sessions: 2,
    priced: priced(),
    ...overrides,
  }) as OfferingRow;

beforeEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-IN' });
});
afterEach(() => {
  useLocaleStore.setState({ formatLocale: 'en-US' });
});

describe('the Offerings cells (offerings.md:31)', () => {
  it('names an offering over its description, else its validity', () => {
    const { unmount } = render(<OfferingNameCell row={row()} />);
    expect(screen.getByText('B1G1 D-Tan Facial')).toBeInTheDocument();
    expect(screen.getByText('Valid 60 days')).toBeInTheDocument();
    unmount();
    render(<OfferingNameCell row={row({ description: 'Face and neck' })} />);
    expect(screen.getByText('Face and neck')).toBeInTheDocument();
  });

  it('shows the billed price over "was … · N% off" in sage, or "list price"', () => {
    const { unmount } = render(<OfferingPriceCell priced={priced()} />);
    expect(screen.getByText('₹1,150')).toBeInTheDocument();
    expect(screen.getByText('was ₹1,500 · 23% off')).toHaveClass(
      'text-tone-sage-foreground',
    );
    unmount();
    render(
      <OfferingPriceCell
        priced={priced({
          final: 150_000,
          base: 150_000,
          percentOff: 0,
          winningOffer: null,
        })}
      />,
    );
    expect(screen.getByText('list price')).toHaveClass('text-muted-foreground');
  });

  it('pills the category, the winning offer (its value the tooltip) and the status', async () => {
    const { container } = render(
      <>
        <OfferingCategoryPill category="package" />
        <OfferingOfferCell offer={OFFER} />
        <OfferingStatusPill active />
        <OfferingStatusPill active={false} />
      </>,
    );
    expect(screen.getByText('Package').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'lav',
    );
    expect(
      screen.getByText('Navratri glow').closest('[data-slot="pill"]'),
    ).toHaveAttribute('title', '20% off');
    expect(screen.getByText('Active').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'sage',
    );
    expect(screen.getByText('Inactive').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders no Offer pill without a winning offer', () => {
    const { container } = render(<OfferingOfferCell offer={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reads the duration and the sessions, free ones included', () => {
    render(
      <>
        <OfferingDurationCell minutes={45} />
        <OfferingDurationCell minutes={0} />
        <OfferingSessionsCell
          row={row({
            sessions: 6,
            validityDays: 180,
            priced: priced({ extraSessions: 1 }),
          })}
        />
      </>,
    );
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('—')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('6 sessions + 1 free')).toBeInTheDocument();
    expect(screen.getByText('valid 180 days')).toBeInTheDocument();
  });
});

describe('useOfferingText', () => {
  it('words one session, no validity and a category', () => {
    const { result } = renderHook(() => useOfferingText());
    expect(result.current.sessions(1, 0)).toBe('1 session');
    expect(result.current.sessions(0, 2)).toBe('1 session + 2 free');
    expect(result.current.validFor(0)).toBe('');
    expect(result.current.sub({ description: null, validityDays: 0 })).toBe('');
    expect(result.current.category('lhr')).toBe('LHR');
  });
});
