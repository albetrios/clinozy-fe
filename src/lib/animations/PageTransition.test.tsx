import { act, render, screen } from '@testing-library/react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PageTransition } from './PageTransition.tsx';
import { markSamePageNavigation } from './same-page-navigation.ts';

const { matchesMock } = vi.hoisted(() => ({ matchesMock: vi.fn() }));
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useMatches: ({ select }: { select: (matches: unknown) => unknown }) =>
      select(matchesMock()),
  };
});

/** The router's matches for a page — and, with `dialog`, a dialog route open over it (D24). */
const at = (pathname: string, dialog?: string) => [
  { pathname, staticData: {} },
  ...(dialog ? [{ pathname: dialog, staticData: { dialog: true } }] : []),
];

interface CommitFrame {
  /** Classes on the wrapper when the commit ended — what the first frame paints. */
  classes: string[];
  /** `class` writes that landed DURING this commit; 0 = the work happens after paint. */
  classWrites: number;
}

/**
 * Watches the wrapper from a layout effect in the PARENT of `PageTransition`.
 *
 * Layout effects flush child-first within one commit and every one of them runs
 * before the browser can paint, while `useEffect` callbacks run after it. A
 * parent layout effect is therefore the last observation point still inside the
 * commit: what it sees is exactly what the user's first frame shows.
 */
function FirstFrameProbe({
  frames,
  children,
}: {
  frames: CommitFrame[];
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useLayoutEffect(() => {
    const wrapper = hostRef.current?.querySelector('[data-route]');
    if (!wrapper) return;
    frames.push({
      classes: Array.from(wrapper.classList),
      // `takeRecords()` drains synchronously, so it can only report writes made
      // earlier in THIS commit — anything an after-paint effect does is
      // invisible to it, which is precisely the distinction under test.
      classWrites: observerRef.current?.takeRecords().length ?? 0,
    });
    if (!observerRef.current) {
      observerRef.current = new MutationObserver(() => {
        // Records are read synchronously via `takeRecords()`; the callback only
        // exists because the constructor demands one.
      });
      observerRef.current.observe(wrapper, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
  });

  /*
   * Drop whatever landed after paint, so the layout read above can only ever
   * see writes from its own commit. Passive effects flush child-first too, so
   * this runs after `PageTransition`'s — which is exactly the write we want to
   * throw away, because a write that reaches here has already been painted.
   */
  useEffect(() => {
    observerRef.current?.takeRecords();
  });

  useLayoutEffect(() => () => observerRef.current?.disconnect(), []);

  return <div ref={hostRef}>{children}</div>;
}

/** Keeps local state so a remount is observable from the outside. */
function StatefulChild() {
  const [n, setN] = useState(0);
  return (
    <button type="button" data-testid="counter" onClick={() => setN((v) => v + 1)}>
      {n}
    </button>
  );
}

describe('PageTransition', () => {
  beforeEach(() => {
    matchesMock.mockReturnValue(at('/organization/acme/dashboard'));
  });

  it('renders children with readable foreground and route-rise animation class', async () => {
    renderWithProviders(
      <PageTransition>
        <p data-testid="page-copy">Dashboard copy</p>
      </PageTransition>,
    );

    const copy = await screen.findByTestId('page-copy');
    expect(copy).toHaveTextContent('Dashboard copy');
    const wrapper = copy.parentElement;
    expect(wrapper).toHaveClass('text-foreground');
    expect(wrapper).toHaveClass('animate-fade-in-up');
    expect(wrapper).not.toHaveClass('opacity-0');
  });

  describe('SHELL-6 — a route change animates, it does not remount', () => {
    it('keeps the same wrapper element and the child state across a path change', () => {
      matchesMock.mockReturnValue(at('/organization/acme/dashboard'));
      const { rerender } = render(
        <PageTransition>
          <StatefulChild />
        </PageTransition>,
      );

      const counter = screen.getByTestId('counter');
      const wrapperBefore = counter.parentElement;
      act(() => counter.click());
      expect(counter).toHaveTextContent('1');

      // Switch organization — a real path change.
      matchesMock.mockReturnValue(at('/organization/globex/dashboard'));
      rerender(
        <PageTransition>
          <StatefulChild />
        </PageTransition>,
      );

      // `key={pathname}` made both of these fail: a new key throws the element
      // away, so every widget below it remounts and its state is gone.
      expect(screen.getByTestId('counter').parentElement).toBe(wrapperBefore);
      expect(screen.getByTestId('counter')).toHaveTextContent('1');
    });

    it('takes extra classes — a flush room becomes a bounded column', () => {
      matchesMock.mockReturnValue(at('/a'));
      render(
        <PageTransition className="flex min-h-0 flex-1 flex-col">
          <p data-testid="copy">copy</p>
        </PageTransition>,
      );
      expect(screen.getByTestId('copy').parentElement).toHaveClass(
        'text-foreground',
        'flex',
        'min-h-0',
        'flex-1',
        'flex-col',
      );
    });

    it('still re-applies the animation class on a path change', () => {
      matchesMock.mockReturnValue(at('/a'));
      const { rerender } = render(
        <PageTransition>
          <p data-testid="copy">copy</p>
        </PageTransition>,
      );
      const wrapper = screen.getByTestId('copy').parentElement;
      expect(wrapper).toHaveClass('animate-fade-in-up');

      matchesMock.mockReturnValue(at('/b'));
      rerender(
        <PageTransition>
          <p data-testid="copy">copy</p>
        </PageTransition>,
      );

      // Not remounting must not mean not animating.
      expect(wrapper).toHaveClass('animate-fade-in-up');
      expect(wrapper).toHaveAttribute('data-route', '/b');
    });
  });

  describe('the animation starts inside the commit, not one frame after it', () => {
    it('has the animation class on the node the very first frame paints', () => {
      const frames: CommitFrame[] = [];
      render(
        <FirstFrameProbe frames={frames}>
          <PageTransition>
            <p data-testid="copy">copy</p>
          </PageTransition>
        </FirstFrameProbe>,
      );

      expect(frames).toHaveLength(1);
      // From `useEffect` the class only lands after paint, so the first frame
      // shows the page at rest and it then snaps back to keyframe 0 — the
      // flicker. This is the assertion that separates the two timings.
      expect(frames[0]?.classes).toContain('animate-fade-in-up');
    });

    it('replays the animation inside the route-change commit', () => {
      const frames: CommitFrame[] = [];
      matchesMock.mockReturnValue(at('/a'));
      const { rerender } = render(
        <FirstFrameProbe frames={frames}>
          <PageTransition>
            <p data-testid="copy">copy</p>
          </PageTransition>
        </FirstFrameProbe>,
      );

      matchesMock.mockReturnValue(at('/b'));
      rerender(
        <FirstFrameProbe frames={frames}>
          <PageTransition>
            <p data-testid="copy">copy</p>
          </PageTransition>
        </FirstFrameProbe>,
      );

      expect(frames).toHaveLength(2);
      // The class carries over from the previous route, so its presence alone
      // proves nothing here. What matters is that the remove + re-add that
      // RESTARTS the animation happened before this frame was painted.
      expect(frames[1]?.classes).toContain('animate-fade-in-up');
      expect(frames[1]?.classWrites).toBeGreaterThan(0);
    });
  });

  describe('a dialog route over the page (D24) is no page change', () => {
    /** Renders under the probe, then moves through `steps` — one commit each. */
    function walk(first: ReturnType<typeof at>, ...steps: ReturnType<typeof at>[]) {
      const frames: CommitFrame[] = [];
      const tree = () => (
        <FirstFrameProbe frames={frames}>
          <PageTransition>
            <p data-testid="copy">copy</p>
          </PageTransition>
        </FirstFrameProbe>
      );
      matchesMock.mockReturnValue(first);
      const { rerender } = render(tree());
      for (const step of steps) {
        matchesMock.mockReturnValue(step);
        rerender(tree());
      }
      const wrapper = screen.getByTestId('copy').parentElement;
      return { frames, wrapper };
    }

    it('holds the list still while a drawer opens over it, switches and closes', () => {
      const { frames, wrapper } = walk(
        at('/leads'),
        at('/leads', '/leads/1'),
        at('/leads', '/leads/2'),
        at('/leads'),
      );
      // Not one restart after the first paint: the list never rises under the backdrop.
      expect(frames.slice(1).map((frame) => frame.classWrites)).toEqual([0, 0, 0]);
      expect(wrapper).toHaveAttribute('data-route', '/leads');
    });

    it('keeps the section a drawer route renders over, and plays for a new page', () => {
      const { frames, wrapper } = walk(
        at('/patients/1/timeline'),
        // Edit patient renders the section it opened from, and its drawer (A-F1).
        at('/patients/1', '/patients/1/edit'),
        at('/today'),
      );
      expect(frames[1]?.classWrites).toBe(0);
      expect(frames[2]?.classWrites).toBeGreaterThan(0);
      expect(wrapper).toHaveAttribute('data-route', '/today');
    });

    it('keys a cold load on a dialog route to the page under it', () => {
      const { frames, wrapper } = walk(at('/leads', '/leads/1'), at('/leads'));
      expect(frames[1]?.classWrites).toBe(0);
      expect(wrapper).toHaveAttribute('data-route', '/leads');
    });
  });

  describe('a move within the same room (feat-payment-celebration D13)', () => {
    it('keeps the page still for a marked move, and rises for the next unmarked one', () => {
      // A new element each time: the mocked matches do not re-render on their own.
      const page = () => (
        <PageTransition>
          <p data-testid="copy">copy</p>
        </PageTransition>
      );
      matchesMock.mockReturnValue(at('/organization/acme/medical/sales'));
      const { rerender } = render(page());
      const wrapper = screen.getByTestId('copy').parentElement as HTMLElement;
      const classes = new MutationObserver(() => undefined);
      classes.observe(wrapper, { attributes: true, attributeFilter: ['class'] });

      // Another tab of the room: no replay, but the page key moves on.
      markSamePageNavigation();
      matchesMock.mockReturnValue(at('/organization/acme/medical/purchases'));
      rerender(page());
      expect(classes.takeRecords()).toHaveLength(0);
      expect(wrapper).toHaveAttribute(
        'data-route',
        '/organization/acme/medical/purchases',
      );

      // Another room: the page rises again — the mark was taken once.
      matchesMock.mockReturnValue(at('/organization/acme/patients'));
      rerender(page());
      expect(classes.takeRecords().length).toBeGreaterThan(0);
      classes.disconnect();
    });

    it('rises only what sits under the room toolbar on a marked move', () => {
      const animate = vi.fn(
        () => ({ finished: Promise.resolve() }) as unknown as Animation,
      );
      HTMLElement.prototype.animate = animate;
      const page = () => (
        <PageTransition>
          <header data-slot="room-toolbar" />
          <p data-testid="list">list</p>
        </PageTransition>
      );
      matchesMock.mockReturnValue(at('/organization/acme/stock/items'));
      const { rerender } = render(page());
      expect(animate).not.toHaveBeenCalled();

      markSamePageNavigation();
      matchesMock.mockReturnValue(at('/organization/acme/stock/purchases'));
      rerender(page());
      expect(animate.mock.contexts).toEqual([screen.getByTestId('list')]);
    });
  });
});
