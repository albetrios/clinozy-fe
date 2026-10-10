import { useCallback } from 'react';

import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { pricingBranch } from '@/shared/api/clinic/offerings-pricing.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { useOffers } from '@/shared/hooks/useOffers/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

const NO_OFFERINGS: readonly OfferingRecord[] = [];
const NO_OFFERS: readonly OfferRecord[] = [];

/** What both Offerings tabs read: the catalogue, its offers and the clinic around them. */
export interface OfferingsCatalogue {
  /** Every offering, active or not (the whole catalogue, KICKOFF §6.11 Lists). Money in rupees. */
  offerings: readonly OfferingRecord[];
  /** Every offer, in any status, in the server's order (live, scheduled, paused, ended). */
  offers: readonly OfferRecord[];
  /** The open branches, the main branch first. */
  branches: readonly BranchOption[];
  /** Two or more open branches: only then do the Branches cells and filters show. */
  isMultiBranch: boolean;
  /** The branch prices are worked out for — the header's, when it names exactly one (H:5453). */
  pricingBranchId: string | null;
  /** The clinic-local day (`YYYY-MM-DD`) — "Ends in 3 days", the date lists' window. */
  today: string;
  /** Either list has not answered yet. */
  isPending: boolean;
  /** Either list failed — the room keeps the last copy and offers Retry. */
  isError: boolean;
  /** Read both lists again (the list error's Retry). */
  refetch: () => void;
}

/**
 * The Offerings family's reads in one place (KICKOFF §6.11 Data): the whole catalogue and
 * every offer from clinozy-be — read up front, searched, filtered and sorted in place — the
 * open branches and the header's pricing branch. No "Updated by": the API names no one on a
 * record (G10), so the Updated cells show the time alone. Failures are the room's to show
 * (`useListLoadError`), so the reads stay quiet.
 */
export function useOfferingsCatalogue(): OfferingsCatalogue {
  const offerings = useOfferings({ notifyOnError: false });
  const offers = useOffers({ notifyOnError: false });
  const { openBranches, isMultiBranch } = useBranches();
  const { preferences } = usePreferences();

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
    isPending: offerings.isPending || offers.isPending,
    isError: offerings.isError || offers.isError,
    refetch,
  };
}
