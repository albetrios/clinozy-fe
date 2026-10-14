import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Rocket } from '@/shared/icons/index.ts';

import { ONBOARDING_KEYS, ONBOARDING_NS } from '../../onboarding.constants.ts';

interface WelcomeStepProps {
  /** Whether this flow's derived steps include naming and creating the clinic. */
  teamSetupIncluded?: boolean;
}

/**
 * First onboarding step — short pitch for the setup flow. The pitch must match
 * the steps that actually follow: only team-setup flows may promise "create
 * your first organization" — hybrid/personal flows have no such step, so they
 * get the profile-focused copy instead. No flow promises inviting the team:
 * that is the setup guide's now (clinic-setup D4). Drawn as the
 * design's 40px tile (the empty state's, in the neutral stone tone) beside the
 * 13px line.
 */
export function WelcomeStep({ teamSetupIncluded = false }: WelcomeStepProps) {
  const { t } = useTranslation(ONBOARDING_NS);
  return (
    <div className="bg-canvas flex items-start gap-3 rounded-xl border px-3.5 py-3">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          TONE_CLASSES.stone.surface,
        )}
      >
        <Rocket className="size-4.5" />
      </span>
      <p className="text-body text-muted-foreground-strong self-center text-pretty">
        {t(
          teamSetupIncluded
            ? ONBOARDING_KEYS.welcome.body
            : ONBOARDING_KEYS.welcome.bodyPersonal,
        )}
      </p>
    </div>
  );
}
