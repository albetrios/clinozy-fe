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

  it('stays at 0 without a ResizeObserver until a width exists', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('0');
  });
});
