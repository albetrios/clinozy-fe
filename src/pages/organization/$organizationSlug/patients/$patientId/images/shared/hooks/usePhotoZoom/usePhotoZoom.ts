import {
  type MouseEvent,
  type PointerEvent,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react';

import type { PhotoFraming } from '@/shared/store/useDevicePrefsStore/index.ts';

/** The viewer's zoom range: 100% to 600% (H:4785 `clampZoom`). */
export const PHOTO_ZOOM = { min: 1, max: 6, step: 1.25, wheel: 1.12, double: 2 } as const;

/** A photo at 100%, centred — where every photo starts. */
const AT_START: PhotoFraming = { zoom: 1, x: 0, y: 0 };

/** A swipe browses once the finger travels this far, mostly sideways. */
const SWIPE_DISTANCE = 50;

/** A press on a control on the photo (×, its zoom group) is that control's, not a gesture. */
const onControl = (event?: { target: EventTarget | null }) =>
  event?.target instanceof Element && event.target.closest('button') !== null;

/** Framings by photo id; a photo missing from it stands at 100%, centred. */
type Framings = Readonly<Record<string, PhotoFraming>>;

/** Zoom to `zoom`, kept inside the range at whole percents; back at 100% the pan resets. */
export function clampZoom(zoom: number): number {
  return Math.max(PHOTO_ZOOM.min, Math.min(PHOTO_ZOOM.max, Math.round(zoom * 100) / 100));
}

/** `framing` zoomed to `zoom` (clamped); at 100% it is centred again. */
const zoomedTo = (framing: PhotoFraming, zoom: number): PhotoFraming => {
  const next = clampZoom(zoom);
  return next === 1 ? AT_START : { ...framing, zoom: next };
};

/** `framing` moved by `dx`, `dy` — a photo at 100% stays centred. */
const pannedBy = (framing: PhotoFraming, dx: number, dy: number): PhotoFraming =>
  framing.zoom > 1 ? { ...framing, x: framing.x + dx, y: framing.y + dy } : framing;

interface Gesture {
  /** The photo whose stage the gesture began on — a finger on another stage is ignored. */
  target: string | null;
  /** Pointers down on that stage, by id. */
  pointers: Map<number, { x: number; y: number }>;
  /** The framings the gesture moves, as they stood when it began. */
  from: Framings;
  /** A one-finger drag: where it started, and what one pan unit is in pixels. */
  drag: { x: number; y: number; width: number; height: number; touch: boolean } | null;
  /** A two-finger pinch: the fingers' first distance. */
  pinch: { distance: number } | null;
}

/** Wheel, double-click, drag, pinch and swipe on a photo's stage. */
export interface PhotoStageHandlers {
  onWheel: (event: WheelEvent) => void;
  onDoubleClick: (event?: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
}

/** One photo's zoom: where it stands, its controls and its stage's gestures. */
export interface PhotoZoom extends PhotoFraming {
  /** A drag or a pinch is under way — the transform follows without easing. */
  moving: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  stage: PhotoStageHandlers;
}

/** Options of {@link usePhotoZoom}. */
export interface PhotoZoomOptions {
  /** The photos on screen; a framing of any other is dropped. */
  photoIds: readonly string[];
  /** A gesture on any photo moves every photo (the comparison's Linked); otherwise its own only. */
  linked?: boolean;
  /** Where the photos stand at first (the comparison's remembered framings). */
  initial?: Framings;
  /**
   * The pan's unit: `pixels` (the viewer), or `fraction` — a share of the stage's width and
   * height, so a framing holds when the stage changes size (the comparison).
   */
  pan?: 'pixels' | 'fraction';
  /** At 100%, a one-finger swipe browses: `1` the next photo, `-1` the previous. */
  onSwipe?: (step: 1 | -1) => void;
}

/** What {@link usePhotoZoom} gives: each photo's zoom, and controls for all of them. */
export interface PhotoZooms {
  /** The photos on screen that have moved from 100%. */
  framings: Framings;
  moving: boolean;
  /** One photo's zoom; with `linked`, its controls and gestures move every photo. */
  of: (photoId: string) => PhotoZoom;
  /** Every photo, each from where it stands — the bar and the keys. */
  all: { zoomIn: () => void; zoomOut: () => void; reset: () => void };
}

const distanceOf = (points: readonly { x: number; y: number }[]) => {
  const [a, b] = points;
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};

/** `framings` for the photos on screen only, without those at 100%. */
const onScreen = (framings: Framings, photoIds: readonly string[]): Framings =>
  Object.fromEntries(
    photoIds.flatMap((id) => {
      const framing = framings[id];
      return framing && framing.zoom > 1 ? [[id, framing] as const] : [];
    }),
  );

/**
 * The photos' zoom (KICKOFF §6.6 Photo viewer; H:4785): 100–600%, ×1.25 a step,
 * the wheel ×1.12 a notch, double-click 100% ↔ 200%; a drag pans once zoomed in;
 * two fingers pinch; at 100% a one-finger swipe browses (AMBER A-F10). The
 * viewer zooms one photo; the comparison many (change-photo-compare-zoom D11):
 * `linked`, a step moves every photo from where it stands — the zoom by the same
 * factor, the pan by the same share — so photos aligned one by one stay aligned
 * (D6); otherwise a gesture moves the photo under it. A drag or a pinch computes
 * from the framings at its start, so no move is lost between renders.
 */
export function usePhotoZoom({
  photoIds,
  linked = false,
  initial,
  pan = 'pixels',
  onSwipe,
}: PhotoZoomOptions): PhotoZooms {
  const [state, setState] = useState<Framings>(() => initial ?? {});
  const latest = useRef<Framings>(state);
  const [moving, setMoving] = useState(false);
  const gesture = useRef<Gesture>({
    target: null,
    pointers: new Map(),
    from: {},
    drag: null,
    pinch: null,
  });
  // Public ids carry no comma, so the joined ids stand for the list across renders.
  const screenKey = photoIds.join(',');
  const framings = useMemo(
    () => onScreen(state, screenKey.split(',')),
    [state, screenKey],
  );

  const framingOf = (id: string): PhotoFraming => latest.current[id] ?? AT_START;
  const movedBy = (id: string) => (linked ? photoIds : [id]);
  const commit = (next: Framings) => {
    const shown = onScreen({ ...latest.current, ...next }, photoIds);
    latest.current = shown;
    setState(shown);
  };
  const update = (
    ids: readonly string[],
    change: (framing: PhotoFraming) => PhotoFraming,
  ) => commit(Object.fromEntries(ids.map((id) => [id, change(framingOf(id))])));

  const zoomBy = (ids: readonly string[], factor: number) =>
    update(ids, (framing) => zoomedTo(framing, framing.zoom * factor));
  const resetAll = (ids: readonly string[]) => update(ids, () => AT_START);
  const doubleClick = (id: string) => {
    if (framingOf(id).zoom > 1) resetAll(movedBy(id));
    else zoomBy(movedBy(id), PHOTO_ZOOM.double / framingOf(id).zoom);
  };

  const end = (event: PointerEvent) => {
    const current = gesture.current;
    if (!current.pointers.delete(event.pointerId)) return;
    if (current.pointers.size < 2) current.pinch = null;
    if (current.pointers.size > 0) return;
    const { drag, target } = current;
    if (drag?.touch && target && framingOf(target).zoom === 1 && onSwipe) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        onSwipe(dx < 0 ? 1 : -1);
      }
    }
    current.drag = null;
    current.target = null;
    setMoving(false);
  };

  const stageOf = (id: string): PhotoStageHandlers => ({
    onWheel: (event) =>
      zoomBy(movedBy(id), event.deltaY < 0 ? PHOTO_ZOOM.wheel : 1 / PHOTO_ZOOM.wheel),
    onDoubleClick: (event) => {
      if (!onControl(event)) doubleClick(id);
    },
    onPointerDown: (event) => {
      const current = gesture.current;
      if (onControl(event)) return;
      if (current.target !== null && current.target !== id) return;
      const { pointers } = current;
      current.target = id;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const moved = movedBy(id);
      current.from = Object.fromEntries(moved.map((photo) => [photo, framingOf(photo)]));
      if (pointers.size === 2) {
        current.drag = null;
        current.pinch = { distance: distanceOf([...pointers.values()]) };
        setMoving(true);
        return;
      }
      if (pointers.size > 2) return;
      const touch = event.pointerType !== 'mouse';
      const zoomed = moved.some((photo) => framingOf(photo).zoom > 1);
      // A mouse drags only a zoomed photo; a finger may also swipe.
      if (!touch && !zoomed) return;
      const stage = event.currentTarget;
      current.drag = {
        x: event.clientX,
        y: event.clientY,
        width: pan === 'fraction' ? stage.clientWidth || 1 : 1,
        height: pan === 'fraction' ? stage.clientHeight || 1 : 1,
        touch,
      };
      if (zoomed) setMoving(true);
    },
    onPointerMove: (event) => {
      const { pointers, drag, pinch, from, target } = gesture.current;
      if (target !== id || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const ids = Object.keys(from);
      if (pinch) {
        const distance = distanceOf([...pointers.values()]);
        if (pinch.distance <= 0) return;
        const ratio = distance / pinch.distance;
        commit(
          Object.fromEntries(
            ids.map((photo) => {
              const start = from[photo] ?? AT_START;
              return [photo, zoomedTo(start, start.zoom * ratio)];
            }),
          ),
        );
        return;
      }
      if (!drag) return;
      const dx = (event.clientX - drag.x) / drag.width;
      const dy = (event.clientY - drag.y) / drag.height;
      commit(
        Object.fromEntries(
          ids.map((photo) => [photo, pannedBy(from[photo] ?? AT_START, dx, dy)]),
        ),
      );
    },
    onPointerUp: end,
    onPointerCancel: end,
  });

  return {
    framings,
    moving,
    of: (id) => {
      const framing = framings[id] ?? AT_START;
      return {
        ...framing,
        moving,
        zoomIn: () => zoomBy(movedBy(id), PHOTO_ZOOM.step),
        zoomOut: () => zoomBy(movedBy(id), 1 / PHOTO_ZOOM.step),
        reset: () => resetAll(movedBy(id)),
        stage: stageOf(id),
      };
    },
    all: {
      zoomIn: () => zoomBy(photoIds, PHOTO_ZOOM.step),
      zoomOut: () => zoomBy(photoIds, 1 / PHOTO_ZOOM.step),
      reset: () => resetAll(photoIds),
    },
  };
}
