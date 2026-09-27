import { Card, CardContent } from '@/shared/components/ui/card.tsx';
import {
  AuthControls,
  AuthForm,
  AuthHeroBadge,
  type AuthLayoutShellProps,
  BrandMark,
  SkipLink,
} from '@/shared/layouts/AuthLayout/AuthLayout.shared.tsx';

/** Variant 1 — full-bleed brand with centered card form. */
export function SpotlightAuth({ children }: AuthLayoutShellProps) {
  return (
    <div
      className="bg-brand text-brand-foreground relative flex min-h-screen flex-col overflow-hidden"
      data-testid="auth-layout"
    >
      <SkipLink />
      <div
        className="from-primary/25 via-primary/5 to-primary/20 pointer-events-none absolute inset-0 bg-gradient-to-br"
        aria-hidden="true"
      />
      <div
        className="bg-primary/30 pointer-events-none absolute top-1/2 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 flex items-center justify-between p-5 sm:p-6">
        <BrandMark />
        <AuthControls surface="brand" />
      </header>

      <main
        id="main-content"
        className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12 sm:px-6"
      >
        <div className="w-full max-w-[420px]">
          <div className="mb-6 text-center">
            <AuthHeroBadge />
          </div>
          <Card className="bg-background gap-0 py-0">
            <CardContent className="p-6 sm:p-8">
              <AuthForm>{children}</AuthForm>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
