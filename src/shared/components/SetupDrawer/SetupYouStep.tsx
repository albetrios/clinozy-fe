import { useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import { fetchBranches, saveBranch } from '@/shared/api/app/branches-manage-api.ts';
import { offeringQueryKeys } from '@/shared/api/app/offerings-api.ts';
import {
  fetchOnboardingSetup,
  onboardingSetupQueryKeys,
} from '@/shared/api/app/onboarding-setup-api.ts';
import { isOnboardingSetupIncomplete } from '@/shared/api/app/onboarding-setup-contracts.ts';
import { updateMember } from '@/shared/api/organization-api.ts';
import { DrawerChips, DrawerField } from '@/shared/components/DrawerField/index.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppRoles } from '@/shared/hooks/useAppRoles/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useChangeOnboardingSetup } from '@/shared/hooks/useOnboardingSetup/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { fetchMeContext, meContextQueryKey } from '@/shared/tenancy/me-context.ts';

import { runGoLive } from './go-live.ts';
import { setupEvents } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import { branchInputOf } from './setup-location-form.ts';
import type { SetupStepProps } from './setup-step-props.ts';
import { useConsultationName } from './use-consultation-name.ts';

const K = SETUP_KEYS.steps.you;

/** The step's answer: the owner sees patients as a doctor, as a therapist, or not at all. */
export type SetupYouAnswer = 'doctor' | 'therapist' | 'no';

/**
 * Step 3, "Do you see patients yourself?" and "Go live" (KICKOFF §6.1; BRIEF.md:65–76): Yes adds
 * Doctor or Therapist to the owner as an **extra** role (Owner stays main, D15) with the main
 * branch's days and hours as theirs (D16), and makes them the branch's default doctor or therapist;
 * then the answer is saved and the clinic goes live — the Consultations first, then the server's
 * complete. A tap on an answer goes live (change-setup-one-question D7); the footer's "Go live" does
 * the same from the keyboard, and again after a refusal, which names what is missing and opens
 * that step.
 */
export function SetupYouStep({
  formId,
  titleId,
  setup,
  profile,
  onDirtyChange,
  onSaveState,
  onSaved,
}: SetupStepProps) {
  const { t } = useTranslation(SETUP_NS);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const [answer, setAnswer] = useState<SetupYouAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answeredBefore = setup.answeredSteps.includes('you');
  const { roles } = useAppRoles();
  const { openBranches } = useBranches();
  const canSetLowestPrice = useCan({ permission: 'offering:lower_price:read' });
  const consultationName = useConsultationName();
  const changeSetup = useChangeOnboardingSetup({ notifyOnError: false });

  useEffect(() => onDirtyChange(answer !== null), [answer, onDirtyChange]);

  /** Makes the owner bookable: the extra role, their hours, the branch's default. */
  const seePatients = async (as: Exclude<SetupYouAnswer, 'no'>, key: string) => {
    const role = roles.find((candidate) => candidate.isSystem && candidate.preset === as);
    if (!role) return;
    // Read fresh: a me/context cached before this workspace existed names another membership.
    const me = await queryClient.query({
      queryKey: meContextQueryKey,
      queryFn: fetchMeContext,
      staleTime: 0,
    });
    const membershipId = me.membershipId;
    if (!membershipId) return;
    const main = openBranches.find((branch) => branch.isMain) ?? openBranches[0];
    const roleIds = me.myRoles.map((held) => held.id);
    await updateMember({
      membershipId,
      change: {
        roleIds: roleIds.includes(role.id) ? roleIds : [...roleIds, role.id],
        ...(main
          ? {
              workingDays: main.workingDays,
              workStartsAt: main.opensAt,
              workEndsAt: main.closesAt,
            }
          : {}),
      },
      idempotencyKey: `${key}-role`,
    });
    const branch = (await fetchBranches()).find((candidate) => candidate.isMain);
    if (!branch) return;
    const input = branchInputOf(branch);
    try {
      await saveBranch({
        save: {
          branch,
          input:
            as === 'doctor'
              ? { ...input, defaultDoctorId: membershipId }
              : { ...input, defaultTherapistId: membershipId },
        },
        idempotencyKey: `${key}-branch-default`,
      });
    } catch (error) {
      // The branch default is a nicety: an owner not on the branch's team (a branch made in Users ›
      // Branches) is refused it, and going live does not wait on it.
      reportError(error, { scope: 'setup-branch-default' });
    }
  };

  const goLive = useAppMutation({
    mutationFn: async (chosen: SetupYouAnswer | null, action) => {
      if (chosen !== null && chosen !== 'no')
        await seePatients(chosen, action.idempotencyKey);
      if (!answeredBefore) {
        await changeSetup.mutateAsync({ answeredStepsAdd: ['you'] });
      }
      setupEvents.stepCompleted('you');
      return runGoLive({
        specialties: profile.specialties,
        nameOf: consultationName,
        canSetLowestPrice,
        idempotencyKey: action.idempotencyKey,
      });
    },
    notifyOnError: false,
    invalidateKeys: [
      meContextQueryKey,
      branchQueryKeys.all,
      offeringQueryKeys.list(organizationId),
    ],
  });

  /** Goes live with this answer — `null` only when it was saved before (a refused go-live). */
  const goLiveWith = async (chosen: SetupYouAnswer | null) => {
    if (goLive.isPending) return;
    onSaveState('saving');
    try {
      const result = await goLive.mutateAsync(chosen);
      queryClient.setQueryData(
        onboardingSetupQueryKeys.detail(organizationId),
        result.setup,
      );
      setupEvents.live();
      onSaveState('idle');
      onSaved();
    } catch (error) {
      onSaveState('failed');
      if (isOnboardingSetupIncomplete(error)) {
        // The setup read again: the drawer opens the step that is missing (KICKOFF §6.1).
        const fresh = await fetchOnboardingSetup().catch(() => setup);
        queryClient.setQueryData(onboardingSetupQueryKeys.detail(organizationId), fresh);
        const missing = Object.entries(fresh.liveChecks)
          .filter(([, passes]) => !passes)
          .map(([check]) =>
            t(SETUP_KEYS.checks[check as keyof typeof SETUP_KEYS.checks]),
          );
        notify.error(t(SETUP_KEYS.goLiveRefused, { missing: missing.join(', ') }));
        return;
      }
      notify.error(t(SETUP_KEYS.drawer.saveFailed));
    }
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Answered before (a go-live that was refused): going live again needs no new answer.
    if (answer === null && !answeredBefore) {
      setError(t(K.required));
      return;
    }
    await goLiveWith(answer);
  };

  return (
    <form
      id={formId}
      onSubmit={submit}
      noValidate
      aria-labelledby={titleId}
      className="flex flex-col gap-3"
    >
      <DrawerField error={error ?? undefined}>
        <DrawerChips<SetupYouAnswer>
          variant="button"
          label={t(K.label)}
          options={[
            { value: 'doctor', label: t(K.doctor) },
            { value: 'therapist', label: t(K.therapist) },
            { value: 'no', label: t(K.no) },
          ]}
          value={answer}
          onChange={(next) => {
            setAnswer(next);
            setError(null);
            // A tap is the answer: the clinic goes live at once (D7).
            if (next !== null) void goLiveWith(next);
          }}
          testId="setup-you"
        />
        {answer === 'no' ? (
          <p className="text-muted-foreground text-xs">{t(K.noHint)}</p>
        ) : null}
      </DrawerField>
    </form>
  );
}
