import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const { viewport } = vi.hoisted(() => ({
  viewport: { tier: 'desktop' as ViewportTier },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));
// The panel itself is covered by its own suite; stub it to keep this focused.
vi.mock('./AppearancePanel.tsx', () => ({
  AppearancePanel: () => <div data-testid="appearance-panel" />,
}));

import { AppearanceDialog } from './AppearanceDialog.tsx';

/** Render the drawer under the router (the record drawer guards navigation). */
async function renderDrawer() {
  const view = renderWithProviders(<AppearanceDialog />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe('AppearanceDialog — the drawer', () => {
  beforeEach(() => {
    viewport.tier = 'desktop';
  });
  afterEach(() => act(() => useUIStore.setState({ appearanceOpen: false })));

  it('opens as the record drawer: named, described, the body on the canvas, no footer', async () => {
    useUIStore.setState({ appearanceOpen: true });
    await renderDrawer();

    const drawer = await screen.findByRole('dialog', { name: 'Appearance' });
    expect(drawer).toBe(screen.getByTestId('appearance-dialog'));
    expect(drawer).toHaveAccessibleDescription(
      'Saved on this device — changes apply live.',
    );
    expect(screen.getByTestId('appearance-panel')).toBeInTheDocument();
    expect(screen.getByTestId('appearance-dialog-body')).toHaveClass('bg-canvas');
    // The drawers' automatic width for this form: 680px from md.
    expect(drawer.className).toContain('md:w-[min(680px,calc(100vw-56px))]');
    // Every choice applies live — no Save, no Cancel, and no Shuffle any more.
    expect(screen.queryByTestId('appearance-dialog-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-shuffle')).not.toBeInTheDocument();
  });

  it('renders nothing while closed', async () => {
    await renderDrawer();
    expect(screen.queryByTestId('appearance-dialog')).not.toBeInTheDocument();
  });

  it('starts on its title', async () => {
    useUIStore.setState({ appearanceOpen: true });
    await renderDrawer();
    await waitFor(() =>
      expect(screen.getByTestId('appearance-dialog-title')).toHaveFocus(),
    );
  });

  it.each([
    ['desktop', 'outside the drawer'],
    ['phone', 'inside the header'],
  ] as const)('closes from its × on %s (%s)', async (tier) => {
    viewport.tier = tier;
    const user = userEvent.setup();
    useUIStore.setState({ appearanceOpen: true });
    await renderDrawer();

    await user.click(await screen.findByTestId('appearance-close'));

    expect(useUIStore.getState().appearanceOpen).toBe(false);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ appearanceOpen: true });
    await renderDrawer();
    await screen.findByTestId('appearance-dialog');

    await user.keyboard('{Escape}');

    expect(useUIStore.getState().appearanceOpen).toBe(false);
  });

  it('has no accessibility violations', async () => {
    useUIStore.setState({ appearanceOpen: true });
    const { baseElement } = await renderDrawer();
    await screen.findByTestId('appearance-dialog');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
