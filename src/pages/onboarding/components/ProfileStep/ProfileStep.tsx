import { useTranslation } from 'react-i18next';

import { DrawerInput } from '@/shared/components/DrawerField/drawer-text-controls.tsx';
// The field and its input by their own modules: onboarding stays free of the drawer controls.
import { DrawerField } from '@/shared/components/DrawerField/DrawerField.tsx';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import {
  ONBOARDING_KEYS,
  ONBOARDING_NS,
  ONBOARDING_TEST_IDS,
} from '../../onboarding.constants.ts';

/** Collects the user's first + last name into the onboarding store. */
export function ProfileStep() {
  const { t } = useTranslation(ONBOARDING_NS);
  /*
   * Field-level selectors (ONB-13). `useOnboardingStore()` with no selector
   * subscribes to the whole store, and `patch` replaces the entire `data`
   * object, so this component re-rendered on every keystroke anywhere in the
   * wizard. `patch` is a stable store closure.
   */
  const firstName = useOnboardingStore((s) => s.data.firstName);
  const lastName = useOnboardingStore((s) => s.data.lastName);
  const patch = useOnboardingStore((s) => s.patch);
  return (
    <div className="space-y-4">
      <DrawerField
        label={t(ONBOARDING_KEYS.profile.firstNameLabel)}
        htmlFor="ob-first-name"
      >
        <DrawerInput
          id="ob-first-name"
          value={firstName}
          onChange={(e) => patch({ firstName: e.target.value })}
          placeholder={t(ONBOARDING_KEYS.profile.firstNamePlaceholder)}
          autoComplete="given-name"
          data-testid={ONBOARDING_TEST_IDS.firstName}
        />
      </DrawerField>
      <DrawerField
        label={t(ONBOARDING_KEYS.profile.lastNameLabel)}
        htmlFor="ob-last-name"
      >
        <DrawerInput
          id="ob-last-name"
          value={lastName}
          onChange={(e) => patch({ lastName: e.target.value })}
          placeholder={t(ONBOARDING_KEYS.profile.lastNamePlaceholder)}
          autoComplete="family-name"
          data-testid={ONBOARDING_TEST_IDS.lastName}
        />
      </DrawerField>
    </div>
  );
}
