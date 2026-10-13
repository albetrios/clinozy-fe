import type { ReactNode } from 'react';

import { PublicCard, PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import {
  AuthControls,
  AuthForm,
} from '@/shared/layouts/AuthLayout/AuthLayout.shared.tsx';
import {
  AuthShowcaseBoard,
  AuthShowcaseCanvas,
  AuthShowcaseHero,
  AuthShowcasePrivacy,
} from '@/shared/layouts/AuthLayout/components/AuthShowcase/index.ts';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * The sign-in screen's layout — sign-in, MFA and the OAuth hand-off: the
 * signed-out canvas with the logo where the clinic header will draw it, the
 * language picker and the theme toggle at the end, and — since iteration
 * change-shell-polish-and-sign-in (D9, D10) — the form's 360px card beside a
 * showcase of what Clinozy is.
 *
 * ```text
 * from lg   ┌─ canvas (start column, rows 1–2) ─┐ ┌──────┐
 *           │ hero                              │ │ card │  end column,
 *           │ board (journey · moments · values)│ │privacy│ centred
 *           └───────────────────────────────────┘ └──────┘
 * below lg  hero → card + privacy → board   (one column, the DOM order)
 * ```
 *
 * The DOM order is hero → card → board, so the tab order reaches the email
 * field before anything in the showcase, which has no controls at all.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <PublicFrame
      testId="auth-layout"
      controls={<AuthControls surface="frame" />}
      className="justify-start pt-3 lg:justify-center lg:pt-2"
    >
      <div className="grid w-full max-w-xl gap-6 lg:max-w-6xl lg:grid-cols-[5fr_4fr] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-6">
        <AuthShowcaseCanvas className="lg:col-start-1 lg:row-span-2 lg:row-start-1" />
        <AuthShowcaseHero className="lg:col-start-1 lg:row-start-1 lg:px-10 lg:pt-10" />
        <div className="flex flex-col items-center gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <PublicCard>
            <AuthForm>{children}</AuthForm>
          </PublicCard>
          <AuthShowcasePrivacy className="max-w-90" />
        </div>
        <AuthShowcaseBoard className="lg:col-start-1 lg:row-start-2 lg:px-10 lg:pb-10" />
      </div>
    </PublicFrame>
  );
}
