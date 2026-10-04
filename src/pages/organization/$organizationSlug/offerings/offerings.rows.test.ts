import { describe, expect, it } from 'vitest';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  offeringSeed,
  offerSeed,
} from '@/shared/api/clinic/fixtures/offerings.fixtures.ts';
import { branchRef } from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';

import {
  filterOfferingRows,
  offeringFilterFields,
  offeringRows,
  searchOfferingRows,
  sortOfferingRows,
} from './offerings.rows.ts';

const TODAY = clinicToday();
const OPEN = [branchRef('Adajan'), branchRef('Vesu'), branchRef('Varachha')];
const offerings = offeringSeed(TODAY);
const offers = offerSeed(TODAY);
const rows = (branchId: string | null = null) =>
  offeringRows(offerings, offers, { branchId, today: TODAY, openBranchIds: OPEN });
const bySeq = (seq: number, list = rows()) => list.find((row) => row.seq === seq);
const seqs = (list: readonly { seq: number }[]) => list.map((row) => row.seq);

describe('offeringRows (Q-O2, D40)', () => {
  it('prices every offering for no single branch: branch-limited offers count', () => {
    expect(bySeq(274)?.priced.final).toBe(115_000);
    expect(bySeq(274)?.priced.winningOffer?.name).toBe('Navratri glow');
    expect(bySeq(268)?.priced.final).toBe(399_900);
  });

  it('prices for one branch: an offer limited elsewhere stops counting', () => {
    const varachha = rows(branchRef('Varachha'));
    expect(bySeq(274, varachha)?.priced.winningOffer).toBeNull();
    expect(bySeq(274, varachha)?.priced.final).toBe(120_000);
    expect(bySeq(268, varachha)?.priced.final).toBe(420_000);
  });

  it('chips the branches: "all" for none, else the open branches named', () => {
    expect(bySeq(270)?.branches).toEqual(['all']);
    expect(bySeq(267)?.branches).toEqual([branchRef('Adajan'), branchRef('Vesu')]);
    const single = offeringRows(offerings, offers, {
      branchId: null,
      today: TODAY,
      openBranchIds: [branchRef('Adajan')],
    });
    expect(single.every((row) => row.branches.length === 0)).toBe(true);
  });
});

describe('searchOfferingRows (H:5454)', () => {
  it('matches the name, the search terms and "#274"', () => {
    expect(seqs(searchOfferingRows(rows(), 'peel'))).toEqual([273, 272, 271]);
    expect(seqs(searchOfferingRows(rows(), '#274'))).toEqual([274]);
    expect(searchOfferingRows(rows(), undefined)).toHaveLength(11);
  });
});

describe('offeringFilterFields (offerings.md:187)', () => {
  it('offers the sections the rows hold, Created always', () => {
    const fields = offeringFilterFields(rows(), offers, {
      today: TODAY,
      openBranchIds: OPEN,
    });
    expect(Object.keys(fields)).toEqual([
      'category',
      'offer',
      'branch',
      'status',
      'created',
    ]);
    expect(fields.category).toEqual({
      kind: 'options',
      values: ['consultation', 'treatment', 'package', 'lhr'],
    });
    expect(fields.offer).toEqual({
      kind: 'options',
      values: [ref.offer(31), ref.offer(30)],
    });
    expect(fields.status).toEqual({ kind: 'options', values: ['active', 'inactive'] });
  });

  it('drops a section the rows show one value of', () => {
    const peels = searchOfferingRows(rows(), 'peel');
    const fields = offeringFilterFields(peels, offers, {
      today: TODAY,
      openBranchIds: OPEN,
    });
    expect(fields).not.toHaveProperty('offer');
    expect(fields).not.toHaveProperty('branch');
    expect(fields.created).toEqual({ kind: 'date', presets: 'created' });
  });
});

describe('filterOfferingRows', () => {
  it('keeps the rows any picked chip of each section matches', () => {
    expect(
      seqs(filterOfferingRows(rows(), { category: ['package'] }, undefined, TODAY)),
    ).toEqual(expect.arrayContaining([273, 268, 263]));
    expect(
      seqs(filterOfferingRows(rows(), { status: ['inactive'] }, undefined, TODAY)),
    ).toEqual([272]);
    expect(
      seqs(
        filterOfferingRows(
          rows(),
          { branch: ['all'], offer: [ref.offer(31)] },
          undefined,
          TODAY,
        ),
      ),
    ).toEqual([274, 272, 271]);
    expect(
      filterOfferingRows(rows(), {}, 'today', TODAY).every((row) =>
        row.createdAt.startsWith(TODAY.slice(0, 4)),
      ),
    ).toBe(true);
  });
});

describe('sortOfferingRows (offerings.md:33)', () => {
  it('lists the newest ID first by default', () => {
    expect(seqs(sortOfferingRows(rows(), undefined)).slice(0, 3)).toEqual([
      274, 273, 272,
    ]);
  });

  it('sorts by the billed price, ascending and descending', () => {
    expect(sortOfferingRows(rows(), 'price:asc')[0]?.seq).toBe(265);
    expect(sortOfferingRows(rows(), 'price:desc')[0]?.seq).toBe(273);
  });

  it('puts Active before Inactive, and reverses the whole order descending', () => {
    const asc = sortOfferingRows(rows(), 'status:asc');
    expect(asc.at(-1)?.seq).toBe(272);
    expect(sortOfferingRows(rows(), 'status:desc')[0]?.seq).toBe(272);
    expect(seqs(sortOfferingRows(rows(), 'name:asc')).slice(0, 2)).toEqual([274, 271]);
  });
});
