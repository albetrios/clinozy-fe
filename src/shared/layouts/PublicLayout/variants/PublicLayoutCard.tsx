import { Outlet } from '@tanstack/react-router';

import { Card, CardContent } from '@/shared/components/ui/card.tsx';
import {
  type PublicLayoutShellProps,
  PublicSkipLink,
  PublicThemeToggle,
} from '@/shared/layouts/PublicLayout/PublicLayout.shared.tsx';

/** Variant 1 — elevated card on muted canvas. */
export function CardPublic({ header }: PublicLayoutShellProps) {
  return (
    <div
      className="bg-muted/40 text-foreground relative flex min-h-dvh flex-col items-center justify-center p-4 sm:p-6"
      data-testid="public-layout"
    >
      <PublicSkipLink />
      <PublicThemeToggle />
      <main id="public-main-content" className="w-full max-w-md">
        <Card className="gap-0 py-0">
          <CardContent className="p-6 sm:p-8">
            {header}
            <Outlet />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
