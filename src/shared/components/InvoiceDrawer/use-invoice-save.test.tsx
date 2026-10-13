import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import {
  invoiceDetail,
  TEST_LHR_ID,
  TEST_PEEL_ID,
  TEST_VESU_BRANCH_ID,
} from '@/tests/utils/invoice-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';
import {
  invoiceRecord,
  TEST_INVOICE_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

const { notifyMock, invoicesApi, contactsApi, saleWrite } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  invoicesApi: { createInvoice: vi.fn(), updateInvoice: vi.fn() },
  contactsApi: { createContact: vi.fn() },
  /** The Medical room's write, as New sale hands it in. */
  saleWrite: { create: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...invoicesApi,
}));
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...contactsApi,
}));

import type { InvoiceFigures } from './invoice-figures.ts';
import {
  blankLine,
  emptyInvoiceForm,
  type InvoiceFormValues,
  type InvoiceLineForm,
} from './invoice-form.ts';
import type { InvoiceCatalogItem } from './invoice-lines.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';
import { useInvoiceSave } from './use-invoice-save.ts';

const GLYCOLAC = 'med_glycolac0000000000000';

/** Kavya Mehta, the patient every invoice here bills. */
const KAVYA = {
  kind: 'patient' as const,
  id: TEST_MONEY_PATIENT_ID,
  contactId: TEST_MONEY_CONTACT_ID,
  name: 'Kavya Mehta',
  phone: '+919825005865',
};

const line = (patch: Partial<InvoiceLineForm>): InvoiceLineForm => ({
  ...blankLine(),
  ...patch,
});
const PEEL = line({ offeringId: TEST_PEEL_ID, name: 'Research Peel' });
const LHR = line({ offeringId: TEST_LHR_ID, name: 'LHR Full Face', qty: 2 });

/** A clinic invoice for Kavya: Research Peel, a blank row, then LHR ×2. */
const clinicInvoice = (patch: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  ...emptyInvoiceForm('2026-10-12', { branchId: TEST_VESU_BRANCH_ID, party: KAVYA }),
  items: [PEEL, blankLine(), LHR],
  ...patch,
});

/** The figures as a ready preview reads them: a ₹1,180 bill, nothing paid. */
const figures = (patch: Partial<InvoiceFigures> = {}): InvoiceFigures => ({
  status: 'ready',
  subtotal: 100_000,
  discount: 0,
  gst: 18_000,
  bill: 118_000,
  paidBefore: 0,
  paidNow: 0,
  dueBefore: 118_000,
  due: 118_000,
  ...patch,
});

/** A catalogue with Research Peel (lowest price ₹1,500) and Glycolac with 3 in stock. */
function catalog(stock: number | null = 3): InvoiceCatalog {
  const glycolac: InvoiceCatalogItem = {
    key: GLYCOLAC,
    kind: 'medicine',
    group: 'topical',
    line: {
      offeringId: null,
      medicineId: GLYCOLAC,
      name: 'Glycolac Cream',
      rate: 16_200,
      gstPct: 0,
      discountPct: 0,
    },
    price: 16_200,
    sessions: 1,
    stock,
    promo: null,
    detail: null,
    tone: null,
    label: 'Glycolac Cream',
  };
  const peel: OfferingRecord = offeringRecord({ id: TEST_PEEL_ID, minPrice: 1500 });
  return {
    items: [glycolac],
    byKey: new Map([[GLYCOLAC, glycolac]]),
    offerings: new Map([[TEST_PEEL_ID, peel]]),
    words: () => ({ sub: '', meta: '' }),
    options: [],
    isLoading: false,
  };
}

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/invoices', 'POST', { error });

const validation = (field: string, message: string) =>
  refusal(400, { type: 'validation_error', errors: [{ field, message }] });

const conflict = (reason: string) =>
  refusal(409, { reason, detail: `Refused: ${reason}` });

/** The server's answer to a create or an edit. */
const savedAs = (invoice: InvoiceRecord, planLinked = 0) => ({
  detail: invoiceDetail(invoice),
  planLinked,
});

describe('useInvoiceSave — the Invoice drawer’s save', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    values,
    invoice = null,
    sale = false,
    drawerFigures = figures(),
    refusedRows = [],
    floorVisible = false,
    stock,
    onStale,
  }: {
    values: InvoiceFormValues;
    invoice?: InvoiceRecord | null;
    sale?: boolean;
    drawerFigures?: InvoiceFigures;
    refusedRows?: number[];
    floorVisible?: boolean;
    stock?: number | null;
    onStale?: () => void;
  }) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<InvoiceFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useInvoiceSave({
            form,
            invoice,
            sale,
            saleWrite: sale ? saleWrite : null,
            fallbackBranchId: TEST_VESU_BRANCH_ID,
            catalog: catalog(stock),
            figures: drawerFigures,
            refusedRows,
            floorVisible,
            onStep,
            onStale,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onDone };
  }

  const lastWarning = () =>
    withoutBidiMarks((notifyMock.warning.mock.lastCall as [string] | undefined)?.[0]);

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [
      ...Object.values(notifyMock),
      ...Object.values(invoicesApi),
      ...Object.values(contactsApi),
      ...Object.values(saleWrite),
    ]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  describe('the checks before anything is sent', () => {
    it('asks for an item first — a named row with no offering bills nothing on an invoice', async () => {
      const { result, onStep } = render({
        values: clinicInvoice({ items: [line({ name: 'Typed only' }), blankLine()] }),
      });
      await act(() => result.current.drawer.save());
      expect(lastWarning()).toBe('Add at least one item');
      expect(onStep).toHaveBeenCalledWith('items');
      expect(invoicesApi.createInvoice).not.toHaveBeenCalled();
    });

    it('asks for a patient whose contact is not known yet', async () => {
      const { result, onStep } = render({
        values: clinicInvoice({ party: { ...KAVYA, contactId: null } }),
      });
      await act(() => result.current.drawer.save());
      expect(lastWarning()).toBe('Pick a patient');
      expect(onStep).toHaveBeenCalledWith('party');
    });

    it('refuses "Paid now" above the server’s bill, naming both amounts', async () => {
      const { result, onStep } = render({
        values: clinicInvoice(),
        drawerFigures: figures({ paidNow: 150_000 }),
      });
      await act(() => result.current.drawer.save());
      expect(lastWarning()).toMatch(/^Paid ₹1,500 is more than the bill ₹1,180$/);
      expect(result.current.form.getFieldState('paidNow').error).toBeDefined();
      expect(onStep).toHaveBeenCalledWith('payment');
      expect(invoicesApi.createInvoice).not.toHaveBeenCalled();
    });

    it('counts what an edit was paid before in the refusal — and lets "Paid now" equal to what is due through', async () => {
      const edited = render({
        values: clinicInvoice(),
        drawerFigures: figures({
          paidBefore: 40_000,
          dueBefore: 78_000,
          paidNow: 80_000,
        }),
      });
      await act(() => edited.result.current.drawer.save());
      expect(lastWarning()).toMatch(/^Paid ₹1,200 is more than the bill ₹1,180$/);

      invoicesApi.createInvoice.mockResolvedValue(savedAs(invoiceRecord()));
      const exact = render({
        values: clinicInvoice(),
        drawerFigures: figures({ paidNow: 118_000 }),
      });
      await act(() => exact.result.current.drawer.save());
      expect(invoicesApi.createInvoice).toHaveBeenCalledOnce();
    });

    it('leaves "Paid now" to the server while the preview is still being worked out', async () => {
      invoicesApi.createInvoice.mockResolvedValue(savedAs(invoiceRecord()));
      const { result } = render({
        values: clinicInvoice(),
        drawerFigures: figures({ status: 'pending', paidNow: 150_000 }),
      });
      await act(() => result.current.drawer.save());
      expect(notifyMock.warning).not.toHaveBeenCalled();
      expect(invoicesApi.createInvoice).toHaveBeenCalledOnce();
    });

    it('keeps a line under its lowest price from going, naming the price only to a member who sees it', async () => {
      const hidden = render({ values: clinicInvoice(), refusedRows: [0] });
      await act(() => hidden.result.current.drawer.save());
      expect(lastWarning()).toBe(
        'Research Peel is below its lowest price · raise the final price',
      );
      expect(
        hidden.result.current.form.getFieldState('items.0.discountPct').error,
      ).toBeDefined();
      expect(hidden.onStep).toHaveBeenCalledWith('items');

      const shown = render({
        values: clinicInvoice(),
        refusedRows: [0],
        floorVisible: true,
      });
      await act(() => shown.result.current.drawer.save());
      expect(lastWarning()).toBe(
        'Research Peel is below its lowest price ₹1,500 · raise the final price',
      );
      expect(invoicesApi.createInvoice).not.toHaveBeenCalled();
    });
  });

  describe('the write', () => {
    it('creates the invoice with the lines that have an offering and "Paid now" in rupees', async () => {
      const created = invoiceRecord({
        id: 'invc_new0000000000000000',
        seq: 6,
        type: 'clinic',
      });
      invoicesApi.createInvoice.mockResolvedValue(savedAs(created, 2));
      const { result, onDone } = render({
        values: clinicInvoice({
          paidNow: [
            { mode: 'upi', amount: 50_000 },
            { mode: 'cash', amount: 0 },
            { mode: 'upi', amount: 20_050 },
          ],
          overallDiscount: '100',
        }),
      });

      await act(() => result.current.drawer.save());

      expect(invoicesApi.createInvoice).toHaveBeenCalledWith({
        input: expect.objectContaining({
          type: 'clinic',
          branchId: TEST_VESU_BRANCH_ID,
          contactId: TEST_MONEY_CONTACT_ID,
          items: [
            expect.objectContaining({ offeringId: TEST_PEEL_ID, qty: 1 }),
            expect.objectContaining({ offeringId: TEST_LHR_ID, qty: 2 }),
          ],
          overallDiscount: 100,
          paidNow: [{ mode: 'upi', amount: 700.5 }],
        }),
        idempotencyKey: expect.any(String),
      });
      expect(onDone).toHaveBeenCalledWith({
        invoiceId: 'invc_new0000000000000000',
        seq: 6,
        type: 'clinic',
        planLinked: 2,
      });
    });

    it('saves an edit against the invoice as read', async () => {
      const invoice = invoiceRecord();
      invoicesApi.updateInvoice.mockResolvedValue(savedAs(invoice));
      const { result, onDone } = render({ values: clinicInvoice(), invoice });

      await act(() => result.current.drawer.save());

      expect(invoicesApi.updateInvoice).toHaveBeenCalledWith({
        invoice,
        input: expect.objectContaining({ contactId: TEST_MONEY_CONTACT_ID }),
        idempotencyKey: expect.any(String),
      });
      expect(invoicesApi.createInvoice).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: TEST_INVOICE_ID, seq: 5 }),
      );
    });

    it('files a branch-less invoice under the screen’s branch', async () => {
      invoicesApi.createInvoice.mockResolvedValue(savedAs(invoiceRecord()));
      const { result } = render({ values: clinicInvoice({ branchId: null }) });

      await act(() => result.current.drawer.save());

      expect(invoicesApi.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ branchId: TEST_VESU_BRANCH_ID }),
        }),
      );
    });
  });

  describe('a Medical sale (the Medical room’s write, MD19)', () => {
    const glycolacRow = (qty: number) =>
      line({ medicineId: GLYCOLAC, name: 'Glycolac Cream', qty, rate: 16_200 });

    /** Priya Shah, a buyer with a contact. */
    const PRIYA = {
      kind: 'contact' as const,
      id: 'con_priya0000000000000000',
      contactId: 'con_priya0000000000000000',
      name: 'Priya Shah',
      phone: '+919900011122',
    };

    const saleValues = (
      items: InvoiceLineForm[],
      party: InvoiceFormValues['party'] = PRIYA,
    ): InvoiceFormValues => ({
      ...emptyInvoiceForm('2026-10-12', {
        type: 'medical',
        branchId: TEST_VESU_BRANCH_ID,
      }),
      party,
      items,
    });

    it('hands the room’s write the buyer’s contact and each medicine — no rate, no invoice', async () => {
      saleWrite.create.mockResolvedValue({
        invoiceId: 'invc_sale90100000000000000',
        seq: 901,
      });
      const { result, onDone } = render({
        values: saleValues([glycolacRow(2)]),
        sale: true,
      });

      await act(() => result.current.drawer.save());

      expect(invoicesApi.createInvoice).not.toHaveBeenCalled();
      expect(saleWrite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: TEST_VESU_BRANCH_ID,
          contactId: PRIYA.contactId,
          items: [{ medicineId: GLYCOLAC, qty: 2, discountPct: 0 }],
          payment: null,
        }),
      );
      expect(onDone).toHaveBeenCalledWith({
        invoiceId: 'invc_sale90100000000000000',
        seq: 901,
        type: 'medical',
        planLinked: 0,
      });
    });

    it('saves a new customer’s contact first — their mobile asked for — then the sale on it', async () => {
      const walkIn = {
        kind: 'contact' as const,
        id: 'new-customer',
        contactId: null,
        name: 'Viral Sheth',
        phone: null,
      };
      contactsApi.createContact.mockResolvedValue({ id: 'con_viral0000000000000000' });
      saleWrite.create.mockResolvedValue({
        invoiceId: 'invc_sale90200000000000000',
        seq: 902,
      });
      const noMobile = render({
        values: saleValues([glycolacRow(1)], walkIn),
        sale: true,
      });
      await act(() => noMobile.result.current.drawer.save());
      expect(lastWarning()).toBe('Enter a 10-digit mobile');
      expect(contactsApi.createContact).not.toHaveBeenCalled();

      const withMobile = render({
        values: saleValues([glycolacRow(1)], { ...walkIn, phone: '+919825000111' }),
        sale: true,
      });
      await act(() => withMobile.result.current.drawer.save());
      expect(contactsApi.createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.objectContaining({
            firstName: 'Viral',
            lastName: 'Sheth',
            phones: [{ phone: '+919825000111', isOnWhatsapp: true }],
          }),
        }),
      );
      expect(saleWrite.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'con_viral0000000000000000' }),
      );
      // Kept on the form: a retry after a refused sale writes no second contact.
      expect(withMobile.result.current.form.getValues('party')?.contactId).toBe(
        'con_viral0000000000000000',
      );
    });

    it('refuses more of a medicine than the store holds — its rows counted together', async () => {
      const { result, onStep } = render({
        values: saleValues([glycolacRow(2), blankLine(), glycolacRow(2)]),
        sale: true,
      });

      await act(() => result.current.drawer.save());

      expect(lastWarning()).toBe('Only 3 of Glycolac Cream in stock');
      expect(onStep).toHaveBeenCalledWith('items');
      expect(saleWrite.create).not.toHaveBeenCalled();
    });

    it('sells exactly what is in stock, and anything of a medicine with no stock count', async () => {
      saleWrite.create.mockResolvedValue({
        invoiceId: 'invc_sale90200000000000000',
        seq: 902,
      });
      const exact = render({ values: saleValues([glycolacRow(3)]), sale: true });
      await act(() => exact.result.current.drawer.save());
      const uncounted = render({
        values: saleValues([glycolacRow(50)]),
        sale: true,
        stock: null,
      });
      await act(() => uncounted.result.current.drawer.save());
      expect(saleWrite.create).toHaveBeenCalledTimes(2);
      expect(notifyMock.warning).not.toHaveBeenCalled();
    });

    it('says a refused sale in the server’s words (`409 not_enough_stock`)', async () => {
      saleWrite.create.mockRejectedValue(conflict('not_enough_stock'));
      const { result, onDone } = render({
        values: saleValues([glycolacRow(1)]),
        sale: true,
      });

      await act(() => result.current.drawer.save());

      expect(notifyMock.error).toHaveBeenCalledWith('Refused: not_enough_stock');
      expect(onDone).not.toHaveBeenCalled();
    });
  });

  describe('the server’s refusals', () => {
    it('says "Paid now" is more than the bill on its field, and opens Payment', async () => {
      invoicesApi.createInvoice.mockRejectedValue(conflict('more_than_due'));
      const { result, onStep, onDone } = render({ values: clinicInvoice() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('paidNow').error?.message).toBe(
        'Paid now is more than the bill',
      );
      expect(onStep).toHaveBeenCalledWith('payment');
      expect(notifyMock.error).toHaveBeenCalledWith('Paid now is more than the bill');
      expect(onDone).not.toHaveBeenCalled();
    });

    it('says a closed day, a settled invoice and a used session in its own words', async () => {
      const cases: [string, string, string | null][] = [
        ['day_closed', 'That day is closed · no payment can be added to it', 'payment'],
        [
          'invoice_settled',
          'This invoice is settled · a payment on it falls on a closed day',
          null,
        ],
        ['below_paid', 'The bill can’t go below what is already paid', 'items'],
        [
          'treatment_billed',
          'A treatment on this invoice was billed meanwhile · remove it and save again',
          'items',
        ],
        [
          'invoice_of_sale',
          'This invoice belongs to a Medical sale · change it from Medical',
          null,
        ],
      ];
      for (const [reason, message, step] of cases) {
        invoicesApi.updateInvoice.mockRejectedValueOnce(conflict(reason));
        const { result, onStep } = render({
          values: clinicInvoice(),
          invoice: invoiceRecord(),
        });
        await act(() => result.current.drawer.save());
        expect(notifyMock.error).toHaveBeenLastCalledWith(message);
        if (step) expect(onStep).toHaveBeenCalledWith(step);
        else expect(onStep).not.toHaveBeenCalled();
      }
    });

    it('says any other conflict in the server’s words', async () => {
      invoicesApi.createInvoice.mockRejectedValue(
        refusal(409, { reason: 'something_new', detail: 'The clinic is closed today' }),
      );
      const { result, onStep } = render({ values: clinicInvoice() });

      await act(() => result.current.drawer.save());

      expect(notifyMock.error).toHaveBeenCalledWith('The clinic is closed today');
      expect(onStep).not.toHaveBeenCalled();
    });

    it('puts a refused line on the row it came from — items/<n> counts the lines sent', async () => {
      invoicesApi.createInvoice.mockRejectedValue(
        validation('body.items/1/discount_percent', 'At most 100'),
      );
      const { result, onStep } = render({ values: clinicInvoice() });

      await act(() => result.current.drawer.save());

      // The second line sent is the form's third row (the blank one is not sent).
      expect(
        result.current.form.getFieldState('items.2.discountPct').error?.message,
      ).toBe('At most 100');
      expect(
        result.current.form.getFieldState('items.1.discountPct').error,
      ).toBeUndefined();
      expect(onStep).toHaveBeenCalledWith('items');
    });

    it('puts a refused contact on the party and opens its step', async () => {
      invoicesApi.createInvoice.mockRejectedValue(
        validation('body.contact_id', 'Not a patient of this clinic'),
      );
      const { result, onStep } = render({ values: clinicInvoice() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('party').error?.message).toBe(
        'Not a patient of this clinic',
      );
      expect(onStep).toHaveBeenCalledWith('party');
    });

    it('puts a refused team on Team and a refused payment on "Paid now"', async () => {
      invoicesApi.createInvoice.mockRejectedValueOnce(
        validation('body.member_ids', 'Not a member'),
      );
      const team = render({ values: clinicInvoice() });
      await act(() => team.result.current.drawer.save());
      expect(team.result.current.form.getFieldState('teamIds').error?.message).toBe(
        'Not a member',
      );
      expect(team.onStep).toHaveBeenCalledWith('party');

      invoicesApi.createInvoice.mockRejectedValueOnce(
        validation('body.payment.splits', 'One split per mode'),
      );
      const payment = render({ values: clinicInvoice() });
      await act(() => payment.result.current.drawer.save());
      expect(payment.result.current.form.getFieldState('paidNow').error?.message).toBe(
        'One split per mode',
      );
      expect(payment.onStep).toHaveBeenCalledWith('payment');
    });

    it('offers Reload for a stale edit', async () => {
      const onStale = vi.fn();
      invoicesApi.updateInvoice.mockRejectedValue(conflict('record_changed'));
      const { result } = render({
        values: clinicInvoice(),
        invoice: invoiceRecord(),
        onStale,
      });

      await act(() => result.current.drawer.save());

      const [, options] = notifyMock.error.mock.lastCall as [
        string,
        { id: string; action: { label: string; onClick: () => void } },
      ];
      expect(options.id).toBe('invoice-save-failed');
      expect(options.action.label).toBe('Reload');
      options.action.onClick();
      expect(onStale).toHaveBeenCalledOnce();
    });
  });
});
