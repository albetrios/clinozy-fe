import { preloadLottiePlayer } from '@/shared/components/LottiePlayer/index.ts';

/** The animation's Lottie JSON (authored for Clinozy, D4) — its own chunk, beside the player's. */
export const loadPaymentReceivedAnimation = () =>
  import('./payment-received.lottie.json').then((module) => module.default as object);

/**
 * Warms the player and the animation before a payment is saved — a drawer that can take one
 * calls it when it opens, so the moment plays on the frame the view appears.
 */
export function preloadPaymentReceived(): void {
  preloadLottiePlayer();
  loadPaymentReceivedAnimation().catch(() => undefined);
}
