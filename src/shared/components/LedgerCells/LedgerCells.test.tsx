import { screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { LEDGER_NS } from './ledger-cells.constants.ts';
import {
  editSideLabel,
  ledgerEntryEditable,
  ledgerEntryFixed,
  ledgerEntryLock,
  ledgerEntryReversible,
  ledgerModes,
  ledgerModesLabel,
  ledgerSubLine,
  ledgerWhat,
} from './ledger-cells.ts';
import {
  LedgerAmountCell,
  LedgerByCell,
  LedgerModeCell,
  LedgerPartyCell,
  LedgerRefCell,
  LedgerWhatCell,
  LedgerWhenCell,
} from './LedgerCells.tsx';

/** 10:30 on 10 Oct, clinic time — PAY-5 was received at 10:19 today. */
const NOW = new Date('2026-10-10T05:00:00Z');

const t = i18n.getFixedT('en', LEDGER_NS);
const tClinic = i18n.getFixedT('en', CLINIC_NS);
const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

/** A translator that answers each key with its options — for the words not in the locales yet. */
const keyT = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}${JSON.stringify(options)}` : key) as unknown as TFunction;

/** Tea & snacks, ₹260 in cash — an expense. */
const tea = ledgerRow({
  id: 'pay_7tq2m4x8v1b5n9c3z6kwa',
  seq: 310,
  direction: 'paid',
  kind: 'expense',
  amount: 260,
  splits: [{ mode: 'cash', amount: 260 }],
  contactId: null,
  contact: null,
  partyName: 'Tea & snacks',
  patientId: null,
  invoiceId: null,
  invoice: null,
  payeeName: 'Tea & snacks',
  expenseCategory: 'misc',
  reference: null,
  note: null,
  editCount: 0,
  lastEdit: null,
});

/** Medline Surgicals, consumables with a note. */
const gloves = ledgerRow({
  ...tea,
  seq: 311,
  partyName: 'Medline Surgicals',
  payeeName: 'Medline Surgicals',
  expenseCategory: 'consumables',
  note: 'Gloves, gauze, alcohol swabs',
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('the ledger’s wording (payments.md:29)', () => {
  it('names What by the direction, painted by the kind — a reversal by its own name', () => {
    expect(ledgerWhat({ direction: 'received', kind: 'receipt' })).toEqual({
      labelKey: 'directions.received',
      tone: 'sage',
    });
    expect(ledgerWhat({ direction: 'paid', kind: 'refund' }).tone).toBe('blush');
    expect(ledgerWhat({ direction: 'paid', kind: 'supplier_bill' }).tone).toBe('butter');
    expect(ledgerWhat({ direction: 'received', kind: 'money_back' }).tone).toBe('stone');
    expect(ledgerWhat({ direction: 'received', kind: 'reversal' })).toEqual({
      labelKey: 'kinds.reversal',
      tone: 'stone',
    });
  });

  it('reads each mode of a split once, joined "Cash + UPI"', () => {
    const modes = ledgerModes({
      splits: [
        { mode: 'cash', amount: 500 },
        { mode: 'upi', amount: 300 },
        { mode: 'cash', amount: 100 },
      ],
    });
    expect(modes).toEqual(['cash', 'upi']);
    expect(ledgerModesLabel(modes, tClinic)).toBe('Cash + UPI');
  });

  it('words the From / to sub line for every kind', () => {
    const sub = (row: LedgerRow) => ledgerSubLine(row, t, tClinic, displayId.creditNote);
    // A receipt names its invoice, its note kept off the line; a sale's says so.
    expect(sub(ledgerRow())).toBe('Invoice #5');
    expect(
      sub(
        ledgerRow({
          invoice: { seq: 785, number: '2026-27/0785', type: 'medical', due: 0 },
        }),
      ),
    ).toBe('Sale · Invoice #785');
    // A credit used on a bill is a receipt from that credit.
    expect(sub(ledgerRow({ pendingCreditSeq: 1 }))).toBe('Invoice #5 · From CR-1');
    // An expense: its category, then the note.
    expect(sub(gloves)).toBe('Consumables · Gloves, gauze, alcohol swabs');
    // A refund, with and without its credit note, and the invoice it was for.
    const refund = {
      ...tea,
      kind: 'refund' as const,
      invoice: null,
      note: 'Charged twice',
    };
    expect(sub(refund)).toBe('Refund · Credit note · Charged twice');
    expect(
      sub({
        ...refund,
        creditNoteSeq: 100,
        invoice: { seq: 760, number: '2026-27/0760', type: 'clinic', due: 0 },
        note: null,
      }),
    ).toBe('Refund · Credit note CN-100 · for Invoice #760');
    // A supplier bill names its PO and the supplier's bill number.
    const bill = { ...tea, kind: 'supplier_bill' as const, expenseCategory: null };
    expect(
      sub({
        ...bill,
        bill: {
          kind: 'medical_po',
          purchaseId: 'mpo_7x2k9q4m1v8n3b6c5z0wa',
          seq: 431,
          billNo: '1631',
        },
      }),
    ).toBe('Medical PO #431 · bill 1631');
    expect(
      sub({
        ...bill,
        bill: {
          kind: 'stock_po',
          purchaseId: 'spur_4n8b2v6c1x9z3m7k5q0wa',
          seq: 16,
          billNo: 'MS-88',
        },
      }),
    ).toBe('Stock PO #16 · bill MS-88');
    // Money back from a pending credit.
    expect(
      sub({
        ...tea,
        kind: 'money_back',
        direction: 'received',
        pendingCreditSeq: 1,
        note: 'Gloves returned',
      }),
    ).toBe('Money back · From CR-1 · Gloves returned');
  });

  it('words a bill without its number, a reversal and an entry a reversal undid', () => {
    const sub = (row: LedgerRow) =>
      ledgerSubLine(row, keyT, tClinic, displayId.creditNote);
    expect(
      sub({
        ...tea,
        kind: 'supplier_bill',
        expenseCategory: null,
        bill: { kind: 'stock_po', purchaseId: 'spur_x', seq: 2, billNo: null },
      }),
    ).toBe('ledger.sub.stockPurchase{"seq":2}');
    // A reversal names what its entry named, then its reason (its note).
    expect(
      sub(
        ledgerRow({
          kind: 'reversal',
          direction: 'paid',
          note: 'Wrong amount',
          reversesPaymentId: 'pay_ibrjx0eihnsrd89obek68',
        }),
      ),
    ).toBe('ledger.sub.invoice{"seq":5} · Wrong amount');
    expect(sub({ ...gloves, reversedByPaymentId: 'pay_4xxwn45a73pygol64wr2b' })).toBe(
      'Consumables · Gloves, gauze, alcohol swabs · ledger.sub.reversed',
    );
  });

  it('says why an entry can’t change: the credit it settled, else its closed day', () => {
    const entry = ledgerRow();
    expect(ledgerEntryLock(entry, t)).toBeNull();
    expect(ledgerEntryLock({ ...entry, isSettled: true, editCount: 0 }, t)).toBe(
      'PAY-5 · Day closed',
    );
    expect(ledgerEntryLock({ ...entry, isSettled: true, editCount: 2 }, t)).toBe(
      'PAY-5 · Day closed · edited 2×',
    );
    expect(ledgerEntryLock({ ...entry, pendingCreditSeq: 2 }, t)).toBe(
      'PAY-5 · From CR-2',
    );
  });

  it('opens what Receive and Send record; a refund’s or a reversal’s money is fixed', () => {
    expect(ledgerEntryEditable({ kind: 'receipt' })).toBe(true);
    expect(ledgerEntryEditable({ kind: 'expense' })).toBe(true);
    expect(ledgerEntryEditable({ kind: 'supplier_bill' })).toBe(true);
    expect(ledgerEntryEditable({ kind: 'refund' })).toBe(false);
    expect(ledgerEntryEditable({ kind: 'reversal' })).toBe(false);
    expect(ledgerEntryFixed({ seq: 9 }, keyT)).toBe('ledger.fixedEntry{"ref":"PAY-9"}');
  });

  it('reverses a closed day’s entry once, and never a reversal', () => {
    const settled = {
      isSettled: true,
      kind: 'expense' as const,
      reversedByPaymentId: null,
    };
    expect(ledgerEntryReversible(settled)).toBe(true);
    expect(ledgerEntryReversible({ ...settled, isSettled: false })).toBe(false);
    expect(ledgerEntryReversible({ ...settled, kind: 'reversal' })).toBe(false);
    expect(
      ledgerEntryReversible({
        ...settled,
        reversedByPaymentId: 'pay_4xxwn45a73pygol64wr2b',
      }),
    ).toBe(false);
  });

  it('words one side of a logged edit: "₹600 UPI"', () => {
    expect(editSideLabel({ amount: 600, modes: ['upi'] }, t, tClinic, rupees)).toBe(
      '₹600 UPI',
    );
  });
});

describe('the ledger’s cells', () => {
  it('draws Ref, What, Mode, Amount and By for an entry', async () => {
    const { container } = renderWithProviders(
      <div>
        <LedgerRefCell seq={tea.seq} />
        <LedgerWhatCell row={tea} />
        <LedgerModeCell
          row={{
            splits: [
              { mode: 'cash', amount: 200 },
              { mode: 'upi', amount: 60 },
            ],
          }}
        />
        <LedgerAmountCell row={tea} />
        <LedgerAmountCell row={ledgerRow()} />
        <LedgerByCell row={tea} />
        <LedgerByCell row={{ by: null }} />
      </div>,
    );
    expect(await screen.findByText('PAY-310')).toBeInTheDocument();
    expect(screen.getByText('Paid').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'butter',
    );
    expect(screen.getByText('Cash + UPI').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'butter',
    );
    // Rupees, as the API sends them.
    expect(screen.getByText('− ₹260')).toHaveClass('text-tone-blush-foreground');
    expect(screen.getByText('+ ₹150')).toHaveClass('text-tone-sage-foreground');
    expect(screen.getByText('Nisha Shah')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads When by the rooms’ one time rule — the edit under it, in rupees', async () => {
    renderWithProviders(
      <div>
        <LedgerWhenCell row={ledgerRow()} />
        <LedgerWhenCell row={{ ...tea, paidAt: '2026-10-09T06:25:00Z' }} />
      </div>,
    );
    // The viewer's locale and hour cycle: en's default reads "Today 10:19 AM".
    // The rule's time is an isolated token beside its day word.
    expect(await screen.findByText(`Today ${fsi('10:19 AM')}`)).toBeInTheDocument();
    expect(screen.getByText(`Yesterday ${fsi('11:55 AM')}`)).toBeInTheDocument();
    expect(screen.getByText('Edited 1× · last ₹100 Cash → ₹150 Cash + UPI')).toHaveClass(
      'text-tone-butter-foreground',
    );
  });

  it('shows a patient as the person chip, a payee as text — each over its sub line', async () => {
    renderWithProviders(
      <div>
        <LedgerPartyCell row={ledgerRow()} />
        <LedgerPartyCell row={gloves} />
      </div>,
    );
    const kavya = await screen.findByText('Kavya Mehta');
    expect(kavya.closest('[data-slot="person-chip"]')).not.toBeNull();
    expect(screen.getByText('Invoice #5')).toBeInTheDocument();
    const payee = screen.getByText('Medline Surgicals');
    expect(payee.closest('[data-slot="person-chip"]')).toBeNull();
    expect(screen.getByText('Consumables · Gloves, gauze, alcohol swabs')).toHaveClass(
      'text-muted-foreground',
    );
  });
});
