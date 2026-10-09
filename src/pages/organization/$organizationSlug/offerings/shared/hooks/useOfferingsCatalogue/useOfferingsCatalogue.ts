import { useCallback, useMemo } from 'react';

import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { pricingBranch } from '@/shared/api/clinic/offerings-pricing.ts';
import type { AvatarStackPerson } from '@/shared/components/Cells/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { useOffers } from '@/shared/hooks/useOffers/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';

const NO_OFFERINGS: readonly OfferingRecord[] = [];
const NO_OFFERS: readonly OfferRecord[] = [];

/** What both Offerings tabs read: the catalogue, its offers and the clinic around them. */
export interface OfferingsCatalogue {
  /** Every live offering (the whole catalogue, KICKOFF §6.11 Lists). */
  offerings: readonly OfferingRecord[];
  /** Every live offer, in any state. */
  offers: readonly OfferRecord[];
  /** The open branches, the main branch first. */
  branches: readonly BranchOption[];
  /** Two or more open branches: only then do the Branches cells and filters show. */
  isMultiBranch: boolean;
  /** The branch prices are worked out for — the header's, when it names exactly one (H:5453). */
  pricingBranchId: string | null;
  /** The clinic-local day (`YYYY-MM-DD`) states and prices are read on. */
  today: string;
  /** The team member who last saved a record, as the Updated cell shows them. */
  savedBy: (staffId: string) => AvatarStackPerson | undefined;
  /** Either list has not answered yet. */
  isPending: boolean;
  /** Either list failed — the room keeps the last copy and offers Retry. */
  isError: boolean;
  /** Read both lists again (the list error's Retry). */
  refetch: () => void;
}

/**
 * The Offerings family's reads in one place (KICKOFF §6.11 Data): the whole
 * catalogue and every offer — read up front, searched, filtered and sorted in
 * place — the open branches, the header's pricing branch and the team for
 * the Updated cells. Failures are the room's to show (`useListLoadError`), so
 * the reads stay quiet.
 */
export function useOfferingsCatalogue(): OfferingsCatalogue {
  const offerings = useOfferings({ notifyOnError: false });
  const offers = useOffers({ notifyOnError: false });
  const { openBranches, isMultiBranch } = useBranches();
  const { preferences } = usePreferences();
  const staff = useStaffProfiles();

  const people = useMemo(
    () =>
      new Map(
        (staff.data ?? []).map((member) => [
          member.id,
          {
            id: member.id,
            name: [member.firstName, member.lastName].filter(Boolean).join(' '),
            initials: member.initials,
            tone: member.tone,
          } satisfies AvatarStackPerson,
        ]),
      ),
    [staff.data],
  );
  const savedBy = useCallback((staffId: string) => people.get(staffId), [people]);

  const { refetch: refetchOfferings } = offerings;
  const { refetch: refetchOffers } = offers;
  const refetch = useCallback(() => {
    void refetchOfferings();
    void refetchOffers();
  }, [refetchOfferings, refetchOffers]);

  return {
    offerings: offerings.data ?? NO_OFFERINGS,
    offers: offers.data ?? NO_OFFERS,
    branches: openBranches,
    isMultiBranch,
    pricingBranchId: pricingBranch(preferences.branchFilter),
    today: clinicToday(),
    savedBy,
    isPending: offerings.isPending || offers.isPending,
    isError: offerings.isError || offers.isError,
    refetch,
  };
}
