import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GLIDE_COVERED_ATTRIBUTE, SelectionGlide } from './SelectionGlide.tsx';

/** jsdom lays nothing out: each test id gets the box a browser would measure. */
const BOXES: Record<
  string,
  { left: number; top: number; width: number; height: number }
> = {
  track: { left: 100, top: 50, width: 300, height: 36 },
  agenda: { left: 104, top: 54, width: 70.5, height: 28 },
  day: { left: 176.5, top: 54, width: 48, height: 28 },
  week: { left: 226.5, top: 54, width: 60, height: 28 },
};

let measured = true;

function boxOf(element: Element): DOMRect {
  const id = element.getAttribute('data-testid') ?? '';
  const box = measured ? BOXES[id] : undefined;
  const { left, top, width, height } = box ?? { left: 0, top: 0, width: 0, height: 0 };
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function Row({ current }: { current: string | null }) {
  return (
    <div data-testid="track" className="relative isolate">
      <SelectionGlide selected='[aria-current="page"]' className="bg-card rounded-md" />
      {['agenda', 'day', 'week'].map((id) => (
        <button
          key={id}
          type="button"
          data-testid={id}
          aria-current={id === current ? 'page' : undefined}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

function thumb(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[data-slot="selection-glide"]');
  if (!found) throw new Error('no glide');
  return found;
}

function placement() {
  const { style } = thumb();
  return {
    mode: thumb().getAttribute('data-glide'),
    x: style.getPropertyValue('--glide-x'),
    y: style.getPropertyValue('--glide-y'),
    width: style.getPropertyValue('--glide-w'),
    height: style.getPropertyValue('--glide-h'),
  };
}

beforeEach(() => {
  measured = true;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return boxOf(this);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SelectionGlide', () => {
  it('is a hidden, unlabelled thumb with the surface it was given', () => {
    render(<Row current="agenda" />);
    expect(thumb()).toHaveAttribute('aria-hidden', 'true');
    expect(thumb()).toHaveClass('pointer-events-none', 'bg-card', 'rounded-md');
  });

  it('sits under the selected item at once on the first paint, and covers it', () => {
    render(<Row current="agenda" />);
    expect(placement()).toEqual({
      mode: 'still',
      x: '4px',
      y: '4px',
      width: '70.5px',
      height: '28px',
    });
    expect(screen.getByTestId('agenda')).toHaveAttribute(GLIDE_COVERED_ATTRIBUTE);
  });

  it('glides when the selection moves, and hands the cover over', () => {
    const { rerender } = render(<Row current="agenda" />);
    rerender(<Row current="week" />);
    expect(placement()).toEqual({
      mode: 'glide',
      x: '126.5px',
      y: '4px',
      width: '60px',
      height: '28px',
    });
    expect(screen.getByTestId('agenda')).not.toHaveAttribute(GLIDE_COVERED_ATTRIBUTE);
    expect(screen.getByTestId('week')).toHaveAttribute(GLIDE_COVERED_ATTRIBUTE);
  });

  it('leaves a running glide alone when the row re-renders unchanged', () => {
    const { rerender } = render(<Row current="agenda" />);
    rerender(<Row current="day" />);
    const setAttribute = vi.spyOn(thumb(), 'setAttribute');
    rerender(<Row current="day" />);
    expect(setAttribute).not.toHaveBeenCalled();
    expect(placement().mode).toBe('glide');
  });

  it('fades out when nothing is selected, and fades back in where it lands', () => {
    const { rerender } = render(<Row current="agenda" />);
    rerender(<Row current={null} />);
    expect(placement().mode).toBe('gone');
    expect(screen.getByTestId('agenda')).not.toHaveAttribute(GLIDE_COVERED_ATTRIBUTE);
    rerender(<Row current="day" />);
    expect(placement()).toMatchObject({ mode: 'appear', x: '76.5px', width: '48px' });
  });

  it('measures a right-to-left row from its right padding edge', () => {
    const { rerender } = render(<Row current="agenda" />);
    const track = screen.getByTestId('track');
    track.style.direction = 'rtl';
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    rerender(<Row current="day" />);
    // The item's right edge (224.5) less the track's right padding edge (400).
    expect(placement()).toMatchObject({ mode: 'glide', x: '-175.5px', width: '48px' });
  });

  it('covers nothing without a layout, so the item keeps its own selected surface', () => {
    measured = false;
    render(<Row current="agenda" />);
    expect(thumb()).not.toHaveAttribute('data-glide');
    expect(screen.getByTestId('agenda')).not.toHaveAttribute(GLIDE_COVERED_ATTRIBUTE);
  });

  it('uncovers the item when it unmounts', () => {
    const { unmount } = render(<Row current="agenda" />);
    const agenda = screen.getByTestId('agenda');
    unmount();
    expect(agenda).not.toHaveAttribute(GLIDE_COVERED_ATTRIBUTE);
  });
});
