import { describe, expect, it } from 'vitest';

import { invoicePreview } from '@/tests/utils/invoice-doubles.ts';

import { previewFigures, saleFigures } from './invoice-figures.ts';
import type { SaleDraftFigures } from './sale-form.ts';

/** A sale's sums as the fixture world works them, in paise. */
const saleDraft = (patch: Partial<SaleDraftFigures> = {}): SaleDraftFigures => ({
  totals: {
    subtotal: 32_400,
    lineDiscount: 0,
    gst: 0,
    lineNet: 32_400,
    overallDiscount: 0,
    bill: 32_400,
  },
  overallDiscount: 0,
  balance: { bill: 32_400, paid: 0, due: 32_400, status: 'unpaid' },
  paidNow: 0,
  ...patch,
});

describe('previewFigures — an invoice’s figures are the server’s preview, in paise', () => {
  it('reads all zeros before the first answer, keeping "Paid now" and what was paid before', () => {
    expect(
      previewFigures({ preview: null, status: 'empty', paidNow: 0, paidBefore: 0 }),
    ).toEqual({
      status: 'empty',
      subtotal: 0,
      discount: 0,
      gst: 0,
      bill: 0,
      paidBefore: 0,
      paidNow: 0,
      dueBefore: 0,
      due: 0,
    });
    // An edit's money already received shows while the first preview is on its way.
    const pending = previewFigures({
      preview: null,
      status: 'pending',
      paidNow: 50_000,
      paidBefore: 120_000,
    });
    expect(pending).toMatchObject({
      status: 'pending',
      paidBefore: 120_000,
      paidNow: 50_000,
      bill: 0,
      due: 0,
    });
  });

  it('turns the preview’s rupees into paise — never a float a paisa off', () => {
    const preview = invoicePreview(
      [{ offeringId: 'off_a', name: 'Peel', rate: 0.1, qty: 3 }],
      {
        subtotal: 0.3,
        discountTotal: 0.1,
        gstTotal: 0.02,
        total: 1416.29,
        paid: 0.07,
        due: 1416.22,
      },
    );
    const figures = previewFigures({
      preview,
      status: 'ready',
      paidNow: 0,
      paidBefore: 999,
    });
    expect(figures).toEqual({
      status: 'ready',
      subtotal: 30,
      discount: 10,
      gst: 2,
      bill: 141_629,
      // The preview says what was paid: the caller's guess gives way to it.
      paidBefore: 7,
      paidNow: 0,
      dueBefore: 141_622,
      due: 141_622,
    });
  });

  it('takes "Paid now" off what is due — and never reads less than nothing due', () => {
    const preview = invoicePreview(
      [{ offeringId: 'off_a', name: 'Peel', rate: 1000, qty: 1 }],
      {
        total: 1180,
        due: 1180,
      },
    );
    const part = previewFigures({
      preview,
      status: 'ready',
      paidNow: 50_000,
      paidBefore: 0,
    });
    expect(part.dueBefore).toBe(118_000);
    expect(part.due).toBe(68_000);

    const exact = previewFigures({
      preview,
      status: 'ready',
      paidNow: 118_000,
      paidBefore: 0,
    });
    expect(exact.due).toBe(0);

    const above = previewFigures({
      preview,
      status: 'ready',
      paidNow: 200_000,
      paidBefore: 0,
    });
    expect(above.due).toBe(0);
    expect(above.dueBefore).toBe(118_000);
  });

  it('bills a zero-rupee invoice as nothing due', () => {
    const free = invoicePreview(
      [{ offeringId: 'off_a', name: 'Consultation', rate: 0, qty: 1, gstPct: 0 }],
      { total: 0, due: 0 },
    );
    expect(
      previewFigures({ preview: free, status: 'ready', paidNow: 0, paidBefore: 0 }),
    ).toMatchObject({ bill: 0, due: 0, dueBefore: 0, subtotal: 0 });
  });

  it('keeps the status it is given — a refused or failed preview is not "ready"', () => {
    const preview = invoicePreview([
      { offeringId: 'off_a', name: 'Peel', rate: 500, qty: 1 },
    ]);
    expect(
      previewFigures({ preview, status: 'refused', paidNow: 0, paidBefore: 0 }).status,
    ).toBe('refused');
    expect(
      previewFigures({ preview, status: 'failed', paidNow: 0, paidBefore: 0 }).status,
    ).toBe('failed');
  });
});

describe('saleFigures — a Medical sale’s figures are the fixture world’s own sums', () => {
  it('is always ready, with nothing paid before and the whole bill due before "Paid now"', () => {
    expect(saleFigures(saleDraft())).toEqual({
      status: 'ready',
      subtotal: 32_400,
      discount: 0,
      gst: 0,
      bill: 32_400,
      paidBefore: 0,
      paidNow: 0,
      dueBefore: 32_400,
      due: 32_400,
    });
  });

  it('adds the line and overall discounts, rounding the sums to whole paise', () => {
    const figures = saleFigures(
      saleDraft({
        totals: {
          subtotal: 32_400.4,
          lineDiscount: 1_620.3,
          gst: 0.49,
          lineNet: 30_780,
          overallDiscount: 3_078.3,
          bill: 27_702,
        },
        overallDiscount: 3_078,
        balance: { bill: 27_702, paid: 10_000, due: 17_702, status: 'partial' },
        paidNow: 10_000,
      }),
    );
    expect(figures.subtotal).toBe(32_400);
    expect(figures.discount).toBe(4_699);
    expect(figures.gst).toBe(0);
    expect(figures.bill).toBe(27_702);
    expect(figures.paidNow).toBe(10_000);
    expect(figures.dueBefore).toBe(27_702);
    expect(figures.due).toBe(17_702);
  });

  it('reads nothing due once the sale is paid in full', () => {
    const paid = saleFigures(
      saleDraft({
        balance: { bill: 32_400, paid: 32_400, due: 0, status: 'paid' },
        paidNow: 32_400,
      }),
    );
    expect(paid.due).toBe(0);
    expect(paid.dueBefore).toBe(32_400);
  });
});
