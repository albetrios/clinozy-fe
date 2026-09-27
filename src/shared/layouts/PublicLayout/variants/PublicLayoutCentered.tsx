import {
  type PublicLayoutShellProps,
  PublicMain,
  PublicSkipLink,
  PublicThemeToggle,
} from '@/shared/layouts/PublicLayout/PublicLayout.shared.tsx';

/** Variant 0 — centered column (default). */
export function CenteredPublic(props: PublicLayoutShellProps) {
  return (
    <div
      className="bg-background text-foreground relative flex min-h-dvh flex-col items-center justify-center p-4 sm:p-6"
      data-testid="public-layout"
    >
      <PublicSkipLink />
      <PublicThemeToggle />
      <PublicMain {...props} />
    </div>
  );
}
