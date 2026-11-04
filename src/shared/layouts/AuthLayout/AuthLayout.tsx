import './auth-layout.css';

import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { BrandLogo } from '@/shared/components/ProductMark/index.ts';
import {
  PublicAurora,
  PublicPrivacyChoices,
  PublicSkipLink,
} from '@/shared/components/PublicFrame/index.ts';
import {
  AuthControls,
  AuthForm,
} from '@/shared/layouts/AuthLayout/AuthLayout.shared.tsx';
import {
  AuthShowcasePrivacy,
  AuthShowcaseStage,
} from '@/shared/layouts/AuthLayout/components/AuthShowcase/index.ts';

interface AuthLayoutProps {
  children: ReactNode;
}

/** The screen the tour plays on by itself: the first sign-in screen. */
const TOUR_AUTOPLAY_PATH = '/login';

/**
 * The sign-in screen's layout — sign-in, MFA and the OAuth hand-off. From
 * 68.75rem it is two columns: the form's (the logo and controls, the form, the
 * privacy line, the footer) and the stage beside it, held in view while the
 * column scrolls. Below that it is one column, the form first.
 *
 * ```text
 * from 68.75rem  logo · language · theme │ ╭ stage ─────────────────╮
 *                                       │ │ kicker, title          │
 *                form                   │ │ ▬▬▬▬▬▬▬ ⏸  narration   │
 *                privacy                │ │ ┌ Today sheet ┐ + lens │
 *                © year · Privacy       │ ╰────────────────────────╯
 * below          header → form → privacy → stage → Privacy choices
 * ```
 *
 * The DOM order is header → form → stage → footer, so the tab order reaches the
 * email field before the tour's steps and pause button. The tour plays on its
 * own only on `/login`; the MFA and hand-off screens show it still. The grid
 * lives in `auth-layout.css`, which loads with this lazy chunk.
 *
 * The look is the signed-out canvas's "agent glow" (`public-canvas.css`, shared
 * with `PublicFrame`): the pastel aurora behind the whole screen, the form
 * in a glass card (the `card` slot, so the elevation axis still lifts it) whose
 * pastel halo quickens while a sign-in method is in flight, and the stage as a
 * second pane of glass.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div
      data-testid="auth-layout"
      className="auth-layout public-canvas bg-background text-foreground min-h-dvh"
    >
      <PublicAurora />
      <PublicSkipLink />
      <header className="auth-layout-header flex min-h-13 items-center justify-between gap-3 px-(--room-header-pad-x) md:min-h-15">
        <BrandLogo wordmark="always" />
        <div
          className="public-controls flex min-w-0 items-center gap-2"
          data-testid="public-frame-controls"
        >
          <AuthControls surface="frame" />
        </div>
      </header>
      <main id="main-content" className="auth-layout-main">
        <div className="auth-layout-block">
          <div
            data-slot="card"
            data-testid="auth-layout-card"
            className="auth-layout-card public-glass rounded-2xl border"
          >
            <AuthForm>{children}</AuthForm>
          </div>
          <AuthShowcasePrivacy className="mt-6 px-2" />
        </div>
      </main>
      <AuthShowcaseStage
        autoplay={pathname === TOUR_AUTOPLAY_PATH}
        className="auth-layout-stage"
      />
      <footer className="auth-layout-footer text-muted-foreground flex min-h-13 items-center gap-3 px-(--room-header-pad-x) text-xs md:min-h-15">
        <span className="auth-layout-copyright">
          © {new Date().getFullYear()} {PRODUCT_NAME}
        </span>
        <PublicPrivacyChoices />
      </footer>
    </div>
  );
}
