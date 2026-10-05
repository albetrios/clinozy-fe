import { describe, expect, it } from 'vitest';

import {
  offeringSeed,
  offerSeed,
} from '@/shared/api/clinic/fixtures/offerings.fixtures.ts';
import {
  medicineForm,
  type MedicineRecord,
} from '@/shared/api/clinic/medicines-contracts.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';

import { blankLine } from './invoice-form.ts';
import {
  coveredSessions,
  lineFromCatalog,
  medicineCatalogItem,
  offeringCatalogItem,
  offeringsFor,
  oftenBilledItems,
  rowFloor,
} from './invoice-lines.ts';
import { rxLines } from './invoice-presets.ts';
import { withAddedLine, withSteppedLine } from './invoice-rows.ts';

const TODAY = '2026-10-03';
const OFFERINGS = offeringSeed(TODAY);
const OFFERS = offerSeed(TODAY);
const bySeq = (seq: number): OfferingRecord => {
  const found = OFFERINGS.find((row) => row.seq === seq);
  if (!found) throw new Error(`offering #${seq}`);
  return found;
};
const OFFERINGS_BY_ID = new Map(OFFERINGS.map((row) => [row.id, row]));
const item = (seq: number) => offeringCatalogItem(bySeq(seq), null, OFFERS, TODAY);

const glycolac = {
  id: 'med-456',
  name: 'Glycolac Cream',
  composition: 'Glycolic acid 6%',
  mrp: 16_200,
  minStock: 2,
  nearExpiryDiscountPct: 20,
  batches: [{ batchNo: '026-312', expiry: '11/26', qty: 3, purchaseRate: 9_000 }],
} as unknown as MedicineRecord;

describe('what an invoice lists (KICKOFF §6.9 Items)', () => {
  it('lists active offerings of the type: consultations alone for a consultation invoice', () => {
    const clinic = offeringsFor(OFFERINGS, 'clinic', null).map((row) => row.name);
    expect(clinic).toContain('Corn Removal');
    expect(clinic).not.toContain('Consultation · New');
    // Underarm Peel is inactive.
    expect(clinic).not.toContain('Underarm Peel');
    expect(offeringsFor(OFFERINGS, 'consultation', null).map((row) => row.name)).toEqual([
      'Consultation · New',
    ]);
  });

  it('lists only what a branch sells once one is picked', () => {
    const halfLeg = bySeq(266);
    const elsewhere = offeringsFor(
      [{ ...halfLeg, branchIds: ['other-branch'] }],
      'clinic',
      'this-branch',
    );
    expect(elsewhere).toEqual([]);
  });

  it('bills an offering at its effective price, naming the live offer (Q-O2)', () => {
    const peel = item(271);
    expect(peel).toMatchObject({
      label: 'Back Peeling',
      price: 240_000,
      promo: 'Navratri glow',
      line: { rate: 240_000, gstPct: 0, discountPct: 0 },
    });
    expect(item(270)).toMatchObject({ price: 100_000, promo: null });
  });

  it('backs GST out of a GST-inclusive offering’s rate, so the line comes to its price (Q-O3)', () => {
    const inclusive = offeringCatalogItem(
      { ...bySeq(270), gstPct: 18, gstInclusive: true, price: 118_000 },
      null,
      OFFERS,
      TODAY,
    );
    expect(inclusive.line.rate).toBe(100_000);
  });

  it('bills a medicine at its MRP, no GST on top (D45), the near-expiry discount on (Q-M3)', () => {
    const entry = medicineCatalogItem(glycolac);
    expect(entry).toMatchObject({
      kind: 'medicine',
      group: 'topical',
      price: 16_200,
      stock: 3,
      line: { rate: 16_200, gstPct: 0, discountPct: 20 },
    });
    expect(medicineForm('Epriva Tab')).toBe('oral');
    expect(medicineForm('Admosh UV Sunscreen 60g')).toBe('topical');
  });

  it('floors a row at the lowest price with `disc`, else at the offer price (H:5059, Q-U8)', () => {
    const catalog = new Map([[item(271).key, item(271)]]);
    const row = { offeringId: bySeq(271).id, qty: 2, gstPct: 0 };
    expect(rowFloor(row, OFFERINGS_BY_ID, catalog, { disc: true })).toBe(450_000);
    expect(rowFloor(row, OFFERINGS_BY_ID, catalog, { disc: false })).toBe(480_000);
    expect(
      rowFloor({ ...row, offeringId: null }, OFFERINGS_BY_ID, catalog, { disc: true }),
    ).toBeNull();
  });

  it('counts the sessions the package rows cover — "Covers 6 sessions" (H:5068)', () => {
    const lines = [
      { offeringId: bySeq(273).id, qty: 1, name: 'Underarm Peel · 6 sessions' },
      { offeringId: bySeq(270).id, qty: 3, name: 'Corn Removal' },
    ];
    expect(coveredSessions(lines, OFFERINGS_BY_ID)).toBe(6);
  });

  it('finds "Often billed" names in the catalogue, in its order, five at most', () => {
    const catalog = [item(273), item(270)];
    expect(
      oftenBilledItems(['Underarm Peel', 'Corn Removal', 'Gone'], catalog).map(
        (entry) => entry.label,
      ),
    ).toEqual(['Underarm Peel · 6 sessions', 'Corn Removal']);
    const all = offeringsFor(OFFERINGS, 'clinic', null).map((row) =>
      offeringCatalogItem(row, null, OFFERS, TODAY),
    );
    const names = [
      'LHR Half Leg',
      'Gone',
      'Underarm Peel',
      'Back Peeling',
      'Corn',
      'B1G1',
    ];
    expect(
      oftenBilledItems([...names, 'LHR Full Face'], all).map((e) => e.label),
    ).toEqual([
      // The first in catalogue order the name starts, as the prototype finds it.
      'LHR Half Leg · 10 sessions',
      'Underarm Peel · 6 sessions',
      'Back Peeling',
      'Corn Removal',
      'B1G1 D-Tan Facial',
    ]);
  });
});

describe('the quick line’s rows (H:5058 `addI`, `step`)', () => {
  it('adds into the first blank row, else at the end, with the line’s values', () => {
    const corn = item(270);
    const first = withAddedLine([blankLine()], corn, { qty: 2, discountPct: 10 });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ name: 'Corn Removal', qty: 2, discountPct: 10 });
    expect(withAddedLine(first, item(271))).toHaveLength(2);
    expect(lineFromCatalog(corn, { rate: 50_000 }).rate).toBe(50_000);
  });

  it('steps a row up and down, dropping it at none and keeping one blank row', () => {
    const corn = item(270);
    const one = withSteppedLine([blankLine()], corn, 1);
    expect(one[0]?.qty).toBe(1);
    expect(withSteppedLine(one, corn, 1)[0]?.qty).toBe(2);
    const none = withSteppedLine(one, corn, -1);
    expect(none).toEqual([blankLine()]);
    expect(withSteppedLine([blankLine()], corn, -1)).toEqual([blankLine()]);
  });
});

describe('a prescription as lines (`?prescription=`, "⚡ From Rx #500")', () => {
  it('matches its medicines by id, else by name, naming the ones the store lacks', () => {
    const catalog = [medicineCatalogItem(glycolac)];
    const { lines, unmatched } = rxLines(
      {
        id: 'rx-1',
        seq: 500,
        patientId: 'p-1',
        medicines: [
          { medicineId: null, name: 'glycolac cream', qty: 2 },
          { medicineId: null, name: 'Flubolt 400', qty: 8 },
        ],
      },
      catalog,
    );
    expect(lines).toEqual([expect.objectContaining({ name: 'Glycolac Cream', qty: 2 })]);
    expect(unmatched).toEqual(['Flubolt 400']);
  });
});
