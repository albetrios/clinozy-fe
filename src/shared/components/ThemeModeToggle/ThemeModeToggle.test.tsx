import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import { ThemeModeToggle } from './ThemeModeToggle.tsx';

const platformOverrides = vi.hoisted(() => ({ themeLock: false }));
// Devtools on, as locally: the old quick-Shuffle shortcut hid behind it. It is
// gone for good now, whatever the flags say. The theme lock is read per render,
// so a test can pin the mode.
vi.mock('@/core/config/env.ts', async (importOriginal) => {
  const actual = await importOriginal<{ platformConfig: Record<string, unknown> }>();
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      devtools: true,
      get themeLock() {
        return platformOverrides.themeLock;
      },
    },
  };
});

// Real theme store (a Zustand store works in jsdom). Plain render — the toggle
// is routing-free, so no providers are needed.
beforeEach(() => {
  platformOverrides.themeLock = false;
  useThemeStore.setState({ theme: 'system' });
});

describe('ThemeModeToggle', () => {
  it('renders a labelled trigger', () => {
    render(<ThemeModeToggle />);
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      'Toggle theme',
    );
  });

  it('is a ghost 36px icon button by default', () => {
    render(<ThemeModeToggle />);
    const trigger = screen.getByTestId('theme-toggle');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).toHaveAttribute('data-size', 'icon');
  });

  it('on the signed-out frame, is a 32px outline button with the field corner', () => {
    // The clinic header's own controls: 32px, bordered, 8px corners (`shell.md:20`).
    render(<ThemeModeToggle surface="frame" />);
    const trigger = screen.getByTestId('theme-toggle');
    expect(trigger).toHaveAttribute('data-variant', 'outline');
    expect(trigger).toHaveAttribute('data-size', 'icon-sm');
    expect(trigger).toHaveClass('rounded-lg', 'text-foreground-soft');
  });

  it('switches mode via the menu (Light / Dark / System)', async () => {
    const user = userEvent.setup();
    render(<ThemeModeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    await user.click(await screen.findByTestId('theme-dark'));
    expect(useThemeStore.getState().theme).toBe('dark');

    await user.click(screen.getByTestId('theme-toggle'));
    await user.click(await screen.findByTestId('theme-light'));
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('offers the three modes and nothing else — no Shuffle', async () => {
    const user = userEvent.setup();
    render(<ThemeModeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    const menu = await screen.findByRole('menu');

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['Light', 'Dark', 'System']);
    expect(screen.queryByTestId('theme-shuffle-menu')).not.toBeInTheDocument();
  });

  it('renders nothing on a theme-locked deployment — the mode is pinned', () => {
    platformOverrides.themeLock = true;
    // The signed-out canvas's header is where the toggle lives.
    const { container } = render(<ThemeModeToggle surface="frame" />);

    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(useThemeStore.getState().theme).toBe('system');
  });
});
