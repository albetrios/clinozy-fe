import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '@/shared/notify/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { ACCENT_COLORS, generateTheme, normalizeLook } from '@/shared/theme/index.ts';
import { renderWithQueryClient } from '@/tests/utils/renderWithProviders.tsx';

import { AppearancePanel } from './AppearancePanel.tsx';

// The two deployment switches the panel reads, settable per test.
const platformOverrides = vi.hoisted(() => ({
  themeLock: false,
  layoutWidthForced: null as string | null,
}));
vi.mock('@/core/config/env.ts', async (importOriginal) => {
  const actual = await importOriginal<{ platformConfig: Record<string, unknown> }>();
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      get themeLock() {
        return platformOverrides.themeLock;
      },
      get layoutWidthForced() {
        return platformOverrides.layoutWidthForced;
      },
    },
  };
});

describe('AppearancePanel', () => {
  beforeEach(() => {
    useThemeStore.setState({
      theme: 'system',
      preset: 'default',
      customTheme: null,
      baseId: 'neutral',
      menu: 'default',
      iconWeight: 'regular',
      iconColor: 'default',
      iconLibrary: 'lucide',
      layoutWidth: 'contained',
      seed: null,
    });
    platformOverrides.themeLock = false;
    platformOverrides.layoutWidthForced = null;
    const root = document.documentElement;
    delete root.dataset.theme;
    delete root.dataset.base;
    delete root.dataset.menu;
    delete root.dataset.iconColor;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every appearance section in a single scroll (no tabs)', () => {
    renderWithQueryClient(<AppearancePanel />);
    expect(screen.getByTestId('appearance-panel')).toBeInTheDocument();
    // No tab strip anymore — all sections are stacked.
    expect(screen.queryByTestId('appearance-tab-theme')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appearance-tab-language')).not.toBeInTheDocument();
    // Mode + colour
    expect(screen.getByTestId('named-preset-violet')).toBeInTheDocument();
    expect(screen.getByTestId('theme-dark')).toBeInTheDocument();
    expect(screen.getByTestId('accent-violet')).toBeInTheDocument();
    expect(screen.getByTestId('shuffle-colour')).toBeInTheDocument();
    // Type + icons
    expect(screen.getByTestId('font-body')).toBeInTheDocument();
    expect(screen.getByTestId('icon-bold')).toBeInTheDocument();
    expect(screen.getByTestId('iconcolor-primary')).toBeInTheDocument();
    expect(screen.getByTestId('icon-preview-star')).toBeInTheDocument();
    // Surface — and no Notifications card: every toast is the design's bar.
    expect(screen.getByTestId('layout-width-card')).toBeInTheDocument();
    expect(screen.getByTestId('layout-width-contained')).toBeInTheDocument();
    expect(screen.getByTestId('shuffle-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('toast-preview-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shuffle-notifications')).not.toBeInTheDocument();
  });

  it('renders language, text direction, date & time, and money controls', () => {
    renderWithQueryClient(<AppearancePanel />);
    expect(screen.getByTestId('language-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('language-en')).toBeInTheDocument();
    expect(screen.getByTestId('text-direction-auto')).toBeInTheDocument();
    expect(screen.getByTestId('text-direction-rtl')).toBeInTheDocument();
    expect(screen.getByTestId('date-time-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('format-locale-select')).toBeInTheDocument();
    expect(screen.getByTestId('time-zone-select')).toBeInTheDocument();
    expect(screen.getByTestId('money-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('number-style-compact')).toBeInTheDocument();
    expect(screen.getByTestId('currency-code-select')).toBeInTheDocument();
  });

  it('picking a named preset applies data-theme and clears custom look', async () => {
    const user = userEvent.setup();
    useThemeStore.setState({ preset: 'custom', customTheme: generateTheme() });
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId('named-preset-violet'));
    expect(useThemeStore.getState().preset).toBe('violet');
    expect(useThemeStore.getState().customTheme).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('violet');
  });

  it('picking an accent colour switches to the custom look', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId('accent-violet'));
    expect(useThemeStore.getState().preset).toBe('custom');
    expect(useThemeStore.getState().customTheme?.hue).toBe(290);
    expect(await screen.findByTestId('preset-custom')).toBeInTheDocument();
  });

  it('picking an icon colour applies it (orthogonal)', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId('iconcolor-muted'));
    expect(useThemeStore.getState().iconColor).toBe('muted');
    expect(document.documentElement.dataset.iconColor).toBe('muted');
  });

  it('picking content width updates the theme store', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId('layout-width-reading'));
    expect(useThemeStore.getState().layoutWidth).toBe('reading');
  });

  it.each(['shuffle-colour', 'shuffle-type', 'shuffle-surface'])(
    '%s re-rolls into a custom look',
    async (testId) => {
      const user = userEvent.setup();
      renderWithQueryClient(<AppearancePanel />);
      await user.click(screen.getByTestId(testId));
      expect(useThemeStore.getState().preset).toBe('custom');
      expect(useThemeStore.getState().customTheme).not.toBeNull();
    },
  );

  it.each([
    ['harmony-analogous', 'harmonyId', 'analogous'],
    ['intensity-vibrant', 'intensityId', 'vibrant'],
    ['radius-round', 'radiusId', 'round'],
    ['shape-pill', 'shapeId', 'pill'],
    ['typescale-grand', 'typeScaleId', 'grand'],
    ['density-airy', 'densityId', 'airy'],
    ['contrast-crisp', 'contrastId', 'crisp'],
    ['elevation-floating', 'elevationId', 'floating'],
    ['separation-shadow', 'separationId', 'shadow'],
    ['motion-snappy', 'motionId', 'snappy'],
    ['focus-glow', 'focusId', 'glow'],
  ] as const)("%s sets the look's %s", async (testId, axis, value) => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    expect(normalizeLook(useThemeStore.getState().customTheme)[axis]).not.toBe(value);
    await user.click(screen.getByTestId(testId));
    expect(normalizeLook(useThemeStore.getState().customTheme)[axis]).toBe(value);
  });

  it.each([
    ['theme-dark', 'theme', 'dark'],
    ['base-slate', 'baseId', 'slate'],
    ['menu-glass', 'menu', 'glass'],
    ['icon-bold', 'iconWeight', 'bold'],
    ['iconlib-phosphor', 'iconLibrary', 'phosphor'],
  ] as const)('%s sets %s', async (testId, field, value) => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    expect(useThemeStore.getState()[field]).not.toBe(value);
    await user.click(screen.getByTestId(testId));
    expect(useThemeStore.getState()[field]).toBe(value);
  });

  it.each([
    ['font-body', 'bodyFontId'],
    ['font-heading', 'headingFontId'],
  ] as const)("%s sets the look's %s", async (testId, axis) => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId(testId));
    await user.click(await screen.findByRole('option', { name: 'Grotesk' }));
    expect(normalizeLook(useThemeStore.getState().customTheme)[axis]).toBe('grotesk');
  });

  it('picking a chart colour moves the chart hue', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId('chart-teal'));
    expect(useThemeStore.getState().customTheme?.chartHue).toBe(
      ACCENT_COLORS.find((colour) => colour.id === 'teal')?.hue,
    );
  });

  it('applies a pasted theme code and clears the field', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.type(screen.getByTestId('theme-seed-input'), '4242');
    await user.click(screen.getByTestId('theme-seed-apply'));
    expect(useThemeStore.getState().seed).toBe(4242);
    expect(screen.getByTestId('theme-seed-input')).toHaveValue('');
  });

  it('rejects a theme code that is not a number, keeping what was typed', async () => {
    const error = vi.spyOn(notify, 'error').mockImplementation(() => '');
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.type(screen.getByTestId('theme-seed-input'), 'abc');
    await user.click(screen.getByTestId('theme-seed-apply'));
    expect(error).toHaveBeenCalledTimes(1);
    expect(useThemeStore.getState().seed).toBeNull();
    expect(screen.getByTestId('theme-seed-input')).toHaveValue('abc');
  });

  it('copies a link that reproduces the current look', async () => {
    vi.spyOn(notify, 'success').mockImplementation(() => '');
    useThemeStore.getState().applyThemeSeed(12345);
    const user = userEvent.setup();
    renderWithQueryClient(<AppearancePanel />);
    await user.click(screen.getByTestId('theme-copy-link'));
    await expect(navigator.clipboard.readText()).resolves.toBe(
      `${window.location.origin}?theme=12345`,
    );
  });

  it('shows a locked note and only the locale cards when the theme is locked', () => {
    platformOverrides.themeLock = true;
    renderWithQueryClient(<AppearancePanel />);
    expect(screen.getByTestId('theme-locked')).toBeInTheDocument();
    expect(screen.getByTestId('language-prefs')).toBeInTheDocument();
    expect(screen.getByTestId('money-prefs')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-dark')).not.toBeInTheDocument();
  });

  it('drops the content-width card when the deployment forces a width', () => {
    platformOverrides.layoutWidthForced = 'full';
    renderWithQueryClient(<AppearancePanel />);
    expect(screen.queryByTestId('layout-width-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('shuffle-surface')).toBeInTheDocument();
  });
});
