import { Trans, useTranslation } from 'react-i18next';

import { AUTH_KEYS, AUTH_NS } from '@/shared/auth/auth-shell.constants.ts';
import { PublicCardHeader } from '@/shared/components/PublicFrame/index.ts';

type AuthWelcomeHeaderProps = {
  className?: string;
  /** `emailVerify` — focused copy after the user commits to email OTP. */
  variant?: 'welcome' | 'emailVerify';
  /** Shown under the verify heading — the address the code was sent to. */
  email?: string;
};

/**
 * Welcome copy for the unified auth entry — the sign-in card's heading in the
 * drawer title's anatomy (`PublicCardHeader`): 18px/600 over a 13px muted line.
 */
export function AuthWelcomeHeader({
  className,
  variant = 'welcome',
  email,
}: AuthWelcomeHeaderProps) {
  const { t } = useTranslation(AUTH_NS);

  if (variant === 'emailVerify') {
    return (
      <PublicCardHeader
        className={className}
        title={t(AUTH_KEYS.auth.verify.heading)}
        description={
          email ? (
            <Trans
              ns={AUTH_NS}
              i18nKey={AUTH_KEYS.auth.email.codeSentTo}
              values={{ email }}
              components={{
                1: (
                  <span dir="ltr" className="text-foreground font-medium wrap-anywhere" />
                ),
              }}
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <PublicCardHeader
      className={className}
      title={t(AUTH_KEYS.auth.heading)}
      description={t(AUTH_KEYS.auth.subheading)}
    />
  );
}
