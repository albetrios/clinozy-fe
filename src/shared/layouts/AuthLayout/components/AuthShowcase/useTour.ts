import { useCallback, useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/animations/index.ts';

import {
  TOUR_CHAPTER_MS,
  TOUR_CHAPTERS,
  TOUR_END_REST_MS,
  TOUR_VISIBLE_SHARE,
} from './auth-showcase.constants.ts';

/** Why the tour is holding still (any one is enough). */
type TourHold = 'hover' | 'typing' | 'hidden' | 'offscreen';

/** What {@link useTour} hands the stage. */
export interface TourState {
  /** The chapter on screen. */
  chapter: number;
  /** The viewer has not paused it (the pause button's state). */
  playing: boolean;
  /** It plays on its own here at all: autoplay asked for, motion allowed. */
  autoplay: boolean;
  /** The last change came from the viewer's click: narrate it (`aria-live`). */
  announce: boolean;
  /** The chapter arrived in motion: its lens plays its little scene. */
  live: boolean;
  /** Counts every arrival, a repeat click included: the lens replays on each. */
  run: number;
  togglePlaying: () => void;
  /** Jump to a chapter (a step's click): narrated, and its lens plays. */
  goTo: (chapter: number) => void;
  /** Attaches the stage's root: hover and visibility are read from it. */
  attachStage: (element: HTMLElement | null) => void;
  /** Attaches each step button: its fill is written straight to `--fill`, not rendered. */
  attachStep: (index: number) => (element: HTMLButtonElement | null) => void;
}

const TYPING_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * The tour's engine: one chapter every {@link TOUR_CHAPTER_MS} (the last rests
 * {@link TOUR_END_REST_MS} more), once round — then it rests on the first
 * chapter, paused, and Play runs it again. Progress lives in a
 * `requestAnimationFrame` loop and is painted into each step's `--fill`, so a
 * frame never re-renders React; only a new chapter does.
 *
 * @remarks
 * It holds still while the viewer is busy elsewhere: the pointer is over the
 * stage, they are typing in a field outside it, the tab is hidden, or the stage
 * is mostly scrolled away (a phone reading the form). A hold parks the frame
 * loop — no frame runs until the last hold lifts — and so do the pause button
 * (WCAG 2.2.2) and the end of the round: a login screen left open no longer
 * paints 60 frames a second for nothing (G-5). `autoplay: false` — the code,
 * MFA and hand-off screens — or reduced motion means it never moves on its own;
 * a click still changes chapter, and is then announced, which an automatic
 * change never is.
 */
export function useTour({ autoplay: autoplayAsked }: { autoplay: boolean }): TourState {
  const [reducedMotion] = useState(prefersReducedMotion);
  const autoplay = autoplayAsked && !reducedMotion;
  const [chapter, setChapter] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [announce, setAnnounce] = useState(false);
  const [live, setLive] = useState(false);
  const [run, setRun] = useState(0);

  const chapterRef = useRef(0);
  const elapsedRef = useRef(0);
  const holds = useRef(new Set<TourHold>());
  /** Starts the parked frame loop again; a no-op while none is running ({@link release}). */
  const wakeRef = useRef<() => void>(() => undefined);
  const steps = useRef<(HTMLButtonElement | null)[]>([]);
  const [stage, setStage] = useState<HTMLElement | null>(null);

  const paintFills = useCallback(
    (current: number, progress: number) => {
      steps.current.forEach((button, index) => {
        let fill = 0;
        if (index < current) fill = 1;
        else if (index === current) fill = autoplay ? progress : 1;
        button?.style.setProperty('--fill', String(fill));
      });
    },
    [autoplay],
  );

  const show = useCallback(
    (next: number, { byViewer }: { byViewer: boolean }) => {
      chapterRef.current = next;
      elapsedRef.current = 0;
      setChapter(next);
      setAnnounce(byViewer);
      setLive(!reducedMotion);
      setRun((value) => value + 1);
      paintFills(next, 0);
    },
    [paintFills, reducedMotion],
  );

  // Fills follow the chapter on every render path (a click, a pause, a resize of the list).
  useEffect(() => {
    paintFills(chapter, autoplay ? elapsedRef.current / chapterLength(chapter) : 1);
  }, [paintFills, autoplay, chapter]);

  useEffect(() => {
    if (!(autoplay && playing)) return;
    let frame: number | null = null;
    let last = 0;
    const tick = (now: number) => {
      // Held: park — the hold's release wakes the loop, its time not counted.
      if (holds.current.size > 0) {
        frame = null;
        return;
      }
      const delta = last ? now - last : 0;
      last = now;
      elapsedRef.current += delta;
      const length = chapterLength(chapterRef.current);
      paintFills(chapterRef.current, Math.min(1, elapsedRef.current / length));
      if (elapsedRef.current >= length) {
        const next = chapterRef.current + 1;
        if (next >= TOUR_CHAPTERS.length) {
          // Once round: back to the first chapter, at rest; Play runs it again.
          frame = null;
          show(0, { byViewer: false });
          setPlaying(false);
          return;
        }
        show(next, { byViewer: false });
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame !== null) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    wakeRef.current = start;
    start();
    return () => {
      wakeRef.current = () => undefined;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
  }, [autoplay, playing, paintFills, show]);

  // The holds: typing anywhere outside the stage, a hidden tab, a stage scrolled away.
  useEffect(() => {
    if (!autoplay) return;
    const held = holds.current;
    /** Lift a hold; the last one to go wakes the parked loop. */
    const release = (hold: TourHold) => {
      if (held.delete(hold) && held.size === 0) wakeRef.current();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && TYPING_TARGETS.has(target.tagName) && !stage?.contains(target)) {
        held.add('typing');
      }
    };
    const onFocusOut = () => release('typing');
    const onVisibility = () => (document.hidden ? held.add('hidden') : release('hidden'));
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    let observer: IntersectionObserver | undefined;
    if (stage && typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry && entry.intersectionRatio < TOUR_VISIBLE_SHARE)
            held.add('offscreen');
          else release('offscreen');
        },
        { threshold: [0, TOUR_VISIBLE_SHARE, 1] },
      );
      observer.observe(stage);
    }
    const onEnter = () => held.add('hover');
    const onLeave = () => release('hover');
    stage?.addEventListener('pointerenter', onEnter);
    stage?.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      stage?.removeEventListener('pointerenter', onEnter);
      stage?.removeEventListener('pointerleave', onLeave);
      // The holds go with their listeners: a loop they parked runs on.
      const wasHeld = held.size > 0;
      held.clear();
      if (wasHeld) wakeRef.current();
    };
  }, [autoplay, stage]);

  const attachStep = useCallback(
    (index: number) => (element: HTMLButtonElement | null) => {
      steps.current[index] = element;
    },
    [],
  );

  return {
    chapter,
    playing,
    autoplay,
    announce,
    live,
    run,
    togglePlaying: () => setPlaying((value) => !value),
    goTo: (next: number) => show(next, { byViewer: true }),
    attachStage: setStage,
    attachStep,
  };
}

/** A chapter's length: the last one rests a little longer before the loop. */
function chapterLength(chapter: number): number {
  return TOUR_CHAPTER_MS + (chapter === TOUR_CHAPTERS.length - 1 ? TOUR_END_REST_MS : 0);
}
