import type { AnimationItem } from 'lottie-web';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/animations/prefers-reduced-motion.ts';
import { cn } from '@/lib/utils.ts';

import { loadLottiePlayer } from './lottie-player.ts';

/** Props for {@link LottiePlayer}. */
export interface LottiePlayerProps {
  /**
   * Loads the animation's Lottie JSON — a dynamic import, so the data rides in the chunk that
   * plays it. Called once per mount.
   */
  animation: () => Promise<object>;
  /** The box the SVG fills (its size); layer colours come from the caller's stylesheet. */
  className?: string;
  /** Shown when the player or the animation cannot load (offline, a failed chunk). */
  fallback?: ReactNode;
  testId?: string;
}

/**
 * Plays a Lottie animation once (`feat-payment-celebration` D7, D10).
 * Decorative — `aria-hidden`: the text beside it says what happened. With reduced motion it
 * shows the last frame at once; a re-render never replays it; unmounting destroys the player.
 * The SVG's layers keep the JSON's `cl` class names, so a stylesheet can paint them from tokens.
 */
export function LottiePlayer({
  animation,
  className,
  fallback,
  testId,
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadAnimation = useRef(animation);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let item: AnimationItem | null = null;
    let cancelled = false;
    Promise.all([loadLottiePlayer(), loadAnimation.current()])
      .then(([player, data]) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        const reduced = prefersReducedMotion();
        item = player.loadAnimation({
          container,
          renderer: 'svg',
          loop: false,
          autoplay: !reduced,
          // The player mutates its data while it plays: each mount gets its own copy.
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        if (reduced) item.goToAndStop(item.totalFrames - 1, true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      item?.destroy();
    };
  }, []);

  if (failed) return <>{fallback ?? null}</>;
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-slot="lottie-player"
      data-testid={testId}
      className={cn('flex', className)}
    />
  );
}
