import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStripScroll } from './useTabStripScroll.ts';

/**
 * jsdom lays nothing out: each element reads its box from `data-*`
 * attributes, a tab's box moves with its strip's scroll offset, and the
 * offset clamps to the strip's range as a browser's does.
 */
const scrollLefts = new WeakMap<Element, number>();
const data = (element: Element) => (element as HTMLElement).dataset;
const offsetOf = (element: Element) => scrollLefts.get(element) ?? 0;
const box = (element: Element) => {
  const scrolledBy = element.parentElement ? offsetOf(element.parentElement) : 0;
  const left = Number(data(element).left ?? 0) - scrolledBy;
  const width = Number(data(element).width ?? 0);
  return { left, right: left + width, width };
};

beforeEach(() => {
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: Element,
  ) {
    return Number(data(this).scrollWidth ?? 0);
  });
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: Element,
  ) {
    return Number(data(this).width ?? 0);
  });
  vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockImplementation(function (
    this: Element,
  ) {
    return offsetOf(this);
  });
  vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(function (
    this: Element,
    value: number,
  ) {
    const range = Number(data(this).scrollWidth ?? 0) - Number(data(this).width ?? 0);
    scrollLefts.set(this, Math.min(Math.max(value, 0), Math.max(range, 0)));
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const { left, right, width } = box(this);
    return {
      left,
      right,
      width,
      top: 0,
      bottom: 36,
      height: 36,
      x: left,
      y: 0,
    } as DOMRect;
  });
});
afterEach(() => vi.restoreAllMocks());

const TABS = [
  { id: 'timeline', left: 12, width: 60 },
  { id: 'consult', left: 72, width: 96 },
  { id: 'treatment', left: 168, width: 80 },
  { id: 'checkout', left: 248, width: 76 },
] as const;

/** A 300px strip holding 336px of tabs (12px of padding each side), the open one `selected`. */
function Strip({ selected }: { selected: string }) {
  const [ref, edges] = useTabStripScroll(selected);
  return (
    <>
      <div
        ref={ref}
        role="tablist"
        aria-label="Tabs"
        data-testid="strip"
        data-left="0"
        data-width="300"
        data-scroll-width="336"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === selected}
            data-tab={tab.id}
            data-left={tab.left}
            data-width={tab.width}
          >
            {tab.id}
          </button>
        ))}
      </div>
      <output data-testid="edges">
        {`${edges.start ? 'start' : '-'} ${edges.end ? 'end' : '-'}`}
      </output>
    </>
  );
}

describe('useTabStripScroll (KICKOFF §6.13 phone, D29)', () => {
  it('says which ends hide tabs, reading a right-to-left offset the same', () => {
    render(<Strip selected="timeline" />);
    const strip = screen.getByTestId('strip');
    expect(screen.getByTestId('edges')).toHaveTextContent('- end');

    scrollLefts.set(strip, 36);
    fireEvent.scroll(strip);
    expect(screen.getByTestId('edges')).toHaveTextContent('start -');

    // A right-to-left strip scrolls towards its end through negative offsets.
    scrollLefts.set(strip, -18);
    fireEvent.scroll(strip);
    expect(screen.getByTestId('edges')).toHaveTextContent('start end');
  });

  it('keeps the open tab in view, moving the strip alone', () => {
    const { rerender } = render(<Strip selected="timeline" />);
    const strip = screen.getByTestId('strip');
    // History already shows: the strip stays at its start.
    expect(offsetOf(strip)).toBe(0);

    // Checkout ends at 324px, under the end hint: the strip scrolls to its end.
    rerender(<Strip selected="checkout" />);
    expect(offsetOf(strip)).toBe(36);
    fireEvent.scroll(strip);
    expect(screen.getByTestId('edges')).toHaveTextContent('start -');

    // Back to History, now scrolled off the start: the strip comes back.
    rerender(<Strip selected="timeline" />);
    expect(offsetOf(strip)).toBe(0);
  });
});
