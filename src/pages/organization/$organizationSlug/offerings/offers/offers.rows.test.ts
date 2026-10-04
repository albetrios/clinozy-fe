import { describe, expect, it } from 'vitest';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  offeringSeed,
  offerSeed,
} from '@/shared/api/clinic/fixtures/offerings.fixtures.ts';
import { branchRef } from '@/shared/api/clinic/fixtures/organization.fixtures.ts';

import { filterOfferRows, offerFilterFields, offerRows } from './offers.rows.ts';

const TODAY = clinicToday();
const OPEN = [branchRef('Adajan'), branchRef('Vesu'), branchRef('Varachha')];
const offers = offerSeed(TODAY);
const offerings = offeringSeed(TODAY);
const context = { today: TODAY, openBranchIds: OPEN };
const names = (list: readonly { name: string }[]) => list.map((offer) => offer.name);

describe('offerRows (H:5476–5479)', () => {
  it('keeps the tab’s order: Running → Scheduled → Paused → Ended, newest first in each', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(names(rows)).toEqual([
      'Navratri glow',
      'LHR launch · Vesu',
      'Peel pack + 1 free',
      'Monsoon ₹500 off',
    ]);
    expect(rows.map((row) => row.state)).toEqual(['live', 'live', 'scheduled', 'ended']);
  });

  it('puts a paused offer after the scheduled ones', () => {
    const paused = offers.map((offer) =>
      offer.name === 'Navratri glow' ? { ...offer, paused: true } : offer,
    );
    expect(names(offerRows(paused, offerings, undefined, context))).toEqual([
      'LHR launch · Vesu',
      'Peel pack + 1 free',
      'Navratri glow',
      'Monsoon ₹500 off',
    ]);
  });

  it('searches the name, the code and the offerings’ names', () => {
    expect(names(offerRows(offers, offerings, 'rain500', context))).toEqual([
      'Monsoon ₹500 off',
    ]);
    expect(names(offerRows(offers, offerings, 'facial', context))).toEqual([
      'Navratri glow',
    ]);
  });

  it('chips the branches: "all" for none', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(rows.find((row) => row.name === 'Peel pack + 1 free')?.branches).toEqual([
      'all',
    ]);
  });
});

describe('offerFilterFields and filterOfferRows (offerings.md:187)', () => {
  it('offers Branches and Status from the rows, then Created', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    const fields = offerFilterFields(rows, context);
    expect(Object.keys(fields)).toEqual(['branch', 'status', 'created']);
    expect(fields.status).toEqual({
      kind: 'options',
      values: ['live', 'scheduled', 'ended'],
    });
  });

  it('keeps the rows the picks match', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(names(filterOfferRows(rows, { status: ['ended'] }, undefined, TODAY))).toEqual(
      ['Monsoon ₹500 off'],
    );
    expect(
      names(filterOfferRows(rows, { branch: [branchRef('Vesu')] }, undefined, TODAY)),
    ).toEqual(['Navratri glow', 'LHR launch · Vesu']);
  });
});
