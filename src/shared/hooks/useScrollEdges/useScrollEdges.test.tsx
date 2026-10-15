import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ScrollAxis, useScrollEdges } from './useScrollEdges.ts';

/** A scroller whose geometry the test sets: its content, its box and how far it is scrolled. */
interface Geometry {
  content: number;
  box: number;
  offset: number;
}

function setGeometry(node: HTMLElement, axis: ScrollAxis, geometry: Geometry) {
  const [content, box, offset] =
    axis === 'x'
      ? ['scrollWidth', 'clientWidth', 'scrollLeft']
      : ['scrollHeight', 'clientHeight', 'scrollTop'];
  Object.defineProperty(node, content, { configurable: true, value: geometry.content });
  Object.defineProperty(node, box, { configurable: true, value: geometry.box });
  Object.defineProperty(node, offset, {
    configurable: true,
    writable: true,
    value: geometry.offset,
  });
}

function Scroller({ axis }: { axis: ScrollAxis }) {
  const { attach, start, end } = useScrollEdges(axis);
  return <div ref={attach} data-testid="scroller" data-start={start} data-end={end} />;
}

function scrollTo(axis: ScrollAxis, geometry: Geometry) {
  const node = screen.getByTestId('scroller');
  setGeometry(node, axis, geometry);
  act(() => {
    fireEvent.scroll(node);
  });
  return node;
}

describe('useScrollEdges', () => {
  it('has no edges when everything fits', () => {
    render(<Scroller axis="y" />);
    const node = scrollTo('y', { content: 200, box: 200, offset: 0 });
    expect(node).toHaveAttribute('data-start', 'false');
    expect(node).toHaveAttribute('data-end', 'false');
  });

  it('down: more below at the top, both in the middle, more above at the foot', () => {
    render(<Scroller axis="y" />);
    expect(scrollTo('y', { content: 400, box: 200, offset: 0 })).toHaveAttribute(
      'data-end',
      'true',
    );
    const middle = scrollTo('y', { content: 400, box: 200, offset: 100 });
    expect(middle).toHaveAttribute('data-start', 'true');
    expect(middle).toHaveAttribute('data-end', 'true');
    const foot = scrollTo('y', { content: 400, box: 200, offset: 200 });
    expect(foot).toHaveAttribute('data-start', 'true');
    expect(foot).toHaveAttribute('data-end', 'false');
  });

  it('sideways: reads the offset as a distance, so RTL’s negative offsets count', () => {
    render(<Scroller axis="x" />);
    const start = scrollTo('x', { content: 500, box: 300, offset: 0 });
    expect(start).toHaveAttribute('data-start', 'false');
    expect(start).toHaveAttribute('data-end', 'true');
    const rtlEnd = scrollTo('x', { content: 500, box: 300, offset: -200 });
    expect(rtlEnd).toHaveAttribute('data-start', 'true');
    expect(rtlEnd).toHaveAttribute('data-end', 'false');
  });

  it('ignores a sub-pixel remainder', () => {
    render(<Scroller axis="y" />);
    const node = scrollTo('y', { content: 200.5, box: 200, offset: 0 });
    expect(node).toHaveAttribute('data-end', 'false');
  });
});
