import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import { ledgerRowTone, useLedgerTable } from './useLedgerTable.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Rhea's ₹600 UPI receipt (a patient's) and "Tea & snacks", ₹260 cash at 11:05 today (a payee's). */
const rows: LedgerRow[] = [
  ledgerRow({
    id: 'pay_receipt5512000000000',
    seq: 5512,
    amount: 600,
    splits: [{ mode: 'upi', amount: 600 }],
    partyName: 'Rhea Shah',
  }),
  ledgerRow({
    id: 'pay_expense0310000000000',
    seq: 310,
    direction: 'paid',
    kind: 'expense',
    amount: 260,
    splits: [{ mode: 'cash', amount: 260 }],
    paidAt: '2026-10-03T05:35:00.000Z',
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
  }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  useDevicePrefsStore.setState({ hiddenColumns: {} });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useLedgerTable (payments.md:29–30)', () => {
  it('lays out Ref · What · When · From / to · Mode · Amount · By, none sortable, Ref locked', () => {
    const { result } = renderHook(() => useLedgerTable(rows, 'payments'));
    const columns = result.current.getAllLeafColumns();
    expect(columns.map((column) => column.id)).toEqual([
      'ref',
      'what',
      'when',
      'party',
      'mode',
      'amount',
      'by',
    ]);
    expect(columns.every((column) => !column.getCanSort())).toBe(true);
    expect(result.current.getColumn('ref')?.getCanHide()).toBe(false);
    expect(result.current.getColumn('party')?.columnDef.meta).toMatchObject({
      track: 'minmax(240px,1.8fr)',
    });
    expect(result.current.getColumn('amount')?.columnDef.meta).toMatchObject({
      track: '120px',
      align: 'end',
    });
    // The recommended set shows every column.
    expect(result.current.getVisibleLeafColumns()).toHaveLength(7);
    expect(result.current.getRowModel().rows[0]?.id).toBe(rows[0]?.id);
  });

  it('puts the meta line on When, and on From / to on a phone', () => {
    const desktop = renderHook(() => useLedgerTable(rows, 'payments'));
    expect(desktop.result.current.getColumn('when')?.columnDef.meta?.primary).toBe(true);
    expect(desktop.result.current.getColumn('party')?.columnDef.meta?.primary).toBe(
      false,
    );
    viewport.tier = 'phone';
    const phone = renderHook(() => useLedgerTable(rows, 'payments'));
    expect(phone.result.current.getColumn('when')?.columnDef.meta?.primary).toBe(false);
    expect(phone.result.current.getColumn('party')?.columnDef.meta?.primary).toBe(true);
    // A patient's chip draws the avatar, so its meta line indents; a payee's doesn't.
    const drawsAvatar =
      phone.result.current.getColumn('party')?.columnDef.meta?.drawsAvatar;
    expect(drawsAvatar?.(rows.find((row) => row.seq === 5512))).toBe(true);
    expect(drawsAvatar?.(rows.find((row) => row.seq === 310))).toBe(false);
  });

  it('folds each column to its meta-line value; By folds to nothing', () => {
    const { result } = renderHook(() => useLedgerTable(rows, 'payments'));
    const tea = rows.find((row) => row.seq === 310);
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(tea);
    expect(fold('ref')).toBe('PAY-310');
    expect(fold('what')).toMatchObject({
      value: 'Paid',
      dotClassName: expect.stringContaining('bg-tone-butter-foreground'),
    });
    expect(fold('when')).toMatch(/^Today \u206811:05/);
    expect(fold('party')).toBe('Tea & snacks');
    expect(fold('mode')).toMatchObject({ value: 'Cash' });
    expect(fold('amount')).toBe('− ₹260');
    expect(fold('by')).toBeNull();
  });

  it('edges each row in its What tone', () => {
    expect(ledgerRowTone({ kind: 'receipt' })).toBe('sage');
    expect(ledgerRowTone({ kind: 'refund' })).toBe('blush');
    expect(ledgerRowTone({ kind: 'expense' })).toBe('butter');
    expect(ledgerRowTone({ kind: 'money_back' })).toBe('stone');
  });
});
