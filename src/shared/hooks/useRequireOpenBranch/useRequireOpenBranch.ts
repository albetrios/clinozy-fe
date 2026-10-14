import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { setupHash } from '@/shared/components/SetupDrawer/setup-hash-grammar.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useSetupAccess } from '@/shared/hooks/useOnboardingSetup/index.ts';

/**
 * The create actions that need a branch — New booking, Walk-in, a new patient, a new bill,
 * receiving a payment (feat-clinic-setup KICKOFF §6.3; BRIEF.md:113–114). Wrap the action:
 * while the clinic has no open branch, a manager lands on the setup drawer's "Where is your
 * clinic?" over the room instead; a member keeps the action as built (its own "No open branch to
 * book at"). While the branches load, the action runs — the server still refuses it (F24).
 */
export function useRequireOpenBranch(): (action: () => void) => void {
  const navigate = useNavigate();
  const { openBranches, isPending } = useBranches();
  const { canManageSetup } = useSetupAccess();
  const hasNoOpenBranch = !isPending && openBranches.length === 0;
  return useCallback(
    (action: () => void) => {
      if (hasNoOpenBranch && canManageSetup) {
        void navigate({
          to: '.',
          hash: setupHash('location'),
          search: (previous) => previous,
        });
        return;
      }
      action();
    },
    [hasNoOpenBranch, canManageSetup, navigate],
  );
}
