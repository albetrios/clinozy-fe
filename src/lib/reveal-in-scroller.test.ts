import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revealInScroller } from './reveal-in-scroller.ts';

/** A fake box for `getBoundingClientRect`. */
const rect = (top: number, height: number) =>
  ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
  }) as DOMRect;

/** A 400px scroller at the top of the page with `section` inside, at `top` and `height`. */
function scene(top: number, height: number, overflowY = 'auto') {
  const scroller = document.createElement('div');
  scroller.style.overflowY = overflowY;
  const section = document.createElement('section');
  scroller.append(section);
  document.body.append(scroller);
  scroller.getBoundingClientRect = () => rect(0, 400);
  section.getBoundingClientRect = () => rect(top, height);
  scroller.scrollTop = 100;
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
  return { section, scrollTo };
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
    run(0);
    return 0;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('revealInScroller (H:4016 accReveal)', () => {
  it('scrolls just enough to show the end of a section that runs past the box', () => {
    const { section, scrollTo } = scene(300, 200);
    revealInScroller(section);
    // 100 scrolled + 100 past the bottom + 12 to spare.
    expect(scrollTo).toHaveBeenCalledWith({ top: 212, behavior: 'smooth' });
  });

  it('shows the top, 12px down, of a section taller than the box', () => {
    const { section, scrollTo } = scene(300, 600);
    revealInScroller(section);
    expect(scrollTo).toHaveBeenCalledWith({ top: 388, behavior: 'smooth' });
  });

  it('leaves a section already in view, and one with no scroller', () => {
    const inView = scene(50, 200);
    revealInScroller(inView.section);
    expect(inView.scrollTo).not.toHaveBeenCalled();
    document.body.replaceChildren();
    const page = scene(300, 200, 'visible');
    revealInScroller(page.section);
    expect(page.scrollTo).not.toHaveBeenCalled();
    revealInScroller(null);
  });
});
