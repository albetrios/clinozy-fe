import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import routeTreeSource from '@/app/routes/routeTree.tsx?raw';
import mainSource from '@/main.tsx?raw';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { CriticalUpdateNoticeLazy } from './CriticalUpdateNoticeLazy.tsx';
import { CRITICAL_UPDATE_TEST_IDS } from './version-update.constants.ts';

const reportError = vi.hoisted(() => vi.fn());
vi.mock('@/shared/errors/errorHandler.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  reportError,
}));

describe('CriticalUpdateNoticeLazy', () => {
  afterEach(() => {
    act(() => useUIStore.setState({ criticalUpdate: null }));
    vi.doUnmock('./CriticalUpdateNotice.tsx');
    vi.resetAllMocks();
  });

  it('renders nothing — and loads nothing — while no critical update counts down', () => {
    const { container } = render(<CriticalUpdateNoticeLazy />);
    expect(container).toBeEmptyDOMElement();
  });

  it('loads and shows the notice once a critical update counts down', async () => {
    render(<CriticalUpdateNoticeLazy />);

    act(() =>
      useUIStore.getState().setCriticalUpdate({
        buildId: 'build-NEW',
        reloadAt: Date.now() + 60_000,
        reloadNow: vi.fn(),
      }),
    );

    expect(
      await screen.findByTestId(CRITICAL_UPDATE_TEST_IDS.notice),
    ).toBeInTheDocument();
  });

  // The checker reloads at the deadline whatever the notice does, so a notice
  // that cannot load costs the warning, never the update: no error card in a
  // fixed corner, just the report.
  it('stays silent, and reports, when the notice cannot render', async () => {
    vi.resetModules();
    vi.doMock('./CriticalUpdateNotice.tsx', () => ({
      CriticalUpdateNotice: () => {
        throw new Error('chunk gone');
      },
    }));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { CriticalUpdateNoticeLazy: Shell } =
      await import('./CriticalUpdateNoticeLazy.tsx');
    const { useUIStore: store } = await import('@/shared/store/useUIStore/index.ts');

    const { container } = render(<Shell />);
    act(() =>
      store.getState().setCriticalUpdate({
        buildId: 'build-NEW',
        reloadAt: Date.now() + 60_000,
        reloadNow: vi.fn(),
      }),
    );

    await vi.waitFor(() => expect(reportError).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    quiet.mockRestore();
    act(() => store.setState({ criticalUpdate: null }));
  });
});

describe('CriticalUpdateNoticeLazy — the entry chunk', () => {
  // routeTree.tsx and main.tsx ARE the entry chunk: a static import of the notice
  // there would put it on the first paint of every load, for a surface almost no
  // load ever shows (tooling/ci/run-size-limit.mjs).
  it('is what the root route mounts — never the notice itself', () => {
    expect(routeTreeSource).toContain(
      "from '@/app/version/CriticalUpdateNoticeLazy.tsx'",
    );
    expect(routeTreeSource).not.toMatch(/CriticalUpdateNotice\.tsx['"]/);
    expect(mainSource).not.toMatch(/CriticalUpdateNotice(Lazy)?\.tsx['"]/);
  });
});
