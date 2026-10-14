import { type ReactElement, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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
 * The Light / Dark / System menu behind `ThemeModeToggle`'s trigger — a
 * chunk of its own, because Radix's menu brings its popper, floating-ui and focus
 * management (~28 kB gzipped) onto every signed-out page, for a menu most
 * visitors never open. The toggle draws the same trigger without it and loads
 * this the moment the visitor reaches for it.
 *
 * @param trigger - The toggle's button, rendered as the menu's trigger.
 * @param defaultOpen - Open at once: the visitor pressed the trigger before this
 *   chunk arrived.
 * @param focusTrigger - Move focus to the trigger on mount: the button it
 *   replaces had it, and a swap must not drop a keyboard user's place. Not when
 *   it opens at once — the open menu takes focus.
 */
export function ThemeModeMenu({
  trigger,
  defaultOpen,
  focusTrigger,
}: {
  trigger: ReactElement;
  defaultOpen: boolean;
  focusTrigger: boolean;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const setTheme = useThemeStore((s) => s.setTheme);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // An open menu takes focus itself (and gives it back to the trigger on close);
  // pulling it to the trigger then would dismiss the menu as focus left it.
  useEffect(() => {
    if (focusTrigger && !defaultOpen) triggerRef.current?.focus();
  }, [focusTrigger, defaultOpen]);

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild ref={triggerRef}>
        {trigger}
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
