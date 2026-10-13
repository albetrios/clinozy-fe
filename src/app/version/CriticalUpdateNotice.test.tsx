import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { CriticalUpdateNotice } from './CriticalUpdateNotice.tsx';
import {
  CRITICAL_UPDATE_TEST_IDS,
  VERSION_UPDATE_KEYS,
  VERSION_UPDATE_NS,
} from './version-update.constants.ts';

const keys = VERSION_UPDATE_KEYS.required;
const text = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: VERSION_UPDATE_NS, ...options });

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

describe('CriticalUpdateNotice', () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => useUIStore.setState({ criticalUpdate: null }));
    setOnline(true);
  });

  function countDown(reloadNow = vi.fn()) {
    act(() =>
      useUIStore.getState().setCriticalUpdate({
        buildId: 'build-NEW',
        reloadAt: Date.now() + 60_000,
        reloadNow,
      }),
    );
    return reloadNow;
  }

  it('renders nothing while no critical update counts down', () => {
    const { container } = render(<CriticalUpdateNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts down to the reload, a second at a time', () => {
    vi.useFakeTimers();
    render(<CriticalUpdateNotice />);
    countDown();

    const notice = screen.getByTestId(CRITICAL_UPDATE_TEST_IDS.notice);
    expect(notice).toHaveTextContent('Update required');
    expect(notice).toHaveTextContent(text(keys.countdown, { time: '1:00' }));

    act(() => vi.advanceTimersByTime(1_000));
    expect(notice).toHaveTextContent(text(keys.countdown, { time: '0:59' }));

    act(() => vi.advanceTimersByTime(59_000));
    expect(notice).toHaveTextContent(text(keys.saveFirst));
  });

  // On a phone the sentence would truncate to "Reloading …" and lose the time, so
  // below `sm` the pill shows the bare time and the sentence only from `sm` up.
  it('keeps the time itself on a phone, where the sentence does not fit', () => {
    vi.useFakeTimers();
    render(<CriticalUpdateNotice />);
    countDown();

    const time = screen.getByTestId(CRITICAL_UPDATE_TEST_IDS.time);
    expect(time).toHaveTextContent(/^1:00$/);
    expect(time).toHaveClass('sm:hidden', 'whitespace-nowrap');
    expect(time).not.toHaveClass('truncate');

    act(() => vi.advanceTimersByTime(15_000));
    expect(time).toHaveTextContent(/^0:45$/);
  });

  it('"Update now" reloads at once', () => {
    render(<CriticalUpdateNotice />);
    const reloadNow = countDown();

    fireEvent.click(screen.getByTestId(CRITICAL_UPDATE_TEST_IDS.updateNow));

    expect(reloadNow).toHaveBeenCalledOnce();
  });

  it('cannot be dismissed: Update now is its only control', () => {
    render(<CriticalUpdateNotice />);
    countDown();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button')).toHaveTextContent(text(keys.updateNow));
  });

  it('announces the deadline once, not every tick', () => {
    vi.useFakeTimers();
    render(<CriticalUpdateNotice />);
    countDown();

    const alert = screen.getByRole('alert');
    const said = text(keys.announcement, { time: '1:00' });
    expect(alert).toHaveTextContent(said);

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(alert).toHaveTextContent(said); // fixed at mount
  });

  it('is the design notice pill, centred above the bottom stack', () => {
    render(<CriticalUpdateNotice />);
    countDown();

    const pill = screen.getByTestId(CRITICAL_UPDATE_TEST_IDS.notice);
    expect(pill).toHaveAttribute('data-slot', 'pill');
    expect(pill).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
      'rounded-full',
      'h-11',
    );
    expect(pill.className).toContain('var(--floating-bottom-offset');
  });

  // The cookie card (z-50) spans a phone's width at the bottom; at the same tier,
  // mounted after it, it would hide the deadline.
  it('sits one tier above the cookie card and the offline pill', () => {
    render(<CriticalUpdateNotice />);
    countDown();

    expect(screen.getByTestId(CRITICAL_UPDATE_TEST_IDS.notice)).toHaveClass('z-[60]');
  });

  it('gives the slot to the offline pill while offline, and comes back online', () => {
    render(<CriticalUpdateNotice />);
    countDown();

    act(() => setOnline(false));
    expect(screen.queryByTestId(CRITICAL_UPDATE_TEST_IDS.notice)).not.toBeInTheDocument();

    act(() => setOnline(true));
    expect(screen.getByTestId(CRITICAL_UPDATE_TEST_IDS.notice)).toBeInTheDocument();
  });

  it('stays out under the boot splash', () => {
    const splash = document.createElement('div');
    splash.id = 'app-splash';
    document.body.prepend(splash);
    try {
      render(<CriticalUpdateNotice />);
      countDown();
      expect(
        screen.queryByTestId(CRITICAL_UPDATE_TEST_IDS.notice),
      ).not.toBeInTheDocument();
    } finally {
      splash.remove();
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<CriticalUpdateNotice />);
    countDown();

    expect(await axe(container)).toHaveNoViolations();
  });
});
