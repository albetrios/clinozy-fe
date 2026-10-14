import './auth-layout.css';

import type { ReactNode } from 'react';

import { BrandLogo, ProductMark } from '@/shared/components/ProductMark/index.ts';
import {
  PublicPrivacyChoices,
  PublicSkipLink,
} from '@/shared/components/PublicFrame/index.ts';
import {
  AuthControls,
  AuthForm,
} from '@/shared/layouts/AuthLayout/AuthLayout.shared.tsx';
import {
  AuthShowcaseBackdrop,
  AuthShowcaseDial,
  AuthShowcaseHero,
  AuthShowcasePrivacy,
  AuthShowcaseValues,
} from '@/shared/layouts/AuthLayout/components/AuthShowcase/index.ts';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * The sign-in screen's layout — sign-in, MFA and the OAuth hand-off. From `xl`
 * it is a split screen: a stage on the signed-out canvas (the logo, the hero,
 * the values and the journey dial) and the form docked in its own panel at the
 * inline end, full height, with the controls at its top and "Privacy choices"
 * at its foot. Below `xl` it is one column: the hero, the form's card, the
 * dial, the values.
 *
 * ```text
 * from xl   logo ·························· │ language · theme │
 *           hero          ╭── dial ──╮      │      mark        │
 *                         │  stops   │      │      form        │  the panel
 *           values        ╰──────────╯      │      privacy     │  (26–32rem)
 *                                            │  Privacy choices │
 * below xl  header → hero → card + privacy → dial + moments → values → footer
 * ```
 *
 * The DOM order is hero → form → dial → values, so the tab order reaches the
 * email field before anything in the showcase, which has no controls at all.
 * The split's grid lives in `auth-layout.css`, which loads with this lazy
 * chunk — never on the first paint.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      data-testid="auth-layout"
      className="auth-layout bg-canvas text-foreground relative isolate flex min-h-dvh flex-col"
    >
      <PublicSkipLink />
      <AuthShowcaseBackdrop className="auth-layout-backdrop" />
      <div aria-hidden="true" className="auth-layout-panel" />
      <header className="auth-layout-header flex min-h-13 flex-none items-center justify-between gap-3 px-(--room-header-pad-x) md:min-h-15">
        <BrandLogo wordmark="always" />
        <div
          className="auth-layout-controls flex min-w-0 items-center gap-2"
          data-testid="public-frame-controls"
        >
          <AuthControls surface="frame" />
        </div>
      </header>
      <main id="main-content" className="auth-layout-main flex flex-1 flex-col">
        <AuthShowcaseHero className="auth-layout-hero" />
        <div className="auth-layout-form flex flex-col items-center gap-4">
          <ProductMark className="auth-layout-mark size-10" />
          <div
            data-slot="surface"
            className="auth-layout-card bg-card w-full max-w-90 rounded-2xl border px-(--drawer-pad-x) py-7 shadow-(--elevation-card)"
          >
            <AuthForm>{children}</AuthForm>
          </div>
          <AuthShowcasePrivacy className="auth-layout-privacy max-w-90" />
        </div>
        <AuthShowcaseDial className="auth-layout-dial" />
        <AuthShowcaseValues className="auth-layout-values" />
      </main>
      <footer className="auth-layout-footer flex min-h-13 flex-none items-center justify-center px-(--room-header-pad-x) md:min-h-15">
        <PublicPrivacyChoices />
      </footer>
    </div>
  );
}
