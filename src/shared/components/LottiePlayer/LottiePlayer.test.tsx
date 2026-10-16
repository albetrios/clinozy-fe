import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const player = vi.hoisted(() => {
  const item = { totalFrames: 52, goToAndStop: vi.fn(), destroy: vi.fn() };
  return { item, loadAnimation: vi.fn(() => item) };
});

vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: { loadAnimation: player.loadAnimation },
}));

import { preloadLottiePlayer } from './lottie-player.ts';
import { LottiePlayer } from './LottiePlayer.tsx';

const DATA = { v: '5.12.2', fr: 60, ip: 0, op: 52, w: 176, h: 176, layers: [] };

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('LottiePlayer', () => {
  beforeEach(() => {
    player.loadAnimation.mockClear();
    player.item.goToAndStop.mockClear();
    player.item.destroy.mockClear();
    setReducedMotion(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('plays the animation once, as SVG, into a decorative box', async () => {
    render(<LottiePlayer animation={() => Promise.resolve(DATA)} testId="lottie" />);
    await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledTimes(1));
    const box = screen.getByTestId('lottie');
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(player.loadAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        container: box,
        renderer: 'svg',
        loop: false,
        autoplay: true,
      }),
    );
    expect(player.item.goToAndStop).not.toHaveBeenCalled();
  });

  it('hands the player its own copy of the data', async () => {
    render(<LottiePlayer animation={() => Promise.resolve(DATA)} />);
    await waitFor(() => expect(player.loadAnimation).toHaveBeenCalled());
    const given = (
      player.loadAnimation.mock.calls[0] as unknown as [{ animationData: object }]
    )[0].animationData;
    expect(given).toEqual(DATA);
    expect(given).not.toBe(DATA);
  });

  it('shows the last frame at once under reduced motion', async () => {
    setReducedMotion(true);
    render(<LottiePlayer animation={() => Promise.resolve(DATA)} />);
    await waitFor(() => expect(player.item.goToAndStop).toHaveBeenCalledWith(51, true));
    expect(player.loadAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ autoplay: false }),
    );
  });

  it('never replays on a re-render, and destroys the player on unmount', async () => {
    const animation = () => Promise.resolve(DATA);
    const { rerender, unmount } = render(<LottiePlayer animation={animation} />);
    await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledTimes(1));
    rerender(<LottiePlayer animation={animation} className="size-20" />);
    expect(player.loadAnimation).toHaveBeenCalledTimes(1);
    unmount();
    expect(player.item.destroy).toHaveBeenCalledTimes(1);
  });

  it('shows its fallback when the animation cannot load', async () => {
    render(
      <LottiePlayer
        animation={() => Promise.reject(new Error('offline'))}
        fallback={<span>Received</span>}
      />,
    );
    expect(await screen.findByText('Received')).toBeInTheDocument();
  });

  it('warms the player chunk without throwing', () => {
    expect(() => preloadLottiePlayer()).not.toThrow();
  });
});
