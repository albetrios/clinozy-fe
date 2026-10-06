import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LazyModule from '@/lib/lazy-module.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const transport = vi.hoisted(() => ({
  wait: vi.fn<() => Promise<void>>(),
  reset: [] as Array<() => void>,
}));

// Keep the production cache and React.lazy retry behavior; delay only transport.
vi.mock('@/lib/lazy-module.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof LazyModule>();
  return {
    ...actual,
    onceAsync: function onceAsync<T>(factory: () => Promise<T>) {
      const createLoader = () =>
        actual.onceAsync(async () => {
          await transport.wait();
          return factory();
        });
      let loader = createLoader();
      transport.reset.push(() => {
        loader = createLoader();
      });
      return Object.assign(() => loader(), { peek: () => loader.peek() });
    },
  };
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const { viewport } = vi.hoisted(() => ({
  viewport: { tier: 'desktop' as ViewportTier },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));
vi.mock('@/lib/chunk-prefetch.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuthenticatedIdleChunkPrefetch: vi.fn(),
}));
vi.mock('./AppearancePanel.tsx', () => ({
  AppearancePanel: () => <div data-testid="appearance-panel" />,
}));

import { AppearanceDialogLazy } from './AppearanceDialogLazy.tsx';

async function renderLazy() {
  const view = renderWithProviders(<AppearanceDialogLazy />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

/**
 * The drawer once its chunk is in. The first arrival imports the record drawer's
 * whole module graph cold, which can outlast the default second on a busy runner.
 */
const findDrawer = () =>
  screen.findByTestId('appearance-dialog', {}, { timeout: 10_000 });

describe('AppearanceDialogLazy', () => {
  beforeEach(() => {
    viewport.tier = 'desktop';
    transport.reset.forEach((reset) => {
      reset();
    });
    transport.wait.mockReset().mockReturnValue(new Promise<void>(() => {}));
    useUIStore.setState({ appearanceOpen: false });
  });
  afterEach(() => {
    act(() => useUIStore.setState({ appearanceOpen: false }));
    vi.restoreAllMocks();
  });

  it('does not mount or request the drawer while closed', async () => {
    await renderLazy();
    expect(screen.queryByTestId('appearance-dialog-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appearance-dialog')).not.toBeInTheDocument();
    expect(transport.wait).not.toHaveBeenCalled();
  });

  it('paints the drawer’s placeholder at once while the chunk loads: header, card bars, a status', async () => {
    useUIStore.setState({ appearanceOpen: true });
    await renderLazy();

    const pending = screen.getByTestId('appearance-dialog-pending');
    expect(pending).toHaveAttribute('aria-busy', 'true');
    expect(pending.className).toContain('md:w-[min(680px,calc(100vw-56px))]');
    expect(within(pending).getByRole('heading', { name: 'Appearance' })).toBeVisible();
    expect(within(pending).getByText(/changes apply live/i)).toBeVisible();
    expect(within(pending).getByRole('status')).toHaveTextContent('Loading');
    for (const name of ['Mode', 'Language', 'Date & time', 'Number format']) {
      expect(within(pending).getByRole('heading', { name, exact: true })).toBeVisible();
    }
    // The studio's cards are gone with it.
    for (const name of ['Theme', 'Colour', 'Type & shape', 'Icons', 'Surface & motion']) {
      expect(
        within(pending).queryByRole('heading', { name, exact: true }),
      ).not.toBeInTheDocument();
    }
  });

  it('closes on Escape before the drawer arrives', async () => {
    useUIStore.setState({ appearanceOpen: true });
    await renderLazy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUIStore.getState().appearanceOpen).toBe(false);
    expect(screen.queryByTestId('appearance-dialog-pending')).not.toBeInTheDocument();
  });

  it('closes from its backdrop, as the drawer does', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ appearanceOpen: true });
    await renderLazy();
    const backdrop = document.querySelector('[data-slot="sheet-overlay"]');
    expect(backdrop).not.toBeNull();

    await user.click(backdrop as Element);

    expect(useUIStore.getState().appearanceOpen).toBe(false);
  });

  it('swaps in the drawer without a second slide-in, and reopens without the placeholder', async () => {
    const request = deferred();
    transport.wait.mockReturnValue(request.promise);
    const user = userEvent.setup();
    useUIStore.setState({ appearanceOpen: true });
    await renderLazy();
    expect(screen.getByTestId('appearance-dialog-pending')).toBeInTheDocument();

    await act(async () => {
      request.resolve();
    });

    const drawer = await findDrawer();
    expect(screen.queryByTestId('appearance-dialog-pending')).not.toBeInTheDocument();
    expect(screen.getByTestId('appearance-panel')).toBeInTheDocument();
    // It replaced a placeholder that already slid in: no entrance replay.
    expect(drawer.style.animation).toBe('none');

    await user.click(screen.getByTestId('appearance-close'));
    expect(screen.queryByTestId('appearance-dialog')).not.toBeInTheDocument();

    act(() => useUIStore.setState({ appearanceOpen: true }));
    const reopened = await findDrawer();
    expect(screen.queryByTestId('appearance-dialog-pending')).not.toBeInTheDocument();
    // Nothing painted before it this time: it slides in as a drawer does.
    expect(reopened.style.animation).toBe('');
  });

  it('contains a failed chunk: the card retries just the chunk, and the drawer opens', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    transport.wait
      .mockRejectedValueOnce(new Error('Chunk unavailable'))
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    useUIStore.setState({ appearanceOpen: true });
    await renderLazy();

    expect(await screen.findByTestId('appearance-dialog-load-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('lazy-overlay-retry'));

    expect(await findDrawer()).toBeInTheDocument();
    await waitFor(() => expect(transport.wait).toHaveBeenCalledTimes(2));
  });

  it('has no accessibility violations while the chunk loads', async () => {
    useUIStore.setState({ appearanceOpen: true });
    const { baseElement } = await renderLazy();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
