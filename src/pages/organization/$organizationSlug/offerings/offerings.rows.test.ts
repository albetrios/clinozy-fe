import { describe, expect, it } from 'vitest';

import {
  ADAJAN_ID,
  OFFER_IDS,
  offeringsTabCatalogue,
  offeringsTabOffers,
  VESU_ID,
} from './__tests__/integration/offerings-tab-test-data.ts';
import {
  filterOfferingRows,
  offeringDuration,
  offeringFilterFields,
  offeringRows,
  searchOfferingRows,
  sortOfferingRows,
} from './offerings.rows.ts';

const TODAY = '2026-10-10';
const OPEN = [ADAJAN_ID, VESU_ID];
const offerings = offeringsTabCatalogue();
const offers = offeringsTabOffers();
const rows = (branchId: string | null = null) =>
  offeringRows(offerings, offers, { branchId, openBranchIds: OPEN });
const byNumber = (offeringNumber: number, list = rows()) =>
  list.find((row) => row.offeringNumber === offeringNumber);
const numbers = (list: readonly { offeringNumber: number }[]) =>
  list.map((row) => row.offeringNumber);

describe('offeringRows (Q-O2, D40)', () => {
  it('keeps the server’s order and prices in rupees for no single branch', () => {
    expect(numbers(rows())).toEqual([7, 6, 5, 4, 2, 1]);
    // Diwali glow's 15% on the ₹3,000 offer price is ₹2,550, raised to the ₹2,800 floor.
    expect(byNumber(7)?.priced).toMatchObject({
      list: 3500,
      final: 2800,
      percentOff: 20,
    });
    expect(byNumber(7)?.priced.winningOffer?.name).toBe('Diwali glow');
    // The Vesu-only fixed price counts with no branch picked and beats Diwali glow.
    expect(byNumber(5)?.priced.final).toBe(1500);
    expect(byNumber(5)?.priced.winningOffer?.id).toBe(OFFER_IDS.vesuLaunch);
    expect(byNumber(4)?.priced.final).toBe(850.5);
  });

  it('prices for one branch: an offer limited elsewhere stops counting', () => {
    const adajan = rows(ADAJAN_ID);
    expect(byNumber(5, adajan)?.priced.final).toBe(1530);
    expect(byNumber(5, adajan)?.priced.winningOffer?.id).toBe(OFFER_IDS.diwali);
  });

  it('counts only what the server calls live: a paused offer prices nothing', () => {
    expect(byNumber(1)?.priced.winningOffer).toBeNull();
    expect(byNumber(1)?.priced.final).toBe(500);
    expect(byNumber(6)?.priced.extraSessions).toBe(1);
  });

  it('chips the branches: "all" for none, else the open branches named', () => {
    expect(byNumber(7)?.branches).toEqual(['all']);
    expect(byNumber(2)?.branches).toEqual([ADAJAN_ID, VESU_ID]);
    const single = offeringRows(offerings, offers, {
      branchId: null,
      openBranchIds: [ADAJAN_ID],
    });
    expect(single.every((row) => row.branches.length === 0)).toBe(true);
  });
});

describe('offeringDuration (research gap 11)', () => {
  it('reads none for a product, the minutes otherwise', () => {
    expect(offeringDuration({ category: 'product', durationMin: 30 })).toBeNull();
    expect(offeringDuration({ category: 'treatment', durationMin: 45 })).toBe(45);
  });
});

describe('searchOfferingRows (H:5454)', () => {
  it('matches the name, the search terms and "#5"', () => {
    expect(numbers(searchOfferingRows(rows(), 'peel'))).toEqual([6, 5]);
    expect(numbers(searchOfferingRows(rows(), 'spf'))).toEqual([4]);
    expect(numbers(searchOfferingRows(rows(), '#5'))).toEqual([5]);
    expect(searchOfferingRows(rows(), undefined)).toHaveLength(6);
  });
});

describe('offeringFilterFields (offerings.md:187)', () => {
  it('offers the sections the rows hold, the offers in the server’s order, Created always', () => {
    const fields = offeringFilterFields(rows(), offers, { openBranchIds: OPEN });
    expect(Object.keys(fields)).toEqual([
      'category',
      'offer',
      'branch',
      'status',
      'created',
    ]);
    expect(fields.category).toEqual({
      kind: 'options',
      values: ['consultation', 'treatment', 'package', 'lhr', 'product'],
    });
    expect(fields.offer).toEqual({
      kind: 'options',
      values: [OFFER_IDS.diwali, OFFER_IDS.vesuLaunch, OFFER_IDS.bringAFriend],
    });
    expect(fields.branch).toEqual({
      kind: 'options',
      values: ['all', ADAJAN_ID, VESU_ID],
    });
    expect(fields.status).toEqual({ kind: 'options', values: ['active', 'inactive'] });
  });

  it('drops a section the rows show one value of', () => {
    const peels = searchOfferingRows(rows(), 'peel');
    const fields = offeringFilterFields(peels, offers, { openBranchIds: OPEN });
    expect(fields).not.toHaveProperty('branch');
    expect(fields).not.toHaveProperty('status');
    expect(fields.created).toEqual({ kind: 'date', presets: 'created' });
  });
});

describe('filterOfferingRows', () => {
  it('keeps the rows any picked chip of each section matches', () => {
    expect(
      numbers(filterOfferingRows(rows(), { category: ['package'] }, undefined, TODAY)),
    ).toEqual([6]);
    expect(
      numbers(filterOfferingRows(rows(), { status: ['inactive'] }, undefined, TODAY)),
    ).toEqual([2]);
    expect(
      numbers(
        filterOfferingRows(
          rows(),
          { branch: ['all'], offer: [OFFER_IDS.diwali] },
          undefined,
          TODAY,
        ),
      ),
    ).toEqual([7]);
    expect(
      numbers(filterOfferingRows(rows(), { branch: [VESU_ID] }, undefined, TODAY)),
    ).toEqual([6, 5, 2]);
  });

  it('keeps the rows created in the picked window', () => {
    expect(
      numbers(filterOfferingRows(rows(), {}, '2026-10-01..2026-10-10', TODAY)),
    ).toEqual([7, 6, 5, 4]);
  });
});

describe('sortOfferingRows (offerings.md:33)', () => {
  it('keeps the server’s order — newest first — without a sort', () => {
    expect(numbers(sortOfferingRows(rows(), undefined))).toEqual([7, 6, 5, 4, 2, 1]);
  });

  it('sorts by the billed price, ascending and descending', () => {
    expect(numbers(sortOfferingRows(rows(), 'price:asc'))).toEqual([1, 4, 5, 7, 2, 6]);
    expect(sortOfferingRows(rows(), 'price:desc')[0]?.offeringNumber).toBe(6);
  });

  it('sorts the ID, a product’s duration as none, and Active before Inactive', () => {
    expect(numbers(sortOfferingRows(rows(), 'seq:asc'))).toEqual([1, 2, 4, 5, 6, 7]);
    expect(sortOfferingRows(rows(), 'duration:asc')[0]?.offeringNumber).toBe(4);
    expect(sortOfferingRows(rows(), 'status:asc').at(-1)?.offeringNumber).toBe(2);
    expect(sortOfferingRows(rows(), 'status:desc')[0]?.offeringNumber).toBe(2);
    expect(numbers(sortOfferingRows(rows(), 'name:asc')).slice(0, 2)).toEqual([1, 7]);
  });
});
