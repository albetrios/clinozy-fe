import { useTranslation } from 'react-i18next';

import { COMMAND_MENU_KEYS, COMMAND_MENU_NS } from './command-palette.constants.ts';
import { CommandPaletteKbd } from './CommandPaletteKbd.tsx';

/**
 * The command menu's footer (H:2677): 36px inside its 1px rule, on the canvas
 * tint, 11.5px muted — "↑ ↓ move" · "↵ open" · and, at the inline end, the
 * search hint until two letters are typed. One line at every width; the hint
 * truncates.
 */
export function CommandPaletteFooter({ hint }: { hint: string | null }) {
  const { t } = useTranslation(COMMAND_MENU_NS);
  return (
    <div
      data-testid="command-palette-footer"
      className="bg-canvas text-muted-foreground text-caption box-content flex h-9 flex-none items-center gap-3.5 border-t px-3.5"
    >
      <span className="flex flex-none items-center gap-1">
        <CommandPaletteKbd>↑</CommandPaletteKbd>
        <CommandPaletteKbd>↓</CommandPaletteKbd>
        {t(COMMAND_MENU_KEYS.move)}
      </span>
      <span className="flex flex-none items-center gap-1">
        <CommandPaletteKbd>↵</CommandPaletteKbd>
        {t(COMMAND_MENU_KEYS.open)}
      </span>
      {hint ? (
        <span
          data-testid="command-palette-hint"
          className="min-w-0 flex-1 truncate text-end"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
