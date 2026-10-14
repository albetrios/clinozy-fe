import { type KeyboardEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { onceAsync } from '@/lib/lazy-module.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Monitor, Moon, Sun } from '@/shared/icons/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

/** The menu's chunk — fetched on the visitor's first reach for the trigger, once. */
const loadThemeModeMenu = onceAsync(() => import('./ThemeModeMenu.tsx'));

/** How the menu arrived: the module, and whether the button it replaces had focus. */
interface MenuArrival {
  module: Awaited<ReturnType<typeof loadThemeModeMenu>>;
  focusTrigger: boolean;
}

/**
 * Light / Dark / System mode toggle (shadcn-style ModeToggle). The trigger icon
 * reflects the active mode. Shared by the signed-out canvas's headers — sign-in,
 * the public pages, the organization picker and the 404 — so the mode is
 * switchable before sign-in too. The look itself is the app's one look; there
 * is nothing else to pick. A theme-locked deployment (`VITE_THEME_LOCK`) pins
 * the mode, so there the toggle renders nothing.
 *
 * The menu is its own chunk (`ThemeModeMenu`): Radix's menu, popper and
 * floating-ui are ~28 kB gzipped that every signed-out page used to fetch before
 * its first screen, for a menu most visitors never open. Until it arrives the
 * same button stands in — same look, label and test id, announced as a menu
 * button — and pointing at it, focusing it or pressing it fetches the menu; a
 * press made before it arrives opens it when it does, and focus moves to the
 * real trigger. A failed fetch leaves the button, and the next reach retries.
 */
export function ThemeModeToggle({
  surface = 'default',
}: {
  /**
   * Where the trigger sits. `frame` is the signed-out canvas's header: a 32px
   * outline button, as the clinic header draws its own controls.
   */
  surface?: 'default' | 'frame';
}) {
  const { t: tLocale } = useTranslation(LOCALE_NS);
  const theme = useThemeStore((s) => s.theme);
  const standInRef = useRef<HTMLButtonElement>(null);
  const [arrival, setArrival] = useState<MenuArrival | undefined>(() => {
    const module = loadThemeModeMenu.peek();
    return module ? { module, focusTrigger: false } : undefined;
  });
  const [openOnArrival, setOpenOnArrival] = useState(false);

  // The deployment pins the mode: nothing here may change it.
  if (platformConfig.themeLock) return null;

  let ThemeIcon = Monitor;
  if (theme === 'dark') ThemeIcon = Moon;
  else if (theme === 'light') ThemeIcon = Sun;

  // The 8px corner of the header's 32px controls (`shell.md:20`) and of the
  // language field beside it.
  const surfaceTriggerClass =
    surface === 'frame' ? 'text-foreground-soft rounded-lg' : undefined;

  const triggerProps = {
    variant: surface === 'frame' ? ('outline' as const) : ('ghost' as const),
    size: surface === 'frame' ? ('icon-sm' as const) : ('icon' as const),
    className: surfaceTriggerClass,
    'aria-label': tLocale(LOCALE_KEYS.toggleTheme),
    'data-testid': 'theme-toggle',
  };
  const icon = <ThemeIcon className="h-4 w-4" />;

  if (arrival) {
    const { ThemeModeMenu } = arrival.module;
    return (
      <ThemeModeMenu
        trigger={<Button {...triggerProps}>{icon}</Button>}
        defaultOpen={openOnArrival}
        focusTrigger={arrival.focusTrigger}
      />
    );
  }

  const fetchMenu = () => {
    loadThemeModeMenu().then(
      (module) =>
        setArrival({
          module,
          focusTrigger: document.activeElement === standInRef.current,
        }),
      // Speculative until pressed, and the button stays usable: the next reach
      // retries (`onceAsync` keeps no rejection).
      () => undefined,
    );
  };
  const openWhenReady = () => {
    setOpenOnArrival(true);
    fetchMenu();
  };

  return (
    <Button
      {...triggerProps}
      ref={standInRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={fetchMenu}
      onFocus={fetchMenu}
      // A press opens on pointerdown, as Radix's trigger does — so a menu that
      // lands between pointerdown and click still opens; Enter and Space arrive
      // as a click.
      onPointerDown={(event) => {
        if (event.button === 0) openWhenReady();
      }}
      onClick={openWhenReady}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        // Radix opens a menu on ArrowDown too.
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          openWhenReady();
        }
      }}
    >
      {icon}
    </Button>
  );
}
