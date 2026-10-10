import type { CellContext } from '@tanstack/react-table';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { stockMovementRow, TEST_STOCK_PURCHASE_ID } from '@/tests/utils/stock-doubles.ts';

import type { StockMovementRow } from '../../../shared/stock-contracts.ts';
import { STOCK_KEYS, STOCK_NS } from '../../../stock.constants.ts';
import { useStockMovementColumns } from './useStockMovementColumns.tsx';

/** A word of the room as i18next answers it — the copy once merged, its key before. */
const word = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: STOCK_NS, ...options });

/** The columns, with a spy for "From purchase". */
function columns() {
  const onOpenPurchase = vi.fn();
  const { result } = renderHook(() => useStockMovementColumns({ onOpenPurchase }));
  const column = (id: string) => {
    const found = result.current.find((entry) => entry.id === id);
    if (!found) throw new Error(`no column ${id}`);
    return found;
  };
  return { all: result.current, column, onOpenPurchase };
}

/** One cell as the table draws it. */
function renderCell(
  cell: unknown,
  original: StockMovementRow,
): ReturnType<typeof render> {
  const draw = cell as (
    context: CellContext<DataTableFeatures, StockMovementRow>,
  ) => ReactNode;
  const context = { row: { original } } as CellContext<
    DataTableFeatures,
    StockMovementRow
  >;
  return render(<div>{draw(context)}</div>);
}

describe('useStockMovementColumns', () => {
  it('lays out the Movements columns, none of them sortable', () => {
    const { all } = columns();
    expect(all.map((column) => column.id)).toEqual([
      'type',
      'party',
      'when',
      'by',
      'change',
    ]);
    expect(all.every((column) => column.enableSorting === false)).toBe(true);
  });

  it('folds a use: its type, who logged it and the signed change', () => {
    const { column } = columns();
    const used = stockMovementRow();
    expect(column('type').meta?.foldValue?.(used)).toMatchObject({ value: 'Used' });
    expect(column('change').meta?.foldValue?.(used)).toBe('− 0.5 tube');
    // Folded on a tablet, left off the phone's meta line.
    expect(column('by').meta?.foldValue?.(used)).toEqual({
      value: 'Dr. Nisha Shah',
      quiet: true,
    });
    // A member who has left: nothing to fold.
    expect(column('by').meta?.foldValue?.(stockMovementRow({ by: null }))).toBeNull();
    expect(
      column('type').meta?.foldValue?.(stockMovementRow({ kind: 'opening' })),
    ).toMatchObject({
      value: word(STOCK_KEYS.movements.types.opening),
    });
  });

  it('notes what a use was for and its remark', async () => {
    const { column } = columns();
    const { container } = renderCell(
      column('party').cell,
      stockMovementRow({ note: '15 g' }),
    );
    expect(container).toHaveTextContent('Soframycin 30 gm');
    expect(container).toHaveTextContent('LHR · Dharti Galani · 15 g');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names a deleted item and counts its change bare', () => {
    const { column } = columns();
    const orphan = stockMovementRow({ item: null, deltaMilli: -1000 });
    expect(
      (
        column('party') as {
          accessorFn: (row: StockMovementRow, index: number) => unknown;
        }
      ).accessorFn(orphan, 0),
    ).toBe(word(STOCK_KEYS.movements.deletedItem));
    expect(column('change').meta?.foldValue?.(orphan)).toBe('− 1');
  });

  it('says what a revert reverted, when and why — "Other" says what was typed', () => {
    const { column } = columns();
    const reverts = {
      movementId: 'smov_use000000000000000000',
      kind: 'used' as const,
      at: '2026-09-25T05:35:00.000Z',
      reason: 'mistake' as const,
    };
    const { container, unmount } = renderCell(
      column('party').cell,
      stockMovementRow({ kind: 'reverted', usedFor: null, reverts }),
    );
    expect(container).toHaveTextContent(
      /^Soframycin 30 gmReverts used of .+ · Logged by mistake$/,
    );
    unmount();

    const typed = renderCell(
      column('party').cell,
      stockMovementRow({
        kind: 'reverted',
        usedFor: null,
        note: 'Purchase #2 deleted',
        reverts: { ...reverts, reason: 'other' },
      }),
    );
    expect(typed.container).toHaveTextContent('· Purchase #2 deleted');
    typed.unmount();

    // The original gone: the reason alone.
    const bare = renderCell(
      column('party').cell,
      stockMovementRow({
        kind: 'reverted',
        usedFor: null,
        reverts: { ...reverts, kind: null, at: null, reason: 'wrong_quantity' },
      }),
    );
    expect(bare.container).toHaveTextContent(/^Soframycin 30 gmWrong quantity$/);
  });

  it('links a receipt to its purchase, with the bill when it has one', async () => {
    const user = userEvent.setup();
    const { column, onOpenPurchase } = columns();
    const receipt = (billNo: string | null) =>
      stockMovementRow({
        kind: 'received',
        usedFor: null,
        purchaseId: TEST_STOCK_PURCHASE_ID,
        purchase: { id: TEST_STOCK_PURCHASE_ID, seq: 16, billNo },
      });
    const billed = renderCell(column('party').cell, receipt('INV-221'));
    const link = screen.getByTestId('stock-movements-purchase');
    expect(link).toHaveTextContent(
      word(STOCK_KEYS.movements.purchaseBill, { seq: 16, billNo: 'INV-221' }),
    );
    await user.click(link);
    expect(onOpenPurchase).toHaveBeenCalledWith(TEST_STOCK_PURCHASE_ID);
    expect(await axe(billed.container)).toHaveNoViolations();
    billed.unmount();

    renderCell(column('party').cell, receipt(null));
    expect(screen.getByTestId('stock-movements-purchase')).toHaveTextContent(
      word(STOCK_KEYS.movements.purchase, { seq: 16 }),
    );
  });

  it('greys a reverted change and pills it "Reverted"', () => {
    const { column } = columns();
    const { container } = renderCell(
      column('type').cell,
      stockMovementRow({ reverted: true, revertedById: 'smov_revert0000000000000' }),
    );
    expect(container).toHaveTextContent('UsedReverted');
    const change = renderCell(
      column('change').cell,
      stockMovementRow({ reverted: true, revertedById: 'smov_revert0000000000000' }),
    );
    expect(change.container.querySelector('span')).toHaveClass('text-muted-foreground');
  });
});
