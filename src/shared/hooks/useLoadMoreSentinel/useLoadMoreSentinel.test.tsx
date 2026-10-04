import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type LoadMorePaging, useLoadMoreSentinel } from './useLoadMoreSentinel.ts';

/** The observers the hook made, each with the callback it reports through. */
const observers: { callback: IntersectionObserverCallback; disconnected: boolean }[] = [];
const original = globalThis.IntersectionObserver;

beforeEach(() => {
  observers.length = 0;
  globalThis.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, disconnected: false });
    }
    observe() {}
    unobserve() {}
    disconnect() {
      const last = observers.at(-1);
      if (last) last.disconnected = true;
    }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  globalThis.IntersectionObserver = original;
});

function List(paging: LoadMorePaging) {
  const sentinel = useRef<HTMLDivElement>(null);
  useLoadMoreSentinel(sentinel, paging);
  return <div ref={sentinel} />;
}

const intersect = (isIntersecting: boolean) =>
  observers
    .at(-1)
    ?.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

describe('useLoadMoreSentinel (D7)', () => {
  it('loads the next page when the end of the list scrolls into view', () => {
    const fetchNextPage = vi.fn();
    render(<List hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />);
    intersect(false);
    expect(fetchNextPage).not.toHaveBeenCalled();
    intersect(true);
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it('watches nothing while a page loads or when there is none left', () => {
    const fetchNextPage = vi.fn();
    const { rerender } = render(
      <List hasNextPage isFetchingNextPage fetchNextPage={fetchNextPage} />,
    );
    expect(observers).toHaveLength(0);
    rerender(
      <List
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
      />,
    );
    expect(observers).toHaveLength(0);
  });

  it('watches afresh once a page lands — a short list re-checks itself', () => {
    const fetchNextPage = vi.fn();
    const { rerender } = render(
      <List hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />,
    );
    rerender(<List hasNextPage isFetchingNextPage fetchNextPage={fetchNextPage} />);
    expect(observers[0]?.disconnected).toBe(true);
    rerender(
      <List hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />,
    );
    expect(observers).toHaveLength(2);
  });
});
