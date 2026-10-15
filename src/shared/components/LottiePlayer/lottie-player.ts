import { onceAsync } from '@/lib/lazy-module.ts';

/**
 * lottie-web's light player — the SVG renderer without expressions, so no `eval` (the CSP has no
 * `unsafe-eval`, `feat-payment-celebration` D7). One shared, deferred chunk: nothing on first
 * paint imports it.
 */
export const loadLottiePlayer = onceAsync(() =>
  import('lottie-web/build/player/lottie_light').then((module) => module.default),
);

/**
 * Warms the player's chunk before it is needed — a drawer that may celebrate calls it when it
 * opens, so the animation starts on the frame its view appears.
 */
export function preloadLottiePlayer(): void {
  loadLottiePlayer().catch(() => undefined);
}
