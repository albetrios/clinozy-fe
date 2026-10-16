/**
 * The app's three motion curves as numbers, for code that animates from
 * script — anime.js on onboarding, Web Animations in the refresh settle. The
 * twin of `--ease-out-strong`, `--ease-in-out-strong` and `--ease-sheet` in
 * `src/index.css`; `motion-curves.test.ts` keeps the two in step. Emil
 * Kowalski's curves, chosen by the kind of motion (`docs/reference/design.md`
 * §5): what enters, leaves or answers a press; what travels on screen; drawers.
 */
export const MOTION_CURVES = {
  outStrong: [0.23, 1, 0.32, 1],
  inOutStrong: [0.77, 0, 0.175, 1],
  sheet: [0.32, 0.72, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** One of {@link MOTION_CURVES}. */
export type MotionCurve = keyof typeof MOTION_CURVES;

/** A curve as CSS writes it — Web Animations take the same `cubic-bezier()` string. */
export function cssCurve(curve: MotionCurve): string {
  return `cubic-bezier(${MOTION_CURVES[curve].join(', ')})`;
}
