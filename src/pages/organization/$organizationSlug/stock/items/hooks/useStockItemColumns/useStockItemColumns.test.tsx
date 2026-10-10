import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stockItemRow } from '@/tests/utils/stock-doubles.ts';

import { useStockItemColumns } from './useStockItemColumns.tsx';

describe('useStockItemColumns', () => {
  it('lays out the Items columns, the Supplier and Last rate hidden, the Category the phone key', () => {
    const { result } = renderHook(() => useStockItemColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'name',
      'category',
      'stock',
      'lasts',
      'vendor',
      'lastRate',
    ]);
    const meta = (id: string) => result.current.find((column) => column.id === id)?.meta;
    expect(meta('vendor')?.defaultHidden).toBe(true);
    expect(meta('lastRate')?.defaultHidden).toBe(true);
    expect(meta('lastRate')?.align).toBe('end');
    expect(meta('category')?.priority).toBe(1);
    expect(meta('name')?.primary).toBe(true);
    // The API sorts by neither the supplier nor the last rate.
    const column = (id: string) => result.current.find((entry) => entry.id === id);
    expect(column('vendor')?.enableSorting).toBe(false);
    expect(column('lastRate')?.enableSorting).toBe(false);
  });

  it('folds the id, category, the server’s level and runway, the supplier and the last rate', () => {
    const soframycin = stockItemRow();
    const dTan = stockItemRow({
      seq: 161,
      name: 'D-Tan Mask',
      category: 'masks',
      unit: 'pack',
      sizePerUnit: null,
      measureUnit: null,
      qtyMilli: 0,
      level: 'out',
      lastsDays: 3,
      lastRate: null,
      vendorId: null,
      vendor: null,
    });
    const { result } = renderHook(() => useStockItemColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('seq', soframycin)).toBe('#167');
    expect(fold('category', soframycin)).toEqual({
      value: 'Creams & Serums',
      dotClassName: expect.stringContaining('sky'),
    });
    // A bar cell folds as plain words, without a dot (H:4116).
    expect(fold('stock', soframycin)).toBe('3 tube · 90 g · OK');
    expect(fold('lasts', soframycin)).toMatchObject({ value: '~6 weeks' });
    expect(fold('vendor', soframycin)).toBe('Ankur Pharma');
    expect(fold('lastRate', soframycin)).toBe('₹250.50');
    expect(fold('stock', dTan)).toBe('0 pack · Out');
    expect(fold('lasts', dTan)).toMatchObject({
      value: '~3 days',
      dotClassName: expect.stringContaining('blush'),
    });
    expect(fold('vendor', dTan)).toBeNull();
    expect(fold('lastRate', dTan)).toBeNull();
  });

  it('reads the level the server sent, not a figure of its own', () => {
    // At its minimum the server says Low; the cell says what it was told.
    const { result } = renderHook(() => useStockItemColumns());
    const fold = (row: unknown) =>
      result.current.find((column) => column.id === 'stock')?.meta?.foldValue?.(row);
    expect(fold(stockItemRow({ qtyMilli: 1000, level: 'low' }))).toBe(
      '1 tube · 30 g · Low',
    );
  });

  it('shows the last rate in rupees, "—" before a purchase', () => {
    const { result } = renderHook(() => useStockItemColumns());
    const cell = result.current.find((column) => column.id === 'lastRate')?.cell;
    if (typeof cell !== 'function') throw new Error('no Last rate cell');
    const renderCell = (lastRate: number | null) =>
      render(
        <div>
          {cell({ row: { original: stockItemRow({ lastRate }) } } as Parameters<
            typeof cell
          >[0])}
        </div>,
      );
    const priced = renderCell(1250);
    expect(screen.getByText('₹1,250')).toBeInTheDocument();
    priced.unmount();
    renderCell(null);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
