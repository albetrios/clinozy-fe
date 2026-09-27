import { useTranslation } from 'react-i18next';

import { AUTH_KEYS, AUTH_NS } from '@/shared/auth/auth-shell.constants.ts';
import { Separator } from '@/shared/components/ui/separator.tsx';
import { AUTH_FORM_TEST_IDS } from '@/shared/forms/AuthForm/auth-form.constants.ts';

/** Visual break between one-click sign-in and email credential entry. */
export function AuthMethodDivider() {
  const { t } = useTranslation(AUTH_NS);

  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3"
      data-testid={AUTH_FORM_TEST_IDS.methodDivider}
    >
      <Separator className="flex-1" />
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t(AUTH_KEYS.auth.dividerOr)}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
