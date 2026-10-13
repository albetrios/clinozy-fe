import { describe, expect, it } from 'vitest';

import {
  organizationOfferCreate,
  organizationOfferEdit,
  organizationOfferingCreate,
  organizationOfferingEdit,
  organizationOfferings,
  organizationOffers,
} from './offerings-builders.ts';

describe('the Offerings room builders', () => {
  it('build the Offerings room’s tabs and the Offering drawer’s dialog routes (S:98–101)', () => {
    expect(organizationOfferings('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationOfferingCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings/create',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationOfferingEdit('acme', 'O1')).toEqual({
      to: '/organization/$organizationSlug/offerings/$offeringId/edit',
      params: { organizationSlug: 'acme', offeringId: 'O1' },
    });
    expect(organizationOffers('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings/offers',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationOfferCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/offerings/offers/create',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationOfferEdit('acme', 'X1')).toEqual({
      to: '/organization/$organizationSlug/offerings/offers/$offerId/edit',
      params: { organizationSlug: 'acme', offerId: 'X1' },
    });
  });
});
