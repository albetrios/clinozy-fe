import { type PointerEvent, useRef, useState, type WheelEvent } from 'react';

/** The viewer's zoom range: 100% to 600% (H:4785 `clampZ`). */
export const PHOTO_ZOOM = { min: 1, max: 6, step: 1.25, wheel: 1.12, double: 2 } as const;

/** A swipe browses once the finger travels this far, mostly sideways. */
const SWIPE_DISTANCE = 50;

/** Zoom and pan of the photo on screen. */
interface ZoomState {
  /** The photo it belongs to — another photo starts at 100%. */
  photoId: string;
  zoom: number;
  x: number;
  y: number;
}

/** Zoom to `zoom`, kept inside the range at whole percents; back at 100% the pan resets. */
export function clampZoom(zoom: number): number {
  return Math.max(PHOTO_ZOOM.min, Math.min(PHOTO_ZOOM.max, Math.round(zoom * 100) / 100));
}

interface Gesture {
  /** Pointers down on the stage, by id. */
  pointers: Map<number, { x: number; y: number }>;
  /** A one-finger drag: where it started and the pan it started from. */
  drag: { x: number; y: number; panX: number; panY: number; touch: boolean } | null;
  /** A two-finger pinch: the fingers' first distance and the zoom then. */
  pinch: { distance: number; zoom: number } | null;
}

/** What {@link usePhotoZoom} gives the viewer. */
export interface PhotoZoom {
  zoom: number;
  x: number;
  y: number;
  /** A drag or a pinch is under way — the transform follows without easing. */
  moving: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Wheel, double-click, drag, pinch and swipe on the photo's stage. */
  stage: {
    onWheel: (event: WheelEvent) => void;
    onDoubleClick: () => void;
    onPointerDown: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerCancel: (event: PointerEvent) => void;
  };
}

const distanceOf = (points: readonly { x: number; y: number }[]) => {
  const [a, b] = points;
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};

/**
 * The photo viewer's zoom (KICKOFF §6.6 Photo viewer; H:4785): 100–600%,
 * ×1.25 a step, the wheel ×1.12 a notch, double-click 100% ↔ 200%; a drag
 * pans once zoomed in. The build adds a two-finger pinch and, at 100%, a
 * one-finger swipe that browses (`onSwipe(1)` the next photo, `-1` the
 * previous; AMBER A-F10). Each photo starts at 100%.
 */
export function usePhotoZoom(
  photoId: string,
  onSwipe: (step: 1 | -1) => void,
): PhotoZoom {
  const [state, setState] = useState<ZoomState>({ photoId, zoom: 1, x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const gesture = useRef<Gesture>({ pointers: new Map(), drag: null, pinch: null });
  const current = state.photoId === photoId ? state : { photoId, zoom: 1, x: 0, y: 0 };

  const zoomTo = (zoom: number) => {
    const next = clampZoom(zoom);
    setState(next === 1 ? { photoId, zoom: 1, x: 0, y: 0 } : { ...current, zoom: next });
  };
  const reset = () => setState({ photoId, zoom: 1, x: 0, y: 0 });

  const end = (event: PointerEvent) => {
    const { pointers, drag } = gesture.current;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) gesture.current.pinch = null;
    if (pointers.size > 0) return;
    if (drag?.touch && current.zoom === 1) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        onSwipe(dx < 0 ? 1 : -1);
      }
    }
    gesture.current.drag = null;
    setMoving(false);
  };

  return {
    zoom: current.zoom,
    x: current.x,
    y: current.y,
    moving,
    zoomIn: () => zoomTo(current.zoom * PHOTO_ZOOM.step),
    zoomOut: () => zoomTo(current.zoom / PHOTO_ZOOM.step),
    reset,
    stage: {
      onWheel: (event) =>
        zoomTo(
          current.zoom * (event.deltaY < 0 ? PHOTO_ZOOM.wheel : 1 / PHOTO_ZOOM.wheel),
        ),
      onDoubleClick: () => zoomTo(current.zoom > 1 ? 1 : PHOTO_ZOOM.double),
      onPointerDown: (event) => {
        const { pointers } = gesture.current;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (pointers.size === 2) {
          gesture.current.drag = null;
          gesture.current.pinch = {
            distance: distanceOf([...pointers.values()]),
            zoom: current.zoom,
          };
          setMoving(true);
          return;
        }
        if (pointers.size > 2) return;
        const touch = event.pointerType !== 'mouse';
        // A mouse drags only a zoomed photo; a finger may also swipe.
        if (!touch && current.zoom <= 1) return;
        gesture.current.drag = {
          x: event.clientX,
          y: event.clientY,
          panX: current.x,
          panY: current.y,
          touch,
        };
        if (current.zoom > 1) setMoving(true);
      },
      onPointerMove: (event) => {
        const { pointers, drag, pinch } = gesture.current;
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch) {
          const distance = distanceOf([...pointers.values()]);
          if (pinch.distance > 0) zoomTo(pinch.zoom * (distance / pinch.distance));
          return;
        }
        if (!drag || current.zoom <= 1) return;
        setState({
          ...current,
          x: drag.panX + (event.clientX - drag.x),
          y: drag.panY + (event.clientY - drag.y),
        });
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
