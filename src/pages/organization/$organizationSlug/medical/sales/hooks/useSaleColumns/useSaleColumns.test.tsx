import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidSaleRow, saleRow } from '@/tests/utils/medical-doubles.ts';

import { useSaleColumns } from './useSaleColumns.tsx';

describe('useSaleColumns', () => {
  it('lays out the Sales columns with Margin hidden', () => {
    const { result } = renderHook(() => useSaleColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'customer',
      'medicines',
      'bill',
      'margin',
      'status',
      'when',
    ]);
    expect(result.current.find((column) => column.id === 'margin')?.meta).toMatchObject({
      defaultHidden: true,
      track: '100px',
    });
  });

  it('folds a sale into its meta line — the API’s rupees and its server-read margin', () => {
    const { result } = renderHook(() => useSaleColumns());
    const fold = (id: string, sale = saleRow()) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(sale);
    expect(fold('seq')).toBe('#978');
    expect(fold('bill')).toBe('₹1,300');
    expect(fold('margin')).toBe('₹460');
    expect(fold('status')).toMatchObject({ value: 'Unpaid' });
    expect(fold('when')).toMatch(/\d/);
  });

  it('reads Returned before Paid once something came back', () => {
    const { result } = renderHook(() => useSaleColumns());
    const returned = paidSaleRow({
      status: 'returned',
      returned: 650,
      returns: [
        {
          id: 'msrt_back00000000000000000',
          reason: 'unused',
          refundMode: 'cash',
          note: null,
          amount: 650,
          creditNoteId: 'icn_back00000000000000000',
          pendingCreditId: null,
          items: [
            {
              invoiceItemId: 'iitm_line00000000000000000',
              qty: 1,
              amount: 650,
              restocked: true,
            },
          ],
          returnedById: null,
          at: '2026-10-11T05:30:00.000Z',
        },
      ],
    });
    const status = result.current.find((column) => column.id === 'status');
    expect(status?.meta?.foldValue?.(returned)).toMatchObject({
      value: 'Returned, Paid',
    });
  });
});
