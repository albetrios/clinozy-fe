import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Counts the menu chunk's loads and holds each until the test lets it land — a
// press can then be made while the chunk is still on its way, as on a slow
// connection. Registered per test (`vi.doMock` in `freshToggle`): a hoisted
// `vi.mock` factory runs once per file, not once per module registry.
const menuLoads = { count: 0, land: Promise.resolve() };

/** Hold the next menu load until the returned function is called. */
function holdTheMenu(): () => void {
  let land: () => void = () => undefined;
  menuLoads.land = new Promise<void>((resolve) => {
    land = resolve;
  });
  return () => land();
}

/**
 * A toggle whose menu chunk has never loaded. Each test gets a module registry
 * of its own (`vi.resetModules()`), so the loader's shared promise starts empty —
 * no static import of the toggle here, or a test that loaded the menu would
 * leave it in memory for the next.
 */
async function freshToggle() {
  vi.resetModules();
  menuLoads.count = 0;
  menuLoads.land = Promise.resolve();
  vi.doMock('./ThemeModeMenu.tsx', async (importOriginal) => {
    menuLoads.count += 1;
    await menuLoads.land;
    return importOriginal();
  });
  await import('@/lib/i18n/i18n.ts');
  const { ThemeModeToggle } = await import('./ThemeModeToggle.tsx');
  const { useThemeStore } = await import('@/shared/store/useThemeStore/index.ts');
  useThemeStore.setState({ theme: 'system' });
  return { ThemeModeToggle, useThemeStore };
}

/** The menu's own trigger has replaced the stand-in (Radix marks its state). */
const menuArrived = () =>
  expect(screen.getByTestId('theme-toggle')).toHaveAttribute('data-state', 'closed');

describe('ThemeModeToggle — the menu loads on intent', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('fetches nothing until the visitor reaches for the trigger', async () => {
    const { ThemeModeToggle } = await freshToggle();
    const user = userEvent.setup();
    render(<ThemeModeToggle surface="frame" />);

    const standIn = screen.getByTestId('theme-toggle');
    expect(standIn).toHaveAttribute('aria-haspopup', 'menu');
    expect(standIn).toHaveAttribute('aria-expanded', 'false');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(menuLoads.count).toBe(0);

    await user.hover(standIn);
    await waitFor(menuArrived);
    expect(menuLoads.count).toBe(1);
    // Hovering is not pressing: the menu stays closed.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu when it arrives, for a press made before it did', async () => {
    const { ThemeModeToggle, useThemeStore } = await freshToggle();
    const land = holdTheMenu();
    const user = userEvent.setup();
    render(<ThemeModeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    land();
    await user.click(await screen.findByTestId('theme-dark'));

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('opens it from the keyboard too (ArrowDown, as Radix does)', async () => {
    const { ThemeModeToggle } = await freshToggle();
    const land = holdTheMenu();
    const user = userEvent.setup();
    render(<ThemeModeToggle />);

    await user.tab();
    await user.keyboard('{ArrowDown}');
    land();

    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('keeps keyboard focus on the trigger when the menu replaces the stand-in', async () => {
    const { ThemeModeToggle } = await freshToggle();
    const user = userEvent.setup();
    render(<ThemeModeToggle />);

    await user.tab();
    await waitFor(menuArrived);

    expect(screen.getByTestId('theme-toggle')).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
