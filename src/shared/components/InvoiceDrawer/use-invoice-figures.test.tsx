import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InvoicePreview } from '@/shared/api/app/invoices-contracts.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  INVOICE_TEST_OFFERS,
  invoicePreview,
  TEST_PEEL_ID,
  TEST_PEEL_OFFER_ID,
  TEST_VESU_BRANCH_ID,
} from '@/tests/utils/invoice-doubles.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';

const { notifyMock, offersApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  offersApi: { fetchAllOffers: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...offersApi,
}));

import type { InvoiceFiguresStatus } from './invoice-figures.ts';
import {
  blankLine,
  emptyInvoiceForm,
  type InvoiceFormValues,
  type InvoiceLineForm,
} from './invoice-form.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';
import { useDrawerFigures } from './use-invoice-figures.ts';
import type { DrawerPreview } from './use-invoice-preview.ts';

const PEEL_OFFER_NAME = INVOICE_TEST_OFFERS.find(
  (offer) => offer.id === TEST_PEEL_OFFER_ID,
)?.name;

const EMPTY_CATALOG: InvoiceCatalog = {
  items: [],
  byKey: new Map(),
  offerings: new Map(),
  words: () => ({ sub: '', meta: '' }),
  options: [],
  isLoading: false,
};

/** A preview the drawer holds: each form row in order is the preview's line, current or not. */
function drawerPreview({
  preview = null,
  status = 'ready',
  current = true,
  refusedRows = [],
}: {
  preview?: InvoicePreview | null;
  status?: InvoiceFiguresStatus;
  current?: boolean;
  refusedRows?: number[];
} = {}): DrawerPreview {
  return {
    preview,
    status,
    lineOf: (row) => {
      const line = preview?.items[row];
      return line ? { line, current } : null;
    },
    refusedRows,
    failure: null,
    retry: null,
  };
}

const row = (patch: Partial<InvoiceLineForm>): InvoiceLineForm => ({
  ...blankLine(),
  ...patch,
});

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function render({
  values,
  sale = false,
  invoice = null,
  readOnly = false,
  preview = drawerPreview(),
  openedWithLines = false,
}: {
  values: InvoiceFormValues;
  sale?: boolean;
  invoice?: ReturnType<typeof invoiceRecord> | null;
  readOnly?: boolean;
  preview?: DrawerPreview;
  openedWithLines?: boolean;
}) {
  return renderHook(
    ({ drawer }) => {
      const form = useForm<InvoiceFormValues>({ defaultValues: values });
      return {
        form,
        figures: useDrawerFigures({
          form,
          values,
          sale,
          invoice,
          readOnly,
          preview: drawer,
          catalog: EMPTY_CATALOG,
          floorVisible: false,
          openedWithLines,
        }),
      };
    },
    { wrapper, initialProps: { drawer: preview } },
  );
}

beforeEach(() => {
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const fn of [...Object.values(notifyMock), ...Object.values(offersApi)])
    fn.mockReset();
  offersApi.fetchAllOffers.mockResolvedValue(INVOICE_TEST_OFFERS);
});
afterEach(() => client.clear());

describe('useDrawerFigures — a Medical sale’s own sums (the fixture world)', () => {
  const glycolac = row({
    medicineId: 'med_glycolac',
    name: 'Glycolac Cream',
    qty: 2,
    rate: 16_200,
  });
  const sale = (patch: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
    ...emptyInvoiceForm('2026-10-12', { type: 'medical' }),
    items: [glycolac, blankLine()],
    ...patch,
  });

  it('sums the named rows at MRP, with "Paid now" off the bill', () => {
    const { result } = render({
      values: sale({ paidNow: [{ mode: 'cash', amount: 12_400 }] }),
      sale: true,
    });
    expect(result.current.figures.figures).toMatchObject({
      status: 'ready',
      subtotal: 32_400,
      bill: 32_400,
      paidBefore: 0,
      paidNow: 12_400,
      dueBefore: 32_400,
      due: 20_000,
    });
    expect(result.current.figures.sessionLines).toEqual([]);
  });

  it('takes the overall percent off before tax', () => {
    const { result } = render({ values: sale({ overallDiscountPct: '10' }), sale: true });
    expect(result.current.figures.figures.discount).toBe(3_240);
    expect(result.current.figures.figures.bill).toBe(29_160);
  });

  it('shows each named row’s own Rate and Final — a blank row comes to nothing', () => {
    const { result } = render({ values: sale(), sale: true });
    expect(result.current.figures.rowFigures(glycolac, 0)).toEqual({
      rate: 16_200,
      gstPct: 0,
      final: 32_400,
      offers: [],
      stale: false,
    });
    expect(result.current.figures.rowFigures(blankLine(), 1).final).toBe(0);
  });

  it('turns a typed Final into the row’s discount, held between nothing and the full price', () => {
    const { result } = render({ values: sale(), sale: true });
    act(() => result.current.figures.onFinal(0, 29_160));
    expect(result.current.form.getValues('items.0.discountPct')).toBeCloseTo(10, 6);
    act(() => result.current.figures.onFinal(0, 99_999));
    expect(result.current.form.getValues('items.0.discountPct')).toBe(0);
    act(() => result.current.figures.onFinal(0, -5));
    expect(result.current.form.getValues('items.0.discountPct')).toBe(100);
    expect(result.current.form.getFieldState('items.0.discountPct').isDirty).toBe(true);
  });

  it('never toasts an offer on a sale', async () => {
    const preview = invoicePreview([
      {
        offeringId: TEST_PEEL_ID,
        name: 'Research Peel',
        rate: 2000,
        qty: 1,
        offerIds: [TEST_PEEL_OFFER_ID],
      },
    ]);
    render({ values: sale(), sale: true, preview: drawerPreview({ preview }) });
    await waitFor(() => expect(offersApi.fetchAllOffers).toHaveBeenCalled());
    expect(notifyMock.info).not.toHaveBeenCalled();
  });
});

describe('useDrawerFigures — an invoice that cannot change here reads as saved', () => {
  const invoice = invoiceRecord({
    subtotal: 500,
    discountTotal: 50,
    gstTotal: 0,
    total: 450,
    paid: 400,
    due: 50,
  });
  const values = (): InvoiceFormValues => ({
    ...emptyInvoiceForm('2026-10-10', { branchId: TEST_VESU_BRANCH_ID }),
    items: [
      row({
        id: 'iitm_7ocmisga5mzisg1w1uok1',
        offeringId: 'off_3f4nzxf53tfyf9k6hlna1',
        name: 'Consultation',
      }),
      row({ id: 'iitm_gone', offeringId: 'off_x', name: 'Removed line' }),
    ],
    paidNow: [{ mode: 'upi', amount: 99_999 }],
  });

  it('shows the saved figures in paise — no preview, nothing paid now', () => {
    const { result } = render({ values: values(), invoice, readOnly: true });
    expect(result.current.figures.figures).toEqual({
      status: 'ready',
      subtotal: 50_000,
      discount: 5_000,
      gst: 0,
      bill: 45_000,
      paidBefore: 40_000,
      paidNow: 0,
      dueBefore: 5_000,
      due: 5_000,
    });
  });

  it('shows a saved line’s figures by its id, and nothing for a line it no longer has', () => {
    const { result } = render({ values: values(), invoice, readOnly: true });
    const [saved, gone] = values().items as [InvoiceLineForm, InvoiceLineForm];
    expect(result.current.figures.rowFigures(saved, 0)).toEqual({
      rate: 50_000,
      gstPct: 0,
      final: 50_000,
      offers: [],
      stale: false,
    });
    expect(result.current.figures.rowFigures(gone, 1)).toEqual({
      rate: null,
      gstPct: null,
      final: null,
      offers: [],
      stale: false,
    });
  });

  it('ignores a typed Final', () => {
    const { result } = render({ values: values(), invoice, readOnly: true });
    act(() => result.current.figures.onFinal(0, 100));
    expect(result.current.form.getValues('items.0.discountPct')).toBe(0);
  });
});

describe('useDrawerFigures — an invoice priced by the server’s preview', () => {
  const peel = row({ offeringId: TEST_PEEL_ID, name: 'Research Peel' });
  const values = (patch: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
    ...emptyInvoiceForm('2026-10-12', { branchId: TEST_VESU_BRANCH_ID }),
    items: [peel],
    paidNow: [{ mode: 'upi', amount: 50_000 }],
    ...patch,
  });
  const peelPreview = (patch: Record<string, unknown> = {}) =>
    invoicePreview([
      { offeringId: TEST_PEEL_ID, name: 'Research Peel', rate: 1000, qty: 1, ...patch },
    ]);

  it('takes a new invoice’s "Paid now" off the preview’s due — an edit’s "Paid now" is the server’s', () => {
    const preview = drawerPreview({ preview: peelPreview() });
    const fresh = render({ values: values(), preview });
    expect(fresh.result.current.figures.figures).toMatchObject({
      bill: 118_000,
      paidNow: 50_000,
      due: 68_000,
    });

    const edited = render({ values: values(), preview, invoice: invoiceRecord() });
    expect(edited.result.current.figures.figures).toMatchObject({
      paidNow: 0,
      due: 118_000,
    });
  });

  it('shows a row’s server figures, its offers by name, dimmed while a new preview is on its way', async () => {
    const preview = peelPreview({ offerIds: [TEST_PEEL_OFFER_ID, 'ofr_unknown'] });
    const { result } = render({
      values: values(),
      preview: drawerPreview({ preview, current: false }),
    });
    await waitFor(() =>
      expect(result.current.figures.rowFigures(peel, 0).offers).toEqual([
        PEEL_OFFER_NAME,
      ]),
    );
    expect(result.current.figures.rowFigures(peel, 0)).toMatchObject({
      rate: 100_000,
      gstPct: 18,
      final: 118_000,
      stale: true,
    });
    expect(result.current.figures.sessionLines).toEqual(preview.items);
  });

  it('says a refused row is under its lowest price on its Final', () => {
    const { result } = render({
      values: values(),
      preview: drawerPreview({ status: 'refused', refusedRows: [0] }),
    });
    expect(result.current.figures.rowFigures(peel, 0)).toEqual({
      rate: null,
      gstPct: null,
      final: null,
      offers: [],
      stale: false,
      error: 'Below the lowest price for Research Peel',
    });
  });

  it('turns a typed Final into the discount on the server’s rate, GST on top', () => {
    const { result } = render({
      values: values(),
      preview: drawerPreview({ preview: peelPreview() }),
    });
    act(() => result.current.figures.onFinal(0, 59_000));
    expect(result.current.form.getValues('items.0.discountPct')).toBe(50);
    act(() => result.current.figures.onFinal(0, 500_000));
    expect(result.current.form.getValues('items.0.discountPct')).toBe(0);
  });

  it('takes a GST-inclusive rate as the whole price, and leaves a free line at no discount', () => {
    const inclusive = render({
      values: values(),
      preview: drawerPreview({ preview: peelPreview({ isGstInclusive: true }) }),
    });
    act(() => inclusive.result.current.figures.onFinal(0, 75_000));
    expect(inclusive.result.current.form.getValues('items.0.discountPct')).toBe(25);

    const free = render({
      values: values(),
      preview: drawerPreview({ preview: peelPreview({ rate: 0 }) }),
    });
    act(() => free.result.current.figures.onFinal(0, 10_000));
    expect(free.result.current.form.getValues('items.0.discountPct')).toBe(0);
  });

  it('changes nothing for a Final typed on a row the preview does not price yet', () => {
    const { result } = render({ values: values(), preview: drawerPreview() });
    act(() => result.current.figures.onFinal(0, 59_000));
    expect(result.current.form.getValues('items.0.discountPct')).toBe(0);
  });

  it('toasts each live offer the preview applies to a line the member added — once', async () => {
    const applied = drawerPreview({
      preview: peelPreview({ offerIds: [TEST_PEEL_OFFER_ID] }),
    });
    const { rerender } = render({
      values: values(),
      preview: drawerPreview({ preview: peelPreview() }),
    });
    await waitFor(() => expect(offersApi.fetchAllOffers).toHaveBeenCalled());

    rerender({ drawer: applied });
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith(
        `${PEEL_OFFER_NAME} applied to Research Peel`,
      ),
    );
    rerender({
      drawer: drawerPreview({ preview: peelPreview({ offerIds: [TEST_PEEL_OFFER_ID] }) }),
    });
    expect(notifyMock.info).toHaveBeenCalledOnce();
  });

  it('keeps the offers of the lines an edit or a copy opened with unsaid', async () => {
    const opened = drawerPreview({
      preview: peelPreview({ offerIds: [TEST_PEEL_OFFER_ID] }),
    });
    const { rerender } = render({
      values: values(),
      preview: opened,
      openedWithLines: true,
    });
    await waitFor(() => expect(offersApi.fetchAllOffers).toHaveBeenCalled());
    rerender({
      drawer: drawerPreview({ preview: peelPreview({ offerIds: [TEST_PEEL_OFFER_ID] }) }),
    });
    expect(notifyMock.info).not.toHaveBeenCalled();
  });
});
