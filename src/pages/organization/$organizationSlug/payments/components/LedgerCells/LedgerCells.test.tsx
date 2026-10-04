import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listLedger } from '@/shared/api/clinic/payments-api.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PAYMENTS_NS } from '../../payments.constants.ts';
import {
  editSideLabel,
  ledgerEntryLock,
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

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

const t = i18n.getFixedT('en', PAYMENTS_NS);
const tClinic = i18n.getFixedT('en', CLINIC_NS);
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

let ledger: LedgerRow[] = [];
/** A seeded entry by its `PAY-<seq>`. */
function entry(seq: number): LedgerRow {
  const row = ledger.find((candidate) => candidate.seq === seq);
  if (!row) throw new Error(`no PAY-${seq}`);
  return row;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  ledger = [...(await listLedger({})).items];
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the ledger’s wording (payments.md:29)', () => {
  it('names What by the direction, painted by the kind', () => {
    expect(ledgerWhat({ direction: 'received', kind: 'receipt' })).toEqual({
      labelKey: 'directions.received',
      tone: 'sage',
    });
    expect(ledgerWhat({ direction: 'paid', kind: 'refund' }).tone).toBe('blush');
    expect(ledgerWhat({ direction: 'paid', kind: 'supplier_bill' }).tone).toBe('butter');
    expect(ledgerWhat({ direction: 'received', kind: 'money_back' }).tone).toBe('stone');
  });

  it('reads each mode of a split once, joined "Cash + UPI"', () => {
    const modes = ledgerModes({
      splits: [
        { mode: 'cash', amount: 50_000 },
        { mode: 'upi', amount: 30_000 },
        { mode: 'cash', amount: 10_000 },
      ],
    });
    expect(modes).toEqual(['cash', 'upi']);
    expect(ledgerModesLabel(modes, tClinic)).toBe('Cash + UPI');
  });

  it('words the From / to sub line for every kind', () => {
    const sub = (row: LedgerRow) => ledgerSubLine(row, t, tClinic, displayId.creditNote);
    // A sale's receipt, its note kept off the line.
    expect(sub({ ...entry(5512), note: 'Paid at the counter' })).toBe(
      'Sale · Invoice #785',
    );
    expect(sub(entry(5509))).toBe('Invoice #781');
    // An expense: its category, then the note.
    expect(sub(entry(311))).toBe('Consumables · Gloves, gauze, alcohol swabs');
    // A refund, with and without its credit note, and the invoice it was for.
    expect(sub(entry(5466))).toBe('Refund · Credit note · Charged twice');
    expect(
      sub({
        ...entry(5466),
        creditNoteSeq: 100,
        invoice: { seq: 760, type: 'clinic', due: 0 },
        note: null,
      }),
    ).toBe('Refund · Credit note CN-100 · for Invoice #760');
    // A supplier bill names its PO and bill number.
    expect(
      sub({
        ...entry(309),
        kind: 'supplier_bill',
        bill: { kind: 'medical_po', seq: 431, billNo: '1631' },
        note: null,
      }),
    ).toBe('Medical PO #431 · bill 1631');
    expect(
      sub({
        ...entry(309),
        kind: 'supplier_bill',
        bill: { kind: 'stock_po', seq: 16, billNo: 'MS-88' },
        note: null,
      }),
    ).toBe('Stock PO #16 · bill MS-88');
    // Money back from a pending credit.
    expect(
      sub({
        ...entry(310),
        kind: 'money_back',
        direction: 'received',
        pendingCreditSeq: 1,
        note: 'Gloves returned',
      }),
    ).toBe('Money back · From CR-1 · Gloves returned');
  });

  it('says why an entry can’t change: the credit it settled, else its closed day', () => {
    expect(ledgerEntryLock(entry(310), t)).toBeNull();
    expect(ledgerEntryLock(entry(305), t)).toBe('PAY-305 · Day closed');
    const edit = {
      at: NOW.toISOString(),
      byId: null,
      from: { amount: 1, modes: ['cash' as const] },
      to: { amount: 2, modes: ['cash' as const] },
    };
    expect(ledgerEntryLock({ ...entry(305), edits: [edit, edit] }, t)).toBe(
      'PAY-305 · Day closed · edited 2×',
    );
    expect(ledgerEntryLock({ ...entry(310), pendingCreditSeq: 2 }, t)).toBe(
      'PAY-310 · From CR-2',
    );
  });

  it('words one side of a logged edit: "₹600 UPI"', () => {
    expect(editSideLabel({ amount: 60_000, modes: ['upi'] }, t, tClinic, rupees)).toBe(
      '₹600 UPI',
    );
  });
});

describe('the ledger’s cells', () => {
  it('draws Ref, What, Mode, Amount and By for an entry', async () => {
    const tea = entry(310);
    const { container } = renderWithProviders(
      <div>
        <LedgerRefCell seq={tea.seq} />
        <LedgerWhatCell row={tea} />
        <LedgerModeCell
          row={{
            splits: [
              { mode: 'cash', amount: 20_000 },
              { mode: 'upi', amount: 6_000 },
            ],
          }}
        />
        <LedgerAmountCell row={tea} />
        <LedgerAmountCell row={entry(5512)} />
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
    expect(screen.getByText('− ₹260')).toHaveClass('text-tone-blush-foreground');
    expect(screen.getByText('+ ₹600')).toHaveClass('text-tone-sage-foreground');
    expect(screen.getByText('Riya Shah')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads When as "Today 11:05", an earlier day by its date, the edit under it', async () => {
    renderWithProviders(
      <div>
        <LedgerWhenCell row={entry(310)} />
        <LedgerWhenCell
          row={{
            paidAt: entry(5507).paidAt,
            edits: [
              {
                at: entry(5507).paidAt,
                byId: null,
                from: { amount: 60_000, modes: ['upi'] },
                to: { amount: 70_000, modes: ['upi'] },
              },
            ],
          }}
        />
      </div>,
    );
    // The viewer's locale and hour cycle: en's default reads "Oct 2 11:55 AM".
    expect(await screen.findByText(/^Today 11:05/)).toBeInTheDocument();
    expect(screen.getByText(/^Oct 2 11:55/)).toBeInTheDocument();
    expect(screen.getByText('Edited 1× · last ₹600 UPI → ₹700 UPI')).toHaveClass(
      'text-tone-butter-foreground',
    );
  });

  it('shows a patient as the person chip, a payee as text — each over its sub line', async () => {
    renderWithProviders(
      <div>
        <LedgerPartyCell row={entry(5512)} />
        <LedgerPartyCell row={entry(311)} />
      </div>,
    );
    const rhea = await screen.findByText('Rhea Shah');
    expect(rhea.closest('[data-slot="person-chip"]')).not.toBeNull();
    expect(screen.getByText('Sale · Invoice #785')).toBeInTheDocument();
    const payee = screen.getByText('Medline Surgicals');
    expect(payee.closest('[data-slot="person-chip"]')).toBeNull();
    expect(screen.getByText('Consumables · Gloves, gauze, alcohol swabs')).toHaveClass(
      'text-muted-foreground',
    );
  });
});
