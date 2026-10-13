import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  changeOnboardingSetup,
  completeOnboardingSetup,
  fetchOnboardingSetup,
  onboardingSetupQueryKeys,
} from '@/shared/api/app/onboarding-setup-api.ts';
import {
  isSetupUnfinished,
  type OnboardingSetup,
  type OnboardingSetupChange,
} from '@/shared/api/app/onboarding-setup-contracts.ts';
import {
  useAppMutation,
  type WriteReportOptions,
} from '@/shared/hooks/useAppMutation/index.ts';
import { useAccessResolved, useCan } from '@/shared/hooks/useCan/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

/** How long a read setup is fresh — every write that ticks it refetches it sooner. */
const SETUP_STALE_MS = 60_000;

/**
 * Whether this member may see and run the clinic setup: a team organization, `organization:update`
 * (Owner, Admin — D19), and not a "View as" preview. `isResolved` is false until me/context and
 * the permission set have both answered — an empty unresolved list is "not known yet".
 */
export function useSetupAccess(): { canManageSetup: boolean; isResolved: boolean } {
  const canUpdate = useCan({
    permission: 'organization:update',
    teamOrganizationOnly: true,
  });
  const isResolved = useAccessResolved();
  const isPreviewing = useUIStore((state) => state.previewRole !== null);
  return { canManageSetup: isResolved && canUpdate && !isPreviewing, isResolved };
}

/**
 * The clinic's setup (`GET /app/onboarding-setup`, RC-1) — read only for a member who may manage
 * it ({@link useSetupAccess}); the drawer, the avatar ring, the account-menu row and ⌘K read this
 * one entry.
 */
export function useOnboardingSetup() {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const { canManageSetup } = useSetupAccess();
  return useQuery<OnboardingSetup>({
    queryKey: onboardingSetupQueryKeys.detail(organizationId),
    queryFn: fetchOnboardingSetup,
    enabled: canManageSetup && organizationId !== null,
    staleTime: SETUP_STALE_MS,
  });
}

/** Whether setup still asks for attention for this member (the ring, the row, ⌘K). */
export function useSetupUnfinished(): boolean {
  const { data } = useOnboardingSetup();
  return data !== undefined && isSetupUnfinished(data);
}

/** Whether a write's answer is the setup itself (the setup's own PATCH and complete). */
function isOnboardingSetupAnswer(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'guideItems' in data &&
    'answeredSteps' in data
  );
}

/**
 * Refetches the setup after every successful write while it is unfinished — a branch, an
 * offering, a membership or an appointment may tick it (KICKOFF §5 Invalidation). One subscription,
 * mounted by the setup host; a finished setup is never refetched by it.
 */
export function useSetupInvalidation(): void {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  useEffect(() => {
    const key = onboardingSetupQueryKeys.detail(organizationId);
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      // The setup's own writes answer with the setup and store it — no second read.
      if (isOnboardingSetupAnswer(event.action.data)) return;
      const setup = queryClient.getQueryData<OnboardingSetup>(key);
      if (setup === undefined || !isSetupUnfinished(setup)) return;
      void queryClient.invalidateQueries({ queryKey: key });
    });
  }, [queryClient, organizationId]);
}

/**
 * Merges one change into the setup (`PATCH /app/onboarding-setup`, RC-2) and stores the answer as
 * the setup's entry. No toast of its own — the drawer reports where it saved.
 */
export function useChangeOnboardingSetup(options: WriteReportOptions = {}) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppMutation({
    mutationFn: (change: OnboardingSetupChange, action) =>
      changeOnboardingSetup({ change, idempotencyKey: action.idempotencyKey }),
    notifyOnError: options.notifyOnError ?? true,
    onSuccess: (setup) => {
      queryClient.setQueryData(onboardingSetupQueryKeys.detail(organizationId), setup);
    },
  });
}

/**
 * Takes the clinic live (`POST /app/onboarding-setup/complete`, RC-3). The caller handles
 * `409 onboarding_setup_incomplete` in place (it opens the missing step), so no toast here.
 */
export function useCompleteOnboardingSetup() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppMutation({
    mutationFn: (_vars: undefined, action) =>
      completeOnboardingSetup({ idempotencyKey: action.idempotencyKey }),
    notifyOnError: false,
    onSuccess: (setup) => {
      queryClient.setQueryData(onboardingSetupQueryKeys.detail(organizationId), setup);
    },
  });
}
