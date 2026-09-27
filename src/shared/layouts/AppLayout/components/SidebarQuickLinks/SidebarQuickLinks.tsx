import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { preloadCommandPalette } from '@/shared/components/CommandPalette/index.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Search, Settings } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

const linkClassName =
  'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground h-9 w-full justify-start gap-2.5 px-3 text-sm font-medium';

/**
 * Persistent sidebar shortcuts — settings and command palette without leaving context.
 */
export function SidebarQuickLinks({ className }: { className?: string }) {
  const { t } = useTranslation(LAYOUT_NS);
  const navigate = useNavigate();
  const openPalette = () => useUIStore.getState().setCommandPaletteOpen(true);

  return (
    <div
      data-testid="sidebar-quick-links"
      className={cn('flex flex-col gap-0.5', className)}
    >
      <Button
        type="button"
        variant="ghost"
        className={linkClassName}
        data-testid="sidebar-search"
        onClick={openPalette}
        onMouseEnter={preloadCommandPalette}
        onFocus={preloadCommandPalette}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        {t(LAYOUT_KEYS.app.search)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={linkClassName}
        data-testid="sidebar-settings"
        onClick={() =>
          void navigate({ to: '.', hash: settingsHash('account', 'profile') })
        }
      >
        <Settings className="size-4 shrink-0" aria-hidden="true" />
        {t(LAYOUT_KEYS.app.settings)}
      </Button>
    </div>
  );
}
