import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { listPendingCredits } from '@/shared/api/clinic/credits-api.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PAYMENTS_NS } from '../../../payments.constants.ts';
import {
  creditReason,
  creditSource,
  creditStateLabel,
  isOpenCredit,
} from './pending-cells.ts';
import {
  PendingAmountCell,
  PendingRefCell,
  PendingSinceCell,
  PendingStateCell,
  PendingWayCell,
  PendingWhoCell,
  PendingWhyCell,
} from './PendingCells.tsx';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

const t = i18n.getFixedT('en', PAYMENTS_NS);

let credits: CreditRow[] = [];
/** A seeded credit by its `CR-<seq>`. */
function credit(seq: number): CreditRow {
  const row = credits.find((candidate) => candidate.seq === seq);
  if (!row) throw new Error(`no CR-${seq}`);
  return row;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  credits = [...(await listPendingCredits({})).items];
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the Pending wording (payments.md:45)', () => {
  it('reads the reason chip’s label, else the stored text', () => {
    expect(creditReason({ reasonKey: 'overpaid', reason: 'Overpaid' }, t)).toBe(
      'Overpaid',
    );
    expect(
      creditReason({ reasonKey: 'other', reason: 'Paid for a friend’s session' }, t),
    ).toBe('Paid for a friend’s session');
    expect(creditReason(credit(2), t)).toBe('Charged twice for corn removal');
  });

  it('names where a credit came from: the entry, else its invoice, else by hand', () => {
    expect(creditSource(credit(2), t)).toBe('From PAY-5466 · Paid');
    expect(creditSource({ ...credit(2), source: null, invoiceSeq: 785 }, t)).toBe(
      'Invoice #785',
    );
    expect(creditSource({ ...credit(2), source: null, invoiceSeq: null }, t)).toBe(
      'By hand',
    );
  });

  it('labels the state, "· Today" once settled today, the invoice a credit went on', () => {
    const settled = { settledAt: null, settledInvoiceSeq: null };
    expect(creditStateLabel({ ...settled, status: 'open' }, t)).toBe('Open');
    expect(
      creditStateLabel(
        { ...settled, status: 'given_back', settledAt: '2026-10-03T05:00:00Z' },
        t,
      ),
    ).toBe('Returned · Today');
    expect(
      creditStateLabel(
        { ...settled, status: 'used', settledAt: '2026-09-28T05:00:00Z' },
        t,
      ),
    ).toBe('Adjusted');
    expect(
      creditStateLabel(
        { status: 'used', settledAt: '2026-10-03T05:00:00Z', settledInvoiceSeq: 785 },
        t,
      ),
    ).toBe('Adjusted · Invoice #785');
    expect(isOpenCredit({ status: 'open' })).toBe(true);
    expect(isOpenCredit({ status: 'got_back' })).toBe(false);
  });
});

describe('the Pending cells', () => {
  it('draws a patient’s credit: Ref, Who, Give, the blush amount, Why, Since, State', async () => {
    const tanvi = { ...credit(2), adjusted: 20_000 };
    const { container } = renderWithProviders(
      <div>
        <PendingRefCell seq={tanvi.seq} />
        <PendingWhoCell credit={tanvi} />
        <PendingWayCell credit={tanvi} />
        <PendingAmountCell credit={tanvi} />
        <PendingWhyCell credit={tanvi} />
        <PendingSinceCell credit={tanvi} />
        <PendingStateCell credit={tanvi} />
      </div>,
    );
    expect(await screen.findByText('CR-2')).toBeInTheDocument();
    expect(
      screen.getByText('Tanvi Shah').closest('[data-slot="person-chip"]'),
    ).not.toBeNull();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    const way = screen.getByText('Give').closest('[data-tone]');
    expect(way).toHaveAttribute('data-tone', 'blush');
    expect(way).toHaveAttribute('title', 'We pay them back');
    expect(screen.getByText('₹500')).toHaveClass('text-tone-blush-foreground');
    expect(screen.getByText('₹200 adjusted')).toBeInTheDocument();
    expect(screen.getByText('From PAY-5466 · Paid')).toBeInTheDocument();
    expect(screen.getByText('Jun 10')).toBeInTheDocument();
    expect(screen.getByText('Open').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'sky',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws a party’s Take in sky, and a settled amount muted', async () => {
    renderWithProviders(
      <div>
        <PendingWhoCell credit={credit(1)} />
        <PendingWayCell credit={credit(1)} />
        <PendingAmountCell credit={credit(1)} />
        <PendingAmountCell
          credit={{ ...credit(2), status: 'given_back', adjusted: 50_000 }}
        />
      </div>,
    );
    const party = await screen.findByText('Medline Surgicals');
    expect(party.closest('[data-slot="person-chip"]')).toBeNull();
    expect(screen.getByText('Supplier / party')).toBeInTheDocument();
    expect(screen.getByText('Take').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'sky',
    );
    expect(screen.getByText('₹800')).toHaveClass('text-tone-sky-foreground');
    expect(screen.getByText('₹500')).toHaveClass('text-muted-foreground');
    expect(screen.queryByText(/adjusted/)).toBeNull();
  });
});
