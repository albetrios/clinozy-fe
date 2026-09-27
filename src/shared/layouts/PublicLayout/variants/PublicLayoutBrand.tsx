import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { iconOnPrimarySurface } from '@/lib/icon-surface.ts';
import { cn } from '@/lib/utils.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { Boxes } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import {
  type PublicLayoutShellProps,
  PublicMain,
  PublicSkipLink,
} from '@/shared/layouts/PublicLayout/PublicLayout.shared.tsx';

/** Variant 2 — brand header strip + content. */
export function BrandPublic(props: PublicLayoutShellProps) {
  const { t } = useTranslation(LAYOUT_NS);

  return (
    <div
      className="bg-background text-foreground relative flex min-h-dvh flex-col"
      data-testid="public-layout"
    >
      <PublicSkipLink />
      <header className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-8">
        <Link to="/login" className="flex items-center gap-2.5">
          <div
            data-slot="icon-chip"
            className="bg-primary text-primary-foreground flex size-8 items-center justify-center"
          >
            <Boxes className={cn('h-4 w-4', iconOnPrimarySurface)} />
          </div>
          <span className="text-sm font-semibold">{t(LAYOUT_KEYS.brand.name)}</span>
        </Link>
        <ThemeModeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <PublicMain {...props} contentClassName="w-full max-w-md" />
      </div>
    </div>
  );
}
