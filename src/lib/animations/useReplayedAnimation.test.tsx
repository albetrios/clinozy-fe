import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { REPLAYING_ATTRIBUTE, useReplayedAnimation } from './useReplayedAnimation.ts';

/** One stand-in Web Animation whose `finished` the test settles by hand. */
function controllableAnimation() {
  let finish: () => void = () => {};
  let cancel: () => void = () => {};
  const finished = new Promise<Animation>((resolve, reject) => {
    finish = () => resolve({} as Animation);
    cancel = () => reject(new DOMException('cancelled', 'AbortError'));
  });
  // A cancelled animation's rejection is expected; keep the runner quiet about it.
  finished.catch(() => {});
  return { animation: { finished } as unknown as Animation, finish, cancel };
}

function Probe({ replayKey }: { replayKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useReplayedAnimation(ref, 'animate-fade-in-up', replayKey);
  return <div ref={ref} data-testid="probe" />;
}

const element = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-testid="probe"]');

/** Settle the `Promise.allSettled(...).then(...)` chain. */
const flush = () => act(async () => {});

describe('useReplayedAnimation › data-replaying', () => {
  afterEach(() => {
    // Restore jsdom's own prototype, which has no getAnimations.
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
    vi.restoreAllMocks();
  });

  it('never marks the element when no animation runs (reduced motion, no Web Animations)', () => {
    const { container } = render(<Probe replayKey="/a" />);
    expect(element(container)).not.toHaveAttribute(REPLAYING_ATTRIBUTE);
    expect(element(container)).toHaveClass('animate-fade-in-up');
  });

  it('marks the element while the replay plays and lets go when it finishes', async () => {
    const run = controllableAnimation();
    HTMLElement.prototype.getAnimations = () => [run.animation];
    const { container } = render(<Probe replayKey="/a" />);
    expect(element(container)).toHaveAttribute(REPLAYING_ATTRIBUTE);

    run.finish();
    await flush();
    expect(element(container)).not.toHaveAttribute(REPLAYING_ATTRIBUTE);
  });

  it('lets go when the animation is cancelled', async () => {
    const run = controllableAnimation();
    HTMLElement.prototype.getAnimations = () => [run.animation];
    const { container } = render(<Probe replayKey="/a" />);

    run.cancel();
    await flush();
    expect(element(container)).not.toHaveAttribute(REPLAYING_ATTRIBUTE);
  });

  it('keeps the mark when a new replay starts before the last one settles', async () => {
    const first = controllableAnimation();
    const second = controllableAnimation();
    const getAnimations = vi
      .fn<() => Animation[]>()
      .mockReturnValueOnce([first.animation])
      .mockReturnValueOnce([second.animation]);
    HTMLElement.prototype.getAnimations = getAnimations;
    const { container, rerender } = render(<Probe replayKey="/a" />);
    rerender(<Probe replayKey="/b" />);

    // The first replay settling late must not clear the second one's mark.
    first.cancel();
    await flush();
    expect(element(container)).toHaveAttribute(REPLAYING_ATTRIBUTE);

    second.finish();
    await flush();
    expect(element(container)).not.toHaveAttribute(REPLAYING_ATTRIBUTE);
  });

  it('clears the mark on unmount', () => {
    const run = controllableAnimation();
    HTMLElement.prototype.getAnimations = () => [run.animation];
    const host = document.createElement('div');
    document.body.append(host);
    const { unmount } = render(<Probe replayKey="/a" />, { container: host });
    const probe = element(host);
    expect(probe).toHaveAttribute(REPLAYING_ATTRIBUTE);

    unmount();
    expect(probe).not.toHaveAttribute(REPLAYING_ATTRIBUTE);
    host.remove();
  });
});
