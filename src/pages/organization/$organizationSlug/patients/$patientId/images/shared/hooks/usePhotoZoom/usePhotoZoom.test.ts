import { act, renderHook } from '@testing-library/react';
import type { PointerEvent, WheelEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { clampZoom, usePhotoZoom } from './usePhotoZoom.ts';

/** A pointer event as the stage receives it. */
function pointer(
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType: 'mouse' | 'touch' = 'touch',
): PointerEvent {
  return {
    pointerId,
    pointerType,
    clientX,
    clientY,
    currentTarget: { setPointerCapture: () => undefined },
  } as unknown as PointerEvent;
}

const wheel = (deltaY: number) => ({ deltaY }) as WheelEvent;

describe('clampZoom', () => {
  it('keeps the zoom between 100% and 600%, at whole percents', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(7)).toBe(6);
    expect(clampZoom(1.23456)).toBeCloseTo(1.23, 5);
  });
});

describe('usePhotoZoom', () => {
  it('zooms ×1.25 a step, ×1.12 a wheel notch, and 100% ↔ 200% on a double-click', () => {
    const { result } = renderHook(() => usePhotoZoom('p1', vi.fn()));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBeCloseTo(1.25);
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(1);
    act(() => result.current.stage.onWheel(wheel(-100)));
    expect(result.current.zoom).toBeCloseTo(1.12);
    act(() => result.current.stage.onDoubleClick());
    expect(result.current.zoom).toBe(1);
    act(() => result.current.stage.onDoubleClick());
    expect(result.current.zoom).toBe(2);
  });

  it('pans a zoomed photo by dragging, and resets the pan at 100%', () => {
    const { result } = renderHook(() => usePhotoZoom('p1', vi.fn()));
    act(() => result.current.stage.onDoubleClick());
    act(() => result.current.stage.onPointerDown(pointer(1, 100, 100, 'mouse')));
    expect(result.current.moving).toBe(true);
    act(() => result.current.stage.onPointerMove(pointer(1, 130, 90, 'mouse')));
    expect([result.current.x, result.current.y]).toEqual([30, -10]);
    act(() => result.current.stage.onPointerUp(pointer(1, 130, 90, 'mouse')));
    expect(result.current.moving).toBe(false);
    act(() => result.current.reset());
    expect([result.current.zoom, result.current.x, result.current.y]).toEqual([1, 0, 0]);
  });

  it('ignores a mouse drag at 100%', () => {
    const { result } = renderHook(() => usePhotoZoom('p1', vi.fn()));
    act(() => result.current.stage.onPointerDown(pointer(1, 100, 100, 'mouse')));
    act(() => result.current.stage.onPointerMove(pointer(1, 160, 100, 'mouse')));
    expect([result.current.x, result.current.moving]).toEqual([0, false]);
  });

  it('pinches to zoom with two fingers (A-F10)', () => {
    const { result } = renderHook(() => usePhotoZoom('p1', vi.fn()));
    act(() => result.current.stage.onPointerDown(pointer(1, 100, 100)));
    act(() => result.current.stage.onPointerDown(pointer(2, 200, 100)));
    act(() => result.current.stage.onPointerMove(pointer(2, 300, 100)));
    expect(result.current.zoom).toBe(2);
    act(() => result.current.stage.onPointerUp(pointer(2, 300, 100)));
    act(() => result.current.stage.onPointerUp(pointer(1, 100, 100)));
    expect(result.current.zoom).toBe(2);
  });

  it('swipes to the next or previous photo at 100% (A-F10)', () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => usePhotoZoom('p1', onSwipe));
    act(() => result.current.stage.onPointerDown(pointer(1, 300, 100)));
    act(() => result.current.stage.onPointerUp(pointer(1, 200, 110)));
    expect(onSwipe).toHaveBeenLastCalledWith(1);
    act(() => result.current.stage.onPointerDown(pointer(1, 100, 100)));
    act(() => result.current.stage.onPointerUp(pointer(1, 200, 100)));
    expect(onSwipe).toHaveBeenLastCalledWith(-1);
    // Too short, or mostly up and down: no swipe.
    act(() => result.current.stage.onPointerDown(pointer(1, 100, 100)));
    act(() => result.current.stage.onPointerUp(pointer(1, 130, 300)));
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it('starts each photo at 100%', () => {
    const { result, rerender } = renderHook(({ id }) => usePhotoZoom(id, vi.fn()), {
      initialProps: { id: 'p1' },
    });
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBeCloseTo(1.25);
    rerender({ id: 'p2' });
    expect(result.current.zoom).toBe(1);
  });
});
