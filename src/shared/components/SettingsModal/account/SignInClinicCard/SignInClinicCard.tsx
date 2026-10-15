import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { useTranslation } from 'react-i18next';

import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { RadioGroup } from '@/shared/components/ui/radio-group.tsx';
import { useSignInClinic } from '@/shared/hooks/useSignInClinic/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

/** The radio value of "the clinic I used last" — never an organization id (`org_…`). */
export const SIGN_IN_CLINIC_AUTOMATIC = 'automatic';

/** One choice: a full-width row with its radio, a name and a muted second line. */
function SignInClinicOption({
  value,
  label,
  hint,
  testId,
}: {
  value: string;
  label: string;
  hint: string | null;
  testId: string;
}) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      data-testid={testId}
      // The focus ring is the theme's (`data-focus` reaches any `data-slot`), never a fixed one.
      data-slot="radio-row"
      className="border-border hover:bg-muted/60 data-[state=checked]:border-primary data-[state=checked]:bg-muted flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors"
    >
      <span
        aria-hidden
        data-slot="pill"
        className="border-input flex size-4 shrink-0 items-center justify-center rounded-full border"
      >
        <RadioGroupPrimitive.Indicator className="bg-primary size-2 rounded-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-body block truncate font-medium">{label}</span>
        {hint ? (
          <span className="text-muted-foreground text-caption block truncate">
            {hint}
          </span>
        ) : null}
      </span>
    </RadioGroupPrimitive.Item>
  );
}

/**
 * Settings › Account › "Clinic at sign-in" (feat-choose-default-clinic D3–D5): the clinic used
 * last (automatic, the default) or one pinned clinic. A choice saves at once and toasts; a failed
 * save moves the radio back. Absent with fewer than two clinics — there is nothing to choose.
 */
export function SignInClinicCard() {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tLayout } = useTranslation(LAYOUT_NS);
  const { clinics, pinnedId, canChoose, choose } = useSignInClinic();
  if (!canChoose) return null;

  const title = t(SETTINGS_KEYS.panels.account.signInClinicTitle);
  const current = pinnedId ?? SIGN_IN_CLINIC_AUTOMATIC;

  return (
    <SettingsCard
      title={title}
      description={t(SETTINGS_KEYS.panels.account.signInClinicDescription)}
      data-testid="sign-in-clinic-card"
    >
      <RadioGroup
        value={current}
        onValueChange={(value) => {
          if (value === current) return;
          choose(value === SIGN_IN_CLINIC_AUTOMATIC ? null : value);
        }}
        aria-label={title}
        className="gap-1.5"
      >
        <SignInClinicOption
          value={SIGN_IN_CLINIC_AUTOMATIC}
          label={tLayout(LAYOUT_KEYS.app.signInClinic.automatic)}
          hint={tLayout(LAYOUT_KEYS.app.signInClinic.automaticHint)}
          testId="sign-in-clinic-option-automatic"
        />
        {clinics.map((clinic) => (
          <SignInClinicOption
            key={clinic.id}
            value={clinic.id}
            label={clinic.name}
            hint={clinic.slug}
            testId={`sign-in-clinic-option-${clinic.slug ?? clinic.id}`}
          />
        ))}
      </RadioGroup>
    </SettingsCard>
  );
}
