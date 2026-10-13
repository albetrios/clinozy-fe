import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { Monitor, Moon, Sun } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

/**
 * Light / Dark / System mode toggle (shadcn-style ModeToggle). The trigger icon
 * reflects the active mode. Shared by the signed-out canvas's headers — sign-in,
 * the public pages, the organization picker and the 404 — so the mode is
 * switchable before sign-in too. The look itself is the app's one look; there
 * is nothing else to pick. A theme-locked deployment (`VITE_THEME_LOCK`) pins
 * the mode, so there the toggle renders nothing.
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
  const { t } = useTranslation(LAYOUT_NS);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  // The deployment pins the mode: nothing here may change it.
  if (platformConfig.themeLock) return null;

  let ThemeIcon = Monitor;
  if (theme === 'dark') ThemeIcon = Moon;
  else if (theme === 'light') ThemeIcon = Sun;

  // The 8px corner of the header's 32px controls (`shell.md:20`) and of the
  // language field beside it.
  const surfaceTriggerClass =
    surface === 'frame' ? 'text-foreground-soft rounded-lg' : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={surface === 'frame' ? 'outline' : 'ghost'}
          size={surface === 'frame' ? 'icon-sm' : 'icon'}
          className={surfaceTriggerClass}
          aria-label={tLocale(LOCALE_KEYS.toggleTheme)}
          data-testid="theme-toggle"
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')} data-testid="theme-light">
          <Sun className="me-2 h-4 w-4" /> {t(LAYOUT_KEYS.app.theme.light)}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} data-testid="theme-dark">
          <Moon className="me-2 h-4 w-4" /> {t(LAYOUT_KEYS.app.theme.dark)}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} data-testid="theme-system">
          <Monitor className="me-2 h-4 w-4" /> {t(LAYOUT_KEYS.app.theme.system)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
