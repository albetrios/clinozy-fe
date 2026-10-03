import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useStackedDrawer } from './useStackedDrawer.ts';

describe('useStackedDrawer', () => {
  it('starts closed with no query', () => {
    const { result } = renderHook(() => useStackedDrawer(vi.fn()));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
  });

  it('opens the child with the picker’s query', () => {
    const { result } = renderHook(() => useStackedDrawer(vi.fn()));

    act(() => result.current.open('Medline'));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.query).toBe('Medline');
  });

  it('closes only the child, handing nothing to the parent', () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useStackedDrawer(onCreated));

    act(() => result.current.open());
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('on save closes the child and hands the new record to the parent field', () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useStackedDrawer<{ id: string }>(onCreated));

    act(() => result.current.open('Hydra facial'));
    act(() => result.current.complete({ id: 'off_1' }));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
    expect(onCreated).toHaveBeenCalledWith({ id: 'off_1' });
  });
});
