import { describe, expect, it } from 'vitest';

import {
  medicineForm,
  type MedicineRecord,
} from '@/shared/api/clinic/medicines-contracts.ts';
import {
  INVOICE_TEST_OFFERINGS,
  INVOICE_TEST_OFFERS,
  TEST_CONSULTATION_ID,
  TEST_LHR_ID,
  TEST_PEEL_ID,
} from '@/tests/utils/invoice-doubles.ts';

import { blankLine } from './invoice-form.ts';
import {
  coveredSessions,
  lineFromCatalog,
  medicineCatalogItem,
  offeringCatalogItem,
  offeringsFor,
  oftenBilledItems,
} from './invoice-lines.ts';
import { rxLines } from './invoice-presets.ts';
import { withAddedLine, withSteppedLine } from './invoice-rows.ts';

const byId = (id: string) => {
  const found = INVOICE_TEST_OFFERINGS.find((row) => row.id === id);
  if (!found) throw new Error(`offering ${id}`);
  return found;
};
const item = (id: string) => offeringCatalogItem(byId(id), null, INVOICE_TEST_OFFERS);

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
    const inactive = {
      ...byId(TEST_PEEL_ID),
      id: 'off_gone',
      name: 'Gone',
      isActive: false,
    };
    const clinic = offeringsFor([...INVOICE_TEST_OFFERINGS, inactive], 'clinic', null);
    expect(clinic.map((row) => row.name)).toEqual(['Research Peel', 'LHR Full Face']);
    expect(
      offeringsFor(INVOICE_TEST_OFFERINGS, 'consultation', null).map((row) => row.id),
    ).toEqual([TEST_CONSULTATION_ID]);
  });

  it('lists only what a branch sells once one is picked', () => {
    const elsewhere = offeringsFor(
      [{ ...byId(TEST_PEEL_ID), branchIds: ['brn_other'] }],
      'clinic',
      'brn_this',
    );
    expect(elsewhere).toEqual([]);
  });

  it('lists an offering at its "Billed today", naming the live offer — the line itself unpriced', () => {
    // ₹1,800 offer price, ₹149.50 off: ₹1,650.50, in paise for the quick line.
    expect(item(TEST_PEEL_ID)).toMatchObject({
      label: 'Research Peel',
      price: 165_050,
      promo: 'Peel week',
      tone: 'sage',
      line: { offeringId: TEST_PEEL_ID, rate: 0, gstPct: 0, discountPct: 0 },
    });
    expect(item(TEST_LHR_ID)).toMatchObject({ price: 480_000, promo: null, sessions: 7 });
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

  it('counts the sessions the server prices as more than one a unit — "Covers 7 sessions" (H:5068)', () => {
    expect(
      coveredSessions([
        { qty: 1, sessionsTotal: 7 },
        { qty: 3, sessionsTotal: 3 },
        { qty: 1, sessionsTotal: null },
      ]),
    ).toBe(7);
  });

  it('finds "Often billed" names in the catalogue, in its order, five at most', () => {
    const catalog = [item(TEST_LHR_ID), item(TEST_PEEL_ID)];
    expect(
      oftenBilledItems(['Research', 'LHR Full Face', 'Gone'], catalog).map(
        (entry) => entry.label,
      ),
    ).toEqual(['Research Peel', 'LHR Full Face']);
    expect(oftenBilledItems(Array(8).fill('LHR'), catalog)).toHaveLength(5);
  });
});

describe('the quick line’s rows (H:5058 `addI`, `step`)', () => {
  it('adds into the first blank row, else at the end, with the line’s values', () => {
    const peel = item(TEST_PEEL_ID);
    const first = withAddedLine([blankLine()], peel, { qty: 2, discountPct: 10 });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      id: null,
      offeringId: TEST_PEEL_ID,
      name: 'Research Peel',
      qty: 2,
      discountPct: 10,
      suggestionId: null,
      treatmentIds: [],
    });
    expect(withAddedLine(first, item(TEST_LHR_ID))).toHaveLength(2);
    // A sale's typed "@500" rate.
    expect(lineFromCatalog(medicineCatalogItem(glycolac), { rate: 50_000 }).rate).toBe(
      50_000,
    );
  });

  it('steps a row up and down, dropping it at none and keeping one blank row', () => {
    const peel = item(TEST_PEEL_ID);
    const one = withSteppedLine([blankLine()], peel, 1);
    expect(one[0]?.qty).toBe(1);
    expect(withSteppedLine(one, peel, 1)[0]?.qty).toBe(2);
    const none = withSteppedLine(one, peel, -1);
    expect(none).toEqual([blankLine()]);
    expect(withSteppedLine([blankLine()], peel, -1)).toEqual([blankLine()]);
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
