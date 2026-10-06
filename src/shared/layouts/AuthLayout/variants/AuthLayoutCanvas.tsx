import { PublicCard, PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import {
  AuthControls,
  AuthForm,
  type AuthLayoutShellProps,
} from '@/shared/layouts/AuthLayout/AuthLayout.shared.tsx';

/**
 * Variant 0 — the launch's sign-in screen (default; L-65): the signed-out
 * canvas with the logo where the clinic header will draw it, the language
 * picker and the theme toggle at the end, and the form in one 360px card — the
 * design's "Signed out" card (H:515).
 */
export function CanvasAuth({ children }: AuthLayoutShellProps) {
  return (
    <PublicFrame testId="auth-layout" controls={<AuthControls surface="frame" />}>
      <PublicCard>
        <AuthForm>{children}</AuthForm>
      </PublicCard>
    </PublicFrame>
  );
}
