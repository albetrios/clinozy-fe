import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { renderWithQueryClient } from '@/tests/utils/renderWithProviders.tsx';

import { AppearancePanel } from './AppearancePanel.tsx';

// The deployment switch the panel reads, settable per test.
const platformOverrides = vi.hoisted(() => ({ themeLock: false }));
vi.mock('@/core/config/env.ts', async (importOriginal) => {
  const actual = await importOriginal<{ platformConfig: Record<string, unknown> }>();
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      get themeLock() {
        return platformOverrides.themeLock;
      },
    },
  };
});

describe('AppearancePanel — trimmed to the design', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
    platformOverrides.themeLock = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('dark');
  });

  it('holds the mode and the device’s locale cards — and nothing of the old studio', () => {
    renderWithQueryClient(<AppearancePanel />);
    const panel = screen.getByTestId('appearance-panel');

    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Mode', 'Language', 'Date & time', 'Number format']);
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument();
    expect(screen.getByTestId('language-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('text-direction-rtl')).toBeInTheDocument();
    expect(screen.getByTestId('date-time-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('time-zone-select')).toBeInTheDocument();
    expect(screen.getByTestId('money-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('currency-code-select')).toBeInTheDocument();

    // Presets, colours, fonts, shapes, icons, layout, surface — gone.
    for (const testId of [
      'named-preset-violet',
      'accent-violet',
      'base-stone',
      'font-body',
      'radius-sharp',
      'shape-pill',
      'typescale-grand',
      'density-compact',
      'icon-bold',
      'iconlib-tabler',
      'layout-width-card',
      'theme-seed-input',
      'theme-copy-link',
      'shuffle-colour',
    ]) {
      expect(screen.queryByTestId(testId), testId).not.toBeInTheDocument();
    }
  });

  it('names the modes with the Account menu’s Light · Dark · System and marks the one in use', () => {
    renderWithQueryClient(<AppearancePanel />);
    const modes = within(screen.getByRole('radiogroup', { name: 'Mode' })).getAllByRole(
      'radio',
    );
    expect(modes.map((mode) => mode.textContent)).toEqual(['Light', 'Dark', 'System']);
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'false');
  });

  it('picking a mode switches it, live', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);

    await user.click(screen.getByTestId('theme-dark'));

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the locked note in the Mode card’s place when the deployment pins the theme', () => {
    platformOverrides.themeLock = true;
    renderWithQueryClient(<AppearancePanel />);
    expect(screen.getByTestId('theme-locked')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-dark')).not.toBeInTheDocument();
    expect(screen.getByTestId('language-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('money-prefs')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithQueryClient(<AppearancePanel />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
