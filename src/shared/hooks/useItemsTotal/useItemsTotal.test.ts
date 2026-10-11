import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { invoiceLineAmounts } from '@/shared/api/app/app-money.ts';
import type { InvoiceItem } from '@/shared/api/app/app-schema.ts';

import { useItemsTotal } from './useItemsTotal.ts';

type Line = Pick<InvoiceItem, 'qty' | 'rate' | 'discountPct' | 'gstPct'>;

/** A form of invoice lines, totalled through the money module as the invoice drawer does. */
function useInvoiceTotal(lines: Line[]) {
  const form = useForm<{ items: Line[] }>({ defaultValues: { items: lines } });
  const total = useItemsTotal(
    form.control,
    'items',
    (line) => invoiceLineAmounts(line).net,
  );
  return { form, total };
}

describe('useItemsTotal', () => {
  it('sums each row’s amount through the line function', () => {
    const { result } = renderHook(() =>
      useInvoiceTotal([
        { qty: 2, rate: 480_000, discountPct: 10, gstPct: 18 },
        { qty: 1, rate: 30_000, discountPct: 0, gstPct: 0 },
      ]),
    );
    // 2 × ₹4,800 less 10%, plus 18% GST = ₹10,195.20; plus ₹300.
    expect(result.current.total).toBe(1_019_520 + 30_000);
  });

  it('re-totals as the rows change', () => {
    const { result } = renderHook(() =>
      useInvoiceTotal([{ qty: 1, rate: 250_000, discountPct: 0, gstPct: 18 }]),
    );
    expect(result.current.total).toBe(295_000);

    act(() => {
      result.current.form.setValue('items.0.qty', 3);
    });
    expect(result.current.total).toBe(885_000);
  });

  it('is 0 without rows, and skips an amount that is not a number', () => {
    const empty = renderHook(() => useInvoiceTotal([]));
    expect(empty.result.current.total).toBe(0);

    const { result } = renderHook(() => {
      const form = useForm<{ rows: { qty: number }[] }>({
        defaultValues: { rows: [{ qty: 2 }, { qty: Number.NaN }] },
      });
      return useItemsTotal(form.control, 'rows', (row) => row.qty);
    });
    expect(result.current).toBe(2);
  });
});
