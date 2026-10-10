import {
  createFixtureOffering,
  fetchFixtureOfferings,
  fetchFixtureOffers,
  fixtureOfferingQueryKeys,
} from '@/shared/api/clinic/offerings-fixture-api.ts';
import type {
  OfferingCreateInput,
  OfferingRecord,
} from '@/shared/api/clinic/offerings-fixture-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/*
 * The fixture world's offerings and offers for the rooms still on fixtures — the Invoice drawer
 * (Payments, and its Medical sale mode) and its stacked "New offering". The Offerings room and
 * every room on clinozy-be read `useOfferings` / `useOffers`; this goes with the last fixture
 * room that bills an offering.
 */

/** Every fixture offering, active or not — what the Invoice drawer bills from. */
export function useFixtureOfferings() {
  return useAppQuery({
    queryKey: fixtureOfferingQueryKeys.offerings(),
    queryFn: fetchFixtureOfferings,
  });
}

/** Every fixture offer, in any state — the Invoice drawer's prices weigh them. */
export function useFixtureOffers() {
  return useAppQuery({
    queryKey: fixtureOfferingQueryKeys.offers(),
    queryFn: fetchFixtureOffers,
  });
}

/**
 * Create a fixture offering — the stacked "New offering" over the Invoice drawer; it brings
 * its own toast. The fixture catalogue refetches with it.
 */
export function useCreateFixtureOffering(
  options: CrudMutationOptions<OfferingRecord, OfferingCreateInput> = {},
) {
  return useAppMutation<OfferingRecord, OfferingCreateInput>({
    mutationFn: (input) => createFixtureOffering(input),
    invalidateKeys: [fixtureOfferingQueryKeys.all],
    ...options,
  });
}
