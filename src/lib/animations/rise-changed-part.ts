import { cssCurve } from './motion-curves.ts';
import { prefersReducedMotion } from './prefers-reduced-motion.ts';
import { REPLAYING_ATTRIBUTE } from './useReplayedAnimation.ts';

/** The patient file's section — what a section switch changes under its bar and rail. */
const SECTION_PART = "[data-slot='patient-file-section']";

/** What a room's routed tab changes: everything after the room toolbar. */
const UNDER_TOOLBAR_PART = "[data-slot='room-toolbar'] ~ *";

/** The page rise's own keyframes and timing (`route-rise`, 0.28s on the strong ease-out). */
const RISE: Keyframe[] = [
  { transform: 'translateY(6px)' },
  { transform: 'translateY(0)' },
];
const RISE_MS = 280;

/**
 * Rises only the part of a room a same-room move changed (`feat-payment-celebration` D13) — the
 * patient file's section, or what sits under the room toolbar — with the page rise's own motion,
 * while the header, rail and tab track stay still. Web Animations, so React's class names are
 * never touched. Nothing under reduced motion (the page rise is transform-only, and reduced
 * motion drops it too). `root` carries {@link REPLAYING_ATTRIBUTE} while it plays, so the room
 * frame clips the rise as it clips the page's.
 */
export function riseChangedPart(root: HTMLElement): void {
  if (prefersReducedMotion() || typeof root.animate !== 'function') return;
  const sections = root.querySelectorAll<HTMLElement>(SECTION_PART);
  const parts = [
    ...(sections.length > 0
      ? sections
      : root.querySelectorAll<HTMLElement>(UNDER_TOOLBAR_PART)),
  ];
  if (parts.length === 0) return;
  const easing = cssCurve('outStrong');
  const running = parts.map((part) => part.animate(RISE, { duration: RISE_MS, easing }));
  root.setAttribute(REPLAYING_ATTRIBUTE, '');
  void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
    // A page rise that started meanwhile owns the attribute until it settles.
    if ((root.getAnimations?.() ?? []).length === 0)
      root.removeAttribute(REPLAYING_ATTRIBUTE);
  });
}
