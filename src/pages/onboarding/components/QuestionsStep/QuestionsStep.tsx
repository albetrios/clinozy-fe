import { useTranslation } from 'react-i18next';

// The field and the chips by their own modules: onboarding stays free of the other drawer controls.
import { DrawerChips } from '@/shared/components/DrawerField/drawer-chip-controls.tsx';
import { DrawerField } from '@/shared/components/DrawerField/DrawerField.tsx';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import { ONBOARDING_NS } from '../../onboarding.constants.ts';
import {
  QUESTIONS_STEP_KEYS,
  REFERRAL_OPTION_KEYS,
  TEAM_SIZE_OPTION_KEYS,
  USE_CASE_OPTION_KEYS,
} from './QuestionsStep.constants.ts';

type ChoiceField = 'teamSize' | 'primaryUseCase' | 'referralSource';

/** A chip's stable value: its key's last segment in kebab case (`twoToTen` → `two-to-ten`). */
function chipValue(optionKey: string): string {
  const last = optionKey.slice(optionKey.lastIndexOf('.') + 1);
  return last.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * One optional question: the drawer field's 12px label over the design's chip
 * group (`DrawerChips`, 24px pills on `muted`, the pick ringed in ink). One
 * pick, and tapping the picked chip clears it — the answers are optional. The
 * store keeps the chosen label, as it always has (analytics read it).
 */
function ChoiceGroup({
  label,
  optionKeys,
  value,
  onSelect,
  testId,
}: {
  label: string;
  optionKeys: readonly string[];
  value: string;
  onSelect: (value: string) => void;
  testId: string;
}) {
  const { t } = useTranslation(ONBOARDING_NS);
  const options = optionKeys.map((optionKey) => ({
    value: chipValue(optionKey),
    label: t(optionKey),
  }));
  const picked = options.find((option) => option.label === value)?.value ?? null;

  return (
    <DrawerField label={label}>
      <DrawerChips
        label={label}
        options={options}
        value={picked}
        clearable
        onChange={(next) =>
          onSelect(options.find((option) => option.value === next)?.label ?? '')
        }
        testId={testId}
      />
    </DrawerField>
  );
}

/**
 * Optional qualifying questions (team size, primary use case, referral). All
 * skippable — they segment the user and seed smart defaults, never gate the
 * flow. Answers are captured for analytics on finish (not stored server-side).
 */
export function QuestionsStep() {
  const { t } = useTranslation(ONBOARDING_NS);
  /*
   * Field-level selectors (ONB-13). `useOnboardingStore()` with no selector
   * subscribes to the whole store, and `patch` replaces the entire `data`
   * object, so this component re-rendered on every keystroke anywhere in the
   * wizard. `patch` is a stable store closure.
   */
  const teamSize = useOnboardingStore((s) => s.data.teamSize);
  const primaryUseCase = useOnboardingStore((s) => s.data.primaryUseCase);
  const referralSource = useOnboardingStore((s) => s.data.referralSource);
  const patch = useOnboardingStore((s) => s.patch);

  const patchField = (field: ChoiceField, translatedValue: string) => {
    patch({ [field]: translatedValue });
  };

  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup
        label={t(QUESTIONS_STEP_KEYS.teamSize.label)}
        optionKeys={TEAM_SIZE_OPTION_KEYS}
        value={teamSize}
        onSelect={(teamSize) => patchField('teamSize', teamSize)}
        testId={QUESTIONS_STEP_KEYS.teamSize.testId}
      />
      <ChoiceGroup
        label={t(QUESTIONS_STEP_KEYS.useCase.label)}
        optionKeys={USE_CASE_OPTION_KEYS}
        value={primaryUseCase}
        onSelect={(primaryUseCase) => patchField('primaryUseCase', primaryUseCase)}
        testId={QUESTIONS_STEP_KEYS.useCase.testId}
      />
      <ChoiceGroup
        label={t(QUESTIONS_STEP_KEYS.referral.label)}
        optionKeys={REFERRAL_OPTION_KEYS}
        value={referralSource}
        onSelect={(referralSource) => patchField('referralSource', referralSource)}
        testId={QUESTIONS_STEP_KEYS.referral.testId}
      />
    </div>
  );
}
