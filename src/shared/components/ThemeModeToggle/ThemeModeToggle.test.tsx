import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import { ThemeModeToggle } from './ThemeModeToggle.tsx';

// The quick-Shuffle shortcut is a devtools affordance (env-driven, off by
// default) — enable devtools so the menu item is present to exercise.
vi.mock('@/core/config/env.ts', () => ({
  platformConfig: { devtools: true, themeLock: false },
}));

// Real theme store (a Zustand store works in jsdom). Plain render — the toggle
// is routing-free, so no providers are needed.
beforeEach(() => {
  useThemeStore.setState({ theme: 'system', preset: 'default', customTheme: null });
});

describe('ThemeModeToggle', () => {
  it('renders a labelled trigger', () => {
    render(<ThemeModeToggle />);
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      'Toggle theme',
    );
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

  it('offers a quick Shuffle that generates a custom theme', async () => {
    const user = userEvent.setup();
    render(<ThemeModeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    await user.click(await screen.findByTestId('theme-shuffle-menu'));
    expect(useThemeStore.getState().preset).toBe('custom');
  });
});
