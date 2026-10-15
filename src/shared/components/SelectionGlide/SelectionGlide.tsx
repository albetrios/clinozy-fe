import './selection-glide.css';

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils.ts';

/**
 * How the thumb reaches its spot, as `data-glide` (`selection-glide.css`):
 * `still` — placed at once (the first paint, a resize, a font swap); `glide`
 * — the selection moved, so it slides there; `appear` — it was hidden and
 * fades in where it lands; `gone` — nothing is selected, so it fades out.
 */
type GlideMode = 'still' | 'glide' | 'appear' | 'gone';

/** Where the thumb sits, relative to its track's inline-start padding edge. */
interface GlideBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Marks the selected item while the thumb covers it: its own surface steps aside. */
export const GLIDE_COVERED_ATTRIBUTE = 'data-glide-covered';

/**
 * The item's box against its track, sub-pixel. The thumb is anchored at the
 * track's `inset-inline-start: 0`, so in right-to-left it measures from the
 * right padding edge (a negative x); `scrollLeft` keeps it right on a track
 * that scrolls sideways — the thumb scrolls with the items.
 */
function measure(track: HTMLElement, item: HTMLElement): GlideBox {
  const trackBox = track.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  const paddingLeft = trackBox.left + track.clientLeft;
  const rightToLeft = getComputedStyle(track).direction === 'rtl';
  const x = rightToLeft
    ? itemBox.right - (paddingLeft + track.clientWidth) + track.scrollLeft
    : itemBox.left - paddingLeft + track.scrollLeft;
  return {
    x,
    y: itemBox.top - (trackBox.top + track.clientTop) + track.scrollTop,
    width: itemBox.width,
    height: itemBox.height,
  };
}

function sameBox(a: GlideBox | null, b: GlideBox): boolean {
  return (
    a !== null &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/**
 * Where each continuous track's thumb was when it unmounted (`feat-payment-celebration` D13): a
 * room's tabs are routes, so moving between them remounts the track — the new one starts its
 * thumb where the old one stood, then travels, as an in-page track does. Kept briefly: a track
 * mounted later (another room, a minute on) just places its thumb.
 */
const CONTINUITY = new Map<string, { box: GlideBox; at: number }>();
/** How long a left thumb's place is worth starting from — a route change, not a later visit. */
const CONTINUITY_MS = 1000;

/** The place a remounted track's thumb starts from, once; null when there is none (or it is stale). */
function takeContinuity(key: string | undefined): GlideBox | null {
  if (key === undefined) return null;
  const left = CONTINUITY.get(key);
  CONTINUITY.delete(key);
  return left && performance.now() - left.at < CONTINUITY_MS ? left.box : null;
}

/** What the thumb last showed: the item it covered, its box, whether it is showing. */
interface GlideState {
  item: HTMLElement | null;
  box: GlideBox | null;
  shown: boolean;
}

/**
 * How the thumb reaches the item: it glides only when the selected ELEMENT
 * changed while it was showing (and the change is not a resize); back after a
 * "gone" it fades in where it lands; anything else — the first placement
 * included — is still.
 */
function glideMode(
  thumb: HTMLElement,
  state: GlideState,
  item: HTMLElement,
  resized: boolean,
): GlideMode {
  if (!state.shown)
    return thumb.getAttribute('data-glide') === 'gone' ? 'appear' : 'still';
  return item !== state.item && !resized ? 'glide' : 'still';
}

/**
 * The mode first, then the box: one style change, read with the mode's
 * transition. The thumb's own `translate`, `width` and `height` — set on the
 * element directly, never through a custom property.
 */
function writeGlide(thumb: HTMLElement, mode: GlideMode, box: GlideBox): void {
  thumb.setAttribute('data-glide', mode);
  thumb.style.translate = `${box.x}px ${box.y}px`;
  thumb.style.width = `${box.width}px`;
  thumb.style.height = `${box.height}px`;
}

/** Nothing is selected: the cover comes off and the thumb fades out (if it showed). */
function fadeGlide(thumb: HTMLElement, state: GlideState): void {
  state.item?.removeAttribute(GLIDE_COVERED_ATTRIBUTE);
  if (state.shown) thumb.setAttribute('data-glide', 'gone' satisfies GlideMode);
  Object.assign(state, { item: null, box: null, shown: false });
}

/**
 * The selected item has no size (no layout: jsdom, a hidden row): the thumb
 * hides and covers nothing, so the item draws its own selected surface.
 */
function hideGlide(thumb: HTMLElement, state: GlideState, item: HTMLElement): void {
  state.item?.removeAttribute(GLIDE_COVERED_ATTRIBUTE);
  thumb.removeAttribute('data-glide');
  Object.assign(state, { item, box: null, shown: false });
}

/** Places the thumb under the track's selected item once, and covers that item. */
function placeGlide(
  thumb: HTMLElement,
  selector: string,
  state: GlideState,
  resized: boolean,
): void {
  const track = thumb.parentElement;
  if (!track) return;
  const item = track.querySelector<HTMLElement>(selector);
  if (!item) {
    fadeGlide(thumb, state);
    return;
  }
  const box = measure(track, item);
  if (box.width < 1 || box.height < 1) {
    hideGlide(thumb, state, item);
    return;
  }
  if (item === state.item && state.shown && sameBox(state.box, box)) return;
  if (item !== state.item) state.item?.removeAttribute(GLIDE_COVERED_ATTRIBUTE);
  writeGlide(thumb, glideMode(thumb, state, item, resized), box);
  item.setAttribute(GLIDE_COVERED_ATTRIBUTE, '');
  Object.assign(state, { item, box, shown: true });
}

/**
 * Keeps the thumb under the track's selected item: every commit (the
 * selection, the labels or the folded tabs may have changed — it glides when
 * the selected element changed) and on every resize of the track or an item
 * (a window, a font swap, a label that grew — placed at once).
 */
function useSelectionGlide(
  ref: RefObject<HTMLSpanElement | null>,
  selector: string,
  continuity: string | undefined,
) {
  const state = useRef<GlideState>({ item: null, box: null, shown: false });

  const place = useCallback(
    (resized: boolean) => {
      const thumb = ref.current;
      if (!thumb) return;
      const from = state.current.shown ? null : takeContinuity(continuity);
      if (from) {
        // Stand where the last track's thumb stood, let the browser take it, then travel.
        writeGlide(thumb, 'still', from);
        thumb.getBoundingClientRect();
        Object.assign(state.current, { item: null, box: from, shown: true });
      }
      placeGlide(thumb, selector, state.current, resized);
    },
    [ref, selector, continuity],
  );

  useLayoutEffect(() => {
    place(false);
  });

  useEffect(() => {
    const thumb = ref.current;
    const track = thumb?.parentElement;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => place(true));
    observer.observe(track);
    for (const child of track.children) {
      if (child !== thumb) observer.observe(child);
    }
    return () => observer.disconnect();
  }, [ref, place]);

  // Leaving: the item it covered draws itself again, and a continuous track leaves its place.
  useEffect(() => {
    const current = state.current;
    return () => {
      current.item?.removeAttribute(GLIDE_COVERED_ATTRIBUTE);
      if (continuity !== undefined && current.shown && current.box) {
        CONTINUITY.set(continuity, { box: current.box, at: performance.now() });
      }
    };
  }, [continuity]);
}

/** Props for {@link SelectionGlide}. */
export interface SelectionGlideProps {
  /**
   * The selected item, as a selector inside the track (the glide's parent):
   * `[aria-current="page"]`, `[data-state="active"]`, `[aria-pressed="true"]`.
   */
  selected: string;
  /** The thumb's surface — the selected look's fill, ring, shadow and radius. */
  className?: string;
  /**
   * The same track on every page it is drawn on (a room's tabs, which are routes): when it
   * remounts within a second, the thumb starts where it stood and travels (D13).
   */
  continuity?: string;
}

/**
 * One thumb for a row's selection (change-motion-polish D7): it sits under the
 * selected item and, when the selection moves, glides there — 240ms on the
 * strong ease-in-out, the curve for movement on screen, size and colour with
 * it, the label's ink in step (change-motion-consistency) — instead of the
 * selection jumping. Render
 * it as the FIRST child of the row; the row must be positioned and isolated
 * (`relative isolate`), since the thumb is absolutely placed behind the items
 * (`z-index: -1`, `selection-glide.css`). While it covers an item, the item
 * carries {@link GLIDE_COVERED_ATTRIBUTE} and its own fill and shadow step
 * aside; with no layout it covers nothing. Logical placement, so a
 * right-to-left row is measured from its right edge.
 */
export function SelectionGlide({ selected, className, continuity }: SelectionGlideProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useSelectionGlide(ref, selected, continuity);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-slot="selection-glide"
      className={cn('pointer-events-none', className)}
    />
  );
}
