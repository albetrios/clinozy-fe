import { fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useEscapeBack } from './useEscapeBack.ts';

describe('useEscapeBack', () => {
  it('goes back on an Esc nothing else takes', () => {
    const onBack = vi.fn();
    renderHook(() => useEscapeBack(onBack));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('lets the top-most surface take Esc first (a handled key stays put)', () => {
    const onBack = vi.fn();
    renderHook(() => useEscapeBack(onBack));
    const takeIt = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', takeIt);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    document.removeEventListener('keydown', takeIt);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('ignores Esc with a modifier, another key and a key typed into a field', () => {
    const onBack = vi.fn();
    renderHook(() => useEscapeBack(onBack));
    const { getByRole } = render(<input aria-label="Search" />);
    fireEvent.keyDown(document.body, { key: 'Escape', shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'Escape', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(getByRole('textbox'), { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('calls the latest handler and stops listening once gone', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ onBack }) => useEscapeBack(onBack), {
      initialProps: { onBack: first },
    });
    rerender({ onBack: second });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unmount();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(second).toHaveBeenCalledOnce();
  });
});
