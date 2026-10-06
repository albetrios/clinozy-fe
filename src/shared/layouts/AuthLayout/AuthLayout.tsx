import type { ReactNode } from 'react';

import { PublicCard, PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import {
  AuthControls,
  AuthForm,
} from '@/shared/layouts/AuthLayout/AuthLayout.shared.tsx';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * The sign-in screen's layout (L-65) — sign-in, MFA and the OAuth hand-off:
 * the signed-out canvas with the logo where the clinic header will draw it,
 * the language picker and the theme toggle at the end, and the form in one
 * 360px card — the design's "Signed out" card (H:515).
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <PublicFrame testId="auth-layout" controls={<AuthControls surface="frame" />}>
      <PublicCard>
        <AuthForm>{children}</AuthForm>
      </PublicCard>
    </PublicFrame>
  );
}
