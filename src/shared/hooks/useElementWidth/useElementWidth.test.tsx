import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useElementWidth } from './useElementWidth.ts';

type Callback = (entries: unknown[]) => void;

/** A ResizeObserver whose callbacks the test fires by hand. */
function installResizeObserver() {
  const observers: { callback: Callback; disconnected: boolean }[] = [];
  class FakeResizeObserver {
    private readonly entry: { callback: Callback; disconnected: boolean };
    constructor(callback: Callback) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.entry.disconnected = true;
    }
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  return {
    fire: () => {
      for (const observer of observers) {
        if (!observer.disconnected) observer.callback([]);
      }
    },
    observers,
  };
}

let clientWidth = 0;
const widthSpy = vi
  .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
  .mockImplementation(() => clientWidth);

afterEach(() => {
  vi.unstubAllGlobals();
  clientWidth = 0;
});

function Probe({ tolerance }: { tolerance?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(tolerance);
  return (
    <div ref={ref} data-testid="probe">
      {width}
    </div>
  );
}

describe('useElementWidth', () => {
  it('reads the width on attach and follows resizes past the tolerance', () => {
    const resize = installResizeObserver();
    clientWidth = 640.4;
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('640');

    clientWidth = 643;
    act(() => resize.fire());
    expect(screen.getByTestId('probe')).toHaveTextContent('640');

    clientWidth = 700;
    act(() => resize.fire());
    expect(screen.getByTestId('probe')).toHaveTextContent('700');
    expect(widthSpy).toHaveBeenCalled();
  });

  it('honours a custom tolerance', () => {
    const resize = installResizeObserver();
    clientWidth = 100;
    render(<Probe tolerance={0} />);
    clientWidth = 101;
    act(() => resize.fire());
    expect(screen.getByTestId('probe')).toHaveTextContent('101');
  });

  it('disconnects its observer when the element goes away', () => {
    const resize = installResizeObserver();
    clientWidth = 300;
    const { unmount } = render(<Probe />);
    unmount();
    expect(resize.observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it('measures the height instead when asked (the Month board’s cells)', () => {
    const resize = installResizeObserver();
    let clientHeight = 124;
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockImplementation(() => clientHeight);
    function HeightProbe() {
      const [ref, height] = useElementWidth<HTMLDivElement>(2, 'height');
      return (
        <div ref={ref} data-testid="height">
          {height}
        </div>
      );
    }
    render(<HeightProbe />);
    expect(screen.getByTestId('height')).toHaveTextContent('124');
    clientHeight = 150;
    act(() => resize.fire());
    expect(screen.getByTestId('height')).toHaveTextContent('150');
    heightSpy.mockRestore();
  });

  it('stays at 0 without a ResizeObserver until a width exists', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('0');
  });
});
