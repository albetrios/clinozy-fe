import { lazy, type ReactNode, Suspense } from 'react';

import {
  loadCanvasAuth,
  loadMinimalAuth,
  loadSplitAuth,
  loadSpotlightAuth,
  preloadAllAuthLayoutVariants,
} from '@/shared/layouts/AuthLayout/auth-layout-variants.ts';
import { LayoutVariantFallback } from '@/shared/layouts/LayoutVariantFallback/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

// The loaders live in `auth-layout-variants.ts` so the route tree can warm the
// active variant without importing this layout into the entry chunk.
const CanvasAuth = lazy(() => loadCanvasAuth().then((m) => ({ default: m.CanvasAuth })));
const SplitAuth = lazy(() => loadSplitAuth().then((m) => ({ default: m.SplitAuth })));
const SpotlightAuth = lazy(() =>
  loadSpotlightAuth().then((m) => ({ default: m.SpotlightAuth })),
);
const MinimalAuth = lazy(() =>
  loadMinimalAuth().then((m) => ({ default: m.MinimalAuth })),
);

interface AuthLayoutProps {
  children: ReactNode;
}

/** Index-aligned with `AUTH_VARIANT_LOADERS`: the launch's canvas first (L-65). */
const AUTH_SHELLS = [CanvasAuth, SplitAuth, SpotlightAuth, MinimalAuth] as const;

function AuthLayoutShell({
  variant,
  children,
}: {
  variant: number;
  children: ReactNode;
}) {
  const Shell = AUTH_SHELLS[variant] ?? CanvasAuth;
  return (
    <Suspense fallback={<LayoutVariantFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

/**
 * Auth layout shell for the sign-in / sign-up surfaces. The variant index is
 * `authVariant`: 0, the default, is the launch's canvas — default, pinned (the
 * shuffle no longer rolls it), not persisted; 1–3 are the earlier previews.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const authVariant = useThemeStore((s) => s.authVariant);
  return <AuthLayoutShell variant={authVariant}>{children}</AuthLayoutShell>;
}

/* eslint-disable react-refresh/only-export-components -- test-facing preload hook */
export { preloadAllAuthLayoutVariants as preloadAuthLayoutVariants };
/* eslint-enable react-refresh/only-export-components */
