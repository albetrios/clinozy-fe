import { renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { creditRow } from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PAYMENTS_NS } from '../../../payments.constants.ts';
import {
  creditReason,
  creditSource,
  creditStateLabel,
  isChangeableCredit,
  isOpenCredit,
  useCreditLockLabel,
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

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');

const t = i18n.getFixedT('en', PAYMENTS_NS);

/** CR-1: give Kavya ₹80, ₹50 settled, for invoice #5. */
const KAVYA = creditRow();

/** CR-7: take ₹800 from a supplier named by hand. */
const SUPPLIER = creditRow({
  seq: 7,
  direction: 'take',
  contactId: null,
  contact: null,
  patientId: null,
  partyName: 'Medline Surgicals',
  amount: 800,
  settled: 0,
  left: 800,
  reason: 'damaged_goods',
  reasonKey: 'damaged_goods',
  invoiceId: null,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('the Pending wording (payments.md:45)', () => {
  it('reads the reason chip’s label, else the stored text', () => {
    expect(creditReason({ reasonKey: 'overpaid', reason: 'overpaid' }, t)).toBe(
      'Overpaid',
    );
    expect(
      creditReason({ reasonKey: 'other', reason: 'Paid for a friend’s session' }, t),
    ).toBe('Paid for a friend’s session');
  });

  it('names where a credit came from — an entry, else an invoice, else by hand (ids, no numbers)', () => {
    expect(creditSource({ sourcePaymentId: 'pay_x', invoiceId: 'invc_y' }, t)).toBe(
      t('pending.fromEntry'),
    );
    expect(creditSource({ sourcePaymentId: null, invoiceId: 'invc_y' }, t)).toBe(
      t('pending.forInvoice'),
    );
    expect(creditSource({ sourcePaymentId: null, invoiceId: null }, t)).toBe('By hand');
  });

  it('labels the state, "· Today" once settled today', () => {
    expect(creditStateLabel({ status: 'open', settledAt: null }, t)).toBe('Open');
    expect(
      creditStateLabel({ status: 'given_back', settledAt: '2026-10-10T05:00:00Z' }, t),
    ).toBe('Returned · Today');
    expect(
      creditStateLabel({ status: 'used', settledAt: '2026-09-28T05:00:00Z' }, t),
    ).toBe('Adjusted');
  });

  it('keeps a credit changeable only while it is open and nothing of it is settled', () => {
    expect(isOpenCredit({ status: 'open' })).toBe(true);
    expect(isOpenCredit({ status: 'got_back' })).toBe(false);
    expect(isChangeableCredit({ status: 'open', settled: 0 })).toBe(true);
    expect(isChangeableCredit({ status: 'open', settled: 50 })).toBe(false);
    expect(isChangeableCredit({ status: 'used', settled: 80 })).toBe(false);
  });

  it('says why a credit no longer changes: settled in full, or in part', () => {
    const { result } = renderHook(() => useCreditLockLabel());
    expect(result.current({ seq: 1, status: 'open', settled: 0 })).toBeNull();
    expect(result.current({ seq: 1, status: 'got_back', settled: 80 })).toBe(
      'CR-1 · Received',
    );
    expect(result.current({ seq: 1, status: 'open', settled: 50 })).toBe(
      t('pending.settledLocked', { ref: 'CR-1', amount: '₹50' }),
    );
  });
});

describe('the Pending cells', () => {
  it('draws a patient’s credit: Ref, Who, Give, the blush amount and what is settled, Why, Since, State', async () => {
    const { container } = renderWithProviders(
      <div>
        <PendingRefCell seq={KAVYA.seq} />
        <PendingWhoCell credit={KAVYA} />
        <PendingWayCell credit={KAVYA} />
        <PendingAmountCell credit={KAVYA} />
        <PendingWhyCell credit={KAVYA} />
        <PendingSinceCell credit={KAVYA} />
        <PendingStateCell credit={KAVYA} />
      </div>,
    );
    expect(await screen.findByText('CR-1')).toBeInTheDocument();
    expect(
      screen.getByText('Kavya Mehta').closest('[data-slot="person-chip"]'),
    ).not.toBeNull();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    const way = screen.getByText('Give').closest('[data-tone]');
    expect(way).toHaveAttribute('data-tone', 'blush');
    expect(way).toHaveAttribute('title', 'We pay them back');
    expect(screen.getByText('₹80')).toHaveClass('text-tone-blush-foreground');
    expect(screen.getByText('₹50 adjusted')).toBeInTheDocument();
    expect(screen.getByText('Overpaid')).toBeInTheDocument();
    expect(screen.getByText(t('pending.forInvoice'))).toBeInTheDocument();
    expect(screen.getByText('Oct 10')).toBeInTheDocument();
    expect(screen.getByText('Open').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'sky',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws a party’s Take in sky, rupees with paise, and a settled amount muted', async () => {
    renderWithProviders(
      <div>
        <PendingWhoCell credit={SUPPLIER} />
        <PendingWayCell credit={SUPPLIER} />
        <PendingAmountCell credit={{ ...SUPPLIER, amount: 1_250.5 }} />
        <PendingAmountCell credit={{ ...KAVYA, status: 'given_back', settled: 80 }} />
      </div>,
    );
    const party = await screen.findByText('Medline Surgicals');
    expect(party.closest('[data-slot="person-chip"]')).toBeNull();
    expect(screen.getByText('Supplier / party')).toBeInTheDocument();
    expect(screen.getByText('Take').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'sky',
    );
    expect(screen.getByText('₹1,250.50')).toHaveClass('text-tone-sky-foreground');
    expect(screen.getByText('₹80')).toHaveClass('text-muted-foreground');
    expect(screen.queryByText(/adjusted/)).toBeNull();
  });
});
