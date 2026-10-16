import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/DrawerFooter.tsx';

/** What the steps drawer hands its open step (KICKOFF §6.1). */
export interface SetupStepProps {
  /** The step's `<form>` id — the footer's primary submits it. */
  formId: string;
  /** The open question's title — the id that labels the step's answer (change-setup-one-question D1). */
  titleId: string;
  setup: OnboardingSetup;
  profile: ClinicProfile;
  /** The step has unsaved edits — every exit asks "Discard changes?" while it does. */
  onDirtyChange: (dirty: boolean) => void;
  /** The footer's save state while the step writes. */
  onSaveState: (state: DrawerSaveState) => void;
  /** The step saved; the drawer moves to the next one. */
  onSaved: () => void;
}
