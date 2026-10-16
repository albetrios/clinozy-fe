import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from 'react';

/** Present on an element while {@link useReplayedAnimation}'s replay plays. */
export const REPLAYING_ATTRIBUTE = 'data-replaying';

/**
 * Replays a CSS keyframe animation on an element that STAYS MOUNTED.
 *
 * The obvious way to restart an animation is `key={something}`, and it is a
 * trap: a changed key throws the element away and mounts a new one, so every
 * piece of state below it is destroyed. That cost the app shell a chart range
 * and a carousel position on every route change (SHELL-6), and it cost the auth
 * shell the whole email→verify step — the login form rewound to "enter your
 * email" mid-navigation while the code the user had just typed was still being
 * exchanged (LOGIN-7). Nothing about replaying an animation requires destroying
 * the subtree being animated.
 *
 * `replayKey` is a signal, not a value: the body never reads it, it only decides
 * WHEN to replay. Pick it deliberately — a key that moves while a navigation is
 * still pending replays the animation on the outgoing screen.
 *
 * Layout effect, not a passive one: `useEffect` runs after the browser paints,
 * so the first frame would show the element at its resting position and snap
 * back to keyframe 0 on the next frame. `useLayoutEffect` runs inside the same
 * commit, so the first frame the user sees is already frame 0. No
 * isomorphic-layout-effect guard, matching every other layout effect here:
 * nothing in this app renders on the server (`main.tsx` is a client
 * `createRoot`) and the unit suite runs in jsdom.
 *
 * While a replay plays, the element carries {@link REPLAYING_ATTRIBUTE}, so a
 * container can react to the motion for exactly its length — the app shell's
 * room frame clips the 6px rise instead of letting it flash `<main>`'s
 * scrollbar. The attribute leaves when every animation on the element settles
 * (finished or cancelled), at once when none runs (reduced motion, no Web
 * Animations), and on cleanup — it never outlives the motion.
 */
export function useReplayedAnimation(
  ref: RefObject<HTMLElement | null>,
  animationClass: string,
  replayKey: string,
  /**
   * Asked as the key moves: false keeps the element still this time (the page transition's
   * same-room moves). Not asked on the first play.
   */
  shouldReplay?: () => boolean,
): void {
  const played = useRef(false);
  const replays = useEffectEvent(() => shouldReplay?.() ?? true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: replayKey is the replay signal, not a value the body reads — dropping it would leave the animation stuck on its first play
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (played.current && !replays()) return;
    played.current = true;
    el.classList.remove(animationClass);
    // Reading layout forces a reflow. Without it the browser coalesces the
    // remove + add into no change at all and the animation never replays.
    el.getBoundingClientRect();
    el.classList.add(animationClass);

    // `getAnimations()` flushes style, so the replay just started is in it.
    const running = el.getAnimations?.() ?? [];
    if (running.length === 0) return;
    let live = true;
    el.setAttribute(REPLAYING_ATTRIBUTE, '');
    const settle = () => {
      if (live) el.removeAttribute(REPLAYING_ATTRIBUTE);
    };
    // A cancelled animation rejects `finished`: settled all the same.
    void Promise.allSettled(running.map((animation) => animation.finished)).then(settle);
    return () => {
      // The next replay (or the unmount) owns the attribute from here.
      live = false;
      el.removeAttribute(REPLAYING_ATTRIBUTE);
    };
  }, [ref, animationClass, replayKey]);
}
