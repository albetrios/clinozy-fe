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
}

const TYPING_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * The tour's engine: one chapter every {@link TOUR_CHAPTER_MS} (the last rests
 * {@link TOUR_END_REST_MS} more), once round — then it rests on the first
 * chapter, paused, and Play runs it again. One timer per chapter: nothing on
 * the stage reads a chapter's progress (the dots mark the chapter, not a fill),
 * so no frame runs between chapters — and a new chapter is the only re-render.
 *
 * @remarks
 * It holds still while the viewer is busy elsewhere: the pointer is over the
 * stage, they are typing in a field outside it, the tab is hidden, or the stage
 * is mostly scrolled away (a phone reading the form). A hold parks the timer and
 * banks the time already run, and the last hold to lift starts it again for what
 * is left; so do the pause button (WCAG 2.2.2) and the end of the round. A click
 * starts the picked chapter's clock afresh. `autoplay: false` — the code, MFA and
 * hand-off screens — or reduced motion means it never moves on its own; a click
 * still changes chapter, and is then announced, which an automatic change never is.
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
  /** Starts the parked chapter timer again; a no-op while none is waiting ({@link release}). */
  const wakeRef = useRef<() => void>(() => undefined);
  /** Parks the running chapter timer, banking the time it ran (a hold arriving). */
  const parkRef = useRef<() => void>(() => undefined);
  /** Runs the chapter on screen from its start (a pick, or the next chapter). */
  const restartRef = useRef<() => void>(() => undefined);
  const [stage, setStage] = useState<HTMLElement | null>(null);

  const show = useCallback(
    (next: number, { byViewer }: { byViewer: boolean }) => {
      chapterRef.current = next;
      elapsedRef.current = 0;
      setChapter(next);
      setAnnounce(byViewer);
      setLive(!reducedMotion);
      setRun((value) => value + 1);
      restartRef.current();
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (!(autoplay && playing)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startedAt = 0;
    /** Stop the timer and bank the time it ran; the chapter resumes from there. */
    const park = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      elapsedRef.current += performance.now() - startedAt;
    };
    /** Run what is left of the chapter on screen — unless something holds the tour. */
    const start = () => {
      if (timer !== null || holds.current.size > 0) return;
      startedAt = performance.now();
      const left = Math.max(0, chapterLength(chapterRef.current) - elapsedRef.current);
      timer = setTimeout(() => {
        timer = null;
        const next = chapterRef.current + 1;
        if (next >= TOUR_CHAPTERS.length) {
          // Once round: back to the first chapter, at rest; Play runs it again.
          show(0, { byViewer: false });
          setPlaying(false);
          return;
        }
        show(next, { byViewer: false });
        start();
      }, left);
    };
    wakeRef.current = start;
    parkRef.current = park;
    // `show` has already zeroed the elapsed time: drop the old timer, run the full chapter.
    restartRef.current = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      start();
    };
    start();
    return () => {
      wakeRef.current = () => undefined;
      restartRef.current = () => undefined;
      parkRef.current = () => undefined;
      park();
    };
  }, [autoplay, playing, show]);

  // The holds: typing anywhere outside the stage, a hidden tab, a stage scrolled away.
  useEffect(() => {
    if (!autoplay) return;
    const held = holds.current;
    /** Take a hold; the first one parks the running chapter timer. */
    const hold = (reason: TourHold) => {
      held.add(reason);
      parkRef.current();
    };
    /** Lift a hold; the last one to go wakes the parked timer. */
    const release = (reason: TourHold) => {
      if (held.delete(reason) && held.size === 0) wakeRef.current();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && TYPING_TARGETS.has(target.tagName) && !stage?.contains(target)) {
        hold('typing');
      }
    };
    const onFocusOut = () => release('typing');
    const onVisibility = () => (document.hidden ? hold('hidden') : release('hidden'));
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    let observer: IntersectionObserver | undefined;
    if (stage && typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry && entry.intersectionRatio < TOUR_VISIBLE_SHARE) hold('offscreen');
          else release('offscreen');
        },
        { threshold: [0, TOUR_VISIBLE_SHARE, 1] },
      );
      observer.observe(stage);
    }
    const onEnter = () => hold('hover');
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
      // The holds go with their listeners: a timer they parked runs on.
      const wasHeld = held.size > 0;
      held.clear();
      if (wasHeld) wakeRef.current();
    };
  }, [autoplay, stage]);

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
  };
}

/** A chapter's length: the last one rests a little longer before the loop. */
function chapterLength(chapter: number): number {
  return TOUR_CHAPTER_MS + (chapter === TOUR_CHAPTERS.length - 1 ? TOUR_END_REST_MS : 0);
}
