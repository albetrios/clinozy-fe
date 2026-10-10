import { describe, expect, it } from 'vitest';

import { offeringRecord, offerRecord } from '@/tests/utils/offering-doubles.ts';

import { filterOfferRows, offerFilterFields, offerRows } from './offers.rows.ts';

const TODAY = '2026-10-10';
const VESU = 'brn_thsaog1i8bv6m9rd9ucoy';
const ADAJAN = 'brn_53j4b7hz7nfb0otr2d920';
const context = { openBranchIds: [ADAJAN, VESU] };

const offerings = [
  offeringRecord(),
  offeringRecord({ id: 'off_facialfacialfacial0000', name: 'D-Tan Facial' }),
];

/** Four offers in the server's order: live, scheduled, paused, ended. */
const offers = [
  offerRecord({ id: 'ofr_one', name: 'Ended first?', status: 'live', code: 'RAIN500' }),
  offerRecord({
    id: 'ofr_two',
    name: 'Peel pack',
    status: 'scheduled',
    branchIds: [VESU],
  }),
  offerRecord({
    id: 'ofr_three',
    name: 'Glow',
    status: 'paused',
    isActive: false,
    offeringIds: ['off_facialfacialfacial0000'],
  }),
  offerRecord({ id: 'ofr_four', name: 'Monsoon', status: 'ended', code: null }),
];
const names = (list: readonly { name: string }[]) => list.map((offer) => offer.name);

describe('offerRows (H:5476–5479)', () => {
  it('keeps the server’s order and its status, whatever the names or dates say', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(names(rows)).toEqual(['Ended first?', 'Peel pack', 'Glow', 'Monsoon']);
    expect(rows.map((row) => row.status)).toEqual([
      'live',
      'scheduled',
      'paused',
      'ended',
    ]);
  });

  it('searches the name, the code and the offerings’ names', () => {
    expect(names(offerRows(offers, offerings, 'rain500', context))).toEqual([
      'Ended first?',
    ]);
    expect(names(offerRows(offers, offerings, 'facial', context))).toEqual(['Glow']);
  });

  it('chips the branches: "all" for none, none with one open branch', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(rows[0]?.branches).toEqual(['all']);
    expect(rows[1]?.branches).toEqual([VESU]);
    expect(
      offerRows(offers, offerings, undefined, { openBranchIds: [VESU] })[0]?.branches,
    ).toEqual([]);
  });
});

describe('offerFilterFields and filterOfferRows (offerings.md:187)', () => {
  it('offers Branches from the rows, Status only with fewer statuses than rows, then Created', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(Object.keys(offerFilterFields(rows, context))).toEqual(['branch', 'created']);
    const more = offerRows(
      [...offers, offerRecord({ id: 'ofr_five', status: 'live' })],
      offerings,
      undefined,
      context,
    );
    expect(offerFilterFields(more, context).status).toEqual({
      kind: 'options',
      values: ['live', 'scheduled', 'paused', 'ended'],
    });
  });

  it('keeps the rows the picks match', () => {
    const rows = offerRows(offers, offerings, undefined, context);
    expect(names(filterOfferRows(rows, { status: ['ended'] }, undefined, TODAY))).toEqual(
      ['Monsoon'],
    );
    expect(names(filterOfferRows(rows, { branch: [VESU] }, undefined, TODAY))).toEqual([
      'Peel pack',
    ]);
    expect(
      names(filterOfferRows(rows, {}, '2026-10-10..2026-10-10', TODAY)),
    ).toHaveLength(4);
    expect(names(filterOfferRows(rows, {}, '2026-09-01..2026-09-30', TODAY))).toEqual([]);
  });
});
