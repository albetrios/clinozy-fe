import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StockItem, StockVendor } from '@/shared/api/clinic/clinic-schema.ts';

import { useStockStack } from './useStockStack.ts';

const ANKIT = { id: 'v9', name: 'Ankit Traders', phone: null } as StockVendor;
const COTTON = { id: 'i9', name: 'Cotton' } as StockItem;

describe('useStockStack', () => {
  it('opens one child — a vendor or an item — named from the picker', () => {
    const { result } = renderHook(() => useStockStack());
    expect(result.current.child).toBeNull();

    act(() =>
      result.current.open({
        kind: 'item',
        query: 'Cotton',
        vendorId: 'v1',
        onCreated: vi.fn(),
      }),
    );
    expect(result.current.child).toMatchObject({
      kind: 'item',
      query: 'Cotton',
      vendorId: 'v1',
    });
  });

  it('Back closes the child and picks nothing', () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useStockStack());
    act(() => result.current.open({ kind: 'vendor', query: 'Ankit', onCreated }));
    act(() => result.current.close());
    expect(result.current.child).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('a save closes the child and hands the record to the field that asked', () => {
    const onVendor = vi.fn();
    const onItem = vi.fn();
    const { result } = renderHook(() => useStockStack());
    act(() =>
      result.current.open({ kind: 'vendor', query: 'Ankit', onCreated: onVendor }),
    );
    act(() => result.current.complete(ANKIT));
    expect(result.current.child).toBeNull();
    expect(onVendor).toHaveBeenCalledWith(ANKIT);

    act(() => result.current.open({ kind: 'item', query: 'Cotton', onCreated: onItem }));
    act(() => result.current.complete(COTTON));
    expect(onItem).toHaveBeenCalledWith(COTTON);
  });
});
