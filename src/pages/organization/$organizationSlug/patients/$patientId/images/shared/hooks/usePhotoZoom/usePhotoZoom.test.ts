import { act, renderHook } from '@testing-library/react';
import type { MouseEvent, PointerEvent, WheelEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { clampZoom, usePhotoZoom } from './usePhotoZoom.ts';

/** A pointer event as the stage receives it. */
function pointer(
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType: 'mouse' | 'touch' = 'touch',
  stage: { clientWidth: number; clientHeight: number } = {
    clientWidth: 0,
    clientHeight: 0,
  },
): PointerEvent {
  return {
    pointerId,
    pointerType,
    clientX,
    clientY,
    currentTarget: { ...stage, setPointerCapture: () => undefined },
  } as unknown as PointerEvent;
}

/** The viewer's call: one photo, browsing by swipe. */
const useOnePhoto = (photoId: string, onSwipe: (step: 1 | -1) => void) =>
  usePhotoZoom({ photoIds: [photoId], onSwipe }).of(photoId);

const wheel = (deltaY: number) => ({ deltaY }) as WheelEvent;

describe('clampZoom', () => {
  it('keeps the zoom between 100% and 600%, at whole percents', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(7)).toBe(6);
    expect(clampZoom(1.23456)).toBeCloseTo(1.23, 5);
  });
});

describe('usePhotoZoom — one photo (the viewer)', () => {
  it('zooms ×1.25 a step, ×1.12 a wheel notch, and 100% ↔ 200% on a double-click', () => {
    const { result } = renderHook(() => useOnePhoto('p1', vi.fn()));
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
    const { result } = renderHook(() => useOnePhoto('p1', vi.fn()));
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
    const { result } = renderHook(() => useOnePhoto('p1', vi.fn()));
    act(() => result.current.stage.onPointerDown(pointer(1, 100, 100, 'mouse')));
    act(() => result.current.stage.onPointerMove(pointer(1, 160, 100, 'mouse')));
    expect([result.current.x, result.current.moving]).toEqual([0, false]);
  });

  it('pinches to zoom with two fingers (A-F10)', () => {
    const { result } = renderHook(() => useOnePhoto('p1', vi.fn()));
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
    const { result } = renderHook(() => useOnePhoto('p1', onSwipe));
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
    const { result, rerender } = renderHook(({ id }) => useOnePhoto(id, vi.fn()), {
      initialProps: { id: 'p1' },
    });
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBeCloseTo(1.25);
    rerender({ id: 'p2' });
    expect(result.current.zoom).toBe(1);
  });
});

describe('usePhotoZoom — many photos (the comparison)', () => {
  const ids = ['a', 'b', 'c'] as const;
  const levels = (zooms: ReturnType<typeof usePhotoZoom>) =>
    ids.map((id) => zooms.of(id).zoom);

  it('Separate: a gesture or a control moves its own photo only', () => {
    const { result } = renderHook(() => usePhotoZoom({ photoIds: ids }));
    act(() => result.current.of('b').zoomIn());
    act(() => result.current.of('c').stage.onWheel(wheel(-100)));
    expect(levels(result.current)).toEqual([1, 1.25, 1.12]);
    act(() => result.current.of('b').reset());
    expect(levels(result.current)).toEqual([1, 1, 1.12]);
    expect(result.current.framings).toEqual({ c: { zoom: 1.12, x: 0, y: 0 } });
  });

  it('Linked: every photo moves by the same step from where it stands (D6)', () => {
    const { result } = renderHook(() =>
      usePhotoZoom({
        photoIds: ids,
        linked: true,
        initial: { b: { zoom: 2, x: 0.1, y: 0 } },
      }),
    );
    act(() => result.current.of('a').zoomIn());
    expect(levels(result.current)).toEqual([1.25, 2.5, 1.25]);
    act(() => result.current.of('c').stage.onPointerDown(pointer(1, 0, 0, 'mouse')));
    act(() => result.current.of('c').stage.onPointerMove(pointer(1, 10, -5, 'mouse')));
    act(() => result.current.of('c').stage.onPointerUp(pointer(1, 10, -5, 'mouse')));
    expect(result.current.of('b')).toMatchObject({ x: 10.1, y: -5 });
    expect(result.current.of('a')).toMatchObject({ x: 10, y: -5 });
    // The first photo zoomed: a double-click resets them all.
    act(() => result.current.of('a').stage.onDoubleClick());
    expect(levels(result.current)).toEqual([1, 1, 1]);
    // At 100%: it doubles every photo.
    act(() => result.current.of('a').stage.onDoubleClick());
    expect(levels(result.current)).toEqual([2, 2, 2]);
  });

  it('pinches every linked photo from where each stood when the fingers landed', () => {
    const { result } = renderHook(() =>
      usePhotoZoom({
        photoIds: ids,
        linked: true,
        initial: { c: { zoom: 3, x: 0, y: 0 } },
      }),
    );
    const stage = () => result.current.of('a').stage;
    act(() => stage().onPointerDown(pointer(1, 100, 100)));
    act(() => stage().onPointerDown(pointer(2, 200, 100)));
    act(() => stage().onPointerMove(pointer(2, 250, 100)));
    act(() => stage().onPointerMove(pointer(2, 300, 100)));
    expect(levels(result.current)).toEqual([2, 2, 6]);
    expect(result.current.moving).toBe(true);
    act(() => stage().onPointerUp(pointer(2, 300, 100)));
    act(() => stage().onPointerUp(pointer(1, 100, 100)));
    expect(result.current.moving).toBe(false);
  });

  it('pans by a share of the stage with `pan: fraction`, so a resize keeps the spot', () => {
    const { result } = renderHook(() =>
      usePhotoZoom({
        photoIds: ids,
        pan: 'fraction',
        initial: { a: { zoom: 2, x: 0, y: 0 } },
      }),
    );
    const size = { clientWidth: 400, clientHeight: 200 };
    act(() =>
      result.current.of('a').stage.onPointerDown(pointer(1, 0, 0, 'mouse', size)),
    );
    act(() =>
      result.current.of('a').stage.onPointerMove(pointer(1, 100, -50, 'mouse', size)),
    );
    expect(result.current.of('a')).toMatchObject({ x: 0.25, y: -0.25 });
  });

  it("ignores a finger on another photo's stage while a gesture runs", () => {
    const { result } = renderHook(() =>
      usePhotoZoom({ photoIds: ids, initial: { a: { zoom: 2, x: 0, y: 0 } } }),
    );
    act(() => result.current.of('a').stage.onPointerDown(pointer(1, 0, 0, 'mouse')));
    act(() => result.current.of('b').stage.onPointerDown(pointer(2, 0, 0)));
    act(() => result.current.of('b').stage.onPointerMove(pointer(2, 40, 0)));
    act(() => result.current.of('b').stage.onPointerUp(pointer(2, 40, 0)));
    act(() => result.current.of('a').stage.onPointerMove(pointer(1, 20, 0, 'mouse')));
    expect(result.current.of('a').x).toBe(20);
    expect(result.current.of('b').zoom).toBe(1);
  });

  it('zooms and resets every photo from the bar and the keys, each from its own level', () => {
    const { result } = renderHook(() =>
      usePhotoZoom({ photoIds: ids, initial: { b: { zoom: 2, x: 0.2, y: 0 } } }),
    );
    act(() => result.current.all.zoomIn());
    expect(levels(result.current)).toEqual([1.25, 2.5, 1.25]);
    act(() => result.current.all.zoomOut());
    expect(levels(result.current)).toEqual([1, 2, 1]);
    act(() => result.current.all.reset());
    expect(result.current.framings).toEqual({});
  });

  it('drops the framing of a photo taken off the screen', () => {
    const { result, rerender } = renderHook(
      ({ photoIds }) =>
        usePhotoZoom({ photoIds, initial: { a: { zoom: 2, x: 0, y: 0 } } }),
      { initialProps: { photoIds: ['a', 'b'] as readonly string[] } },
    );
    act(() => result.current.of('b').zoomIn());
    rerender({ photoIds: ['b'] });
    expect(result.current.framings).toEqual({ b: { zoom: 1.25, x: 0, y: 0 } });
  });

  it('leaves a press or a double-click on a control on the photo to that control', () => {
    const { result } = renderHook(() =>
      usePhotoZoom({ photoIds: ids, initial: { a: { zoom: 2, x: 0, y: 0 } } }),
    );
    const button = document.createElement('button');
    const press = { ...pointer(1, 0, 0, 'mouse'), target: button } as PointerEvent;
    act(() => result.current.of('a').stage.onPointerDown(press));
    expect(result.current.moving).toBe(false);
    act(() =>
      result.current
        .of('a')
        .stage.onDoubleClick({ target: button } as unknown as MouseEvent),
    );
    expect(result.current.of('a').zoom).toBe(2);
  });
});
