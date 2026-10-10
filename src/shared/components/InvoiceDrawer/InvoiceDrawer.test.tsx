import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  previewInvoice: vi.fn(),
  previewInvoiceChange: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  restoreInvoice: vi.fn(),
  fetchInvoice: vi.fn(),
  fetchInvoicePresets: vi.fn(),
  fetchInvoiceTotals: vi.fn(),
}));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(),
  fetchAllOffers: vi.fn(),
  createOffering: vi.fn(),
}));
vi.mock('@/shared/api/clinic/plan-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPlan: vi.fn(),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patient-search-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchPatientPicker: vi.fn(),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));
vi.mock('@/shared/api/clinic/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listVisitTreatmentsToBill: vi.fn(),
}));

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import * as branchesApi from '@/shared/api/clinic/branches-api.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  createInvoice,
  deleteInvoice,
  fetchInvoice,
  fetchInvoicePresets,
  fetchInvoiceTotals,
  previewInvoice,
  previewInvoiceChange,
  restoreInvoice,
  updateInvoice,
} from '@/shared/api/clinic/invoices-api.ts';
import type {
  InvoiceDetail,
  InvoiceInput,
  InvoicePreview,
} from '@/shared/api/clinic/invoices-contracts.ts';
import {
  createOffering,
  fetchAllOfferings,
  fetchAllOffers,
} from '@/shared/api/clinic/offerings-api.ts';
import { fetchPatient } from '@/shared/api/clinic/patients-api.ts';
import { fetchPlan } from '@/shared/api/clinic/plan-api.ts';
import { listVisitTreatmentsToBill } from '@/shared/api/clinic/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { holdPreset } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  INVOICE_TEST_BRANCHES,
  INVOICE_TEST_OFFERINGS,
  INVOICE_TEST_OFFERS,
  INVOICE_TEST_TEAM,
  invoiceDetail,
  invoicePreview,
  TEST_CONSULTATION_ID,
  TEST_DOCTOR_ID,
  TEST_LHR_ID,
  TEST_PEEL_ID,
  TEST_PEEL_OFFER_ID,
} from '@/tests/utils/invoice-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';
import {
  invoiceRecord,
  TEST_INVOICE_ID,
  TEST_MONEY_AUTHOR_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

import { InvoiceDrawer } from './InvoiceDrawer.tsx';

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const RHEA = patientRef('Rhea Shah');

/** Every money code an Owner holds, the lowest price and New offering among them. */
const OWNER_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
  'offering:lower_price:read',
  'offering:create',
];

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** The member holding the `role` preset's codes. */
function asRole(role: Role) {
  holdPreset(role);
}

/** The test member signed in to the organization with these clinozy-be codes. */
function signIn(codes: readonly OrganizationPermission[] = OWNER_CODES) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
  useUIStore.setState({ previewRole: null });
}

function renderCreate(
  prefill: {
    patientId?: string;
    type?: 'clinic' | 'medical' | 'consultation';
    copyOf?: InvoiceDetail;
    appointmentId?: string;
  } = {},
  sale = false,
) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  const view = renderWithProviders(
    <InvoiceDrawer
      mode="create"
      open
      sale={sale}
      prefill={prefill}
      onClose={onClose}
      onCreated={onCreated}
    />,
  );
  return { ...view, onCreated, onClose };
}

function renderEdit(detail: InvoiceDetail = invoiceDetail()) {
  const onSaved = vi.fn();
  const onDeleted = vi.fn();
  renderWithProviders(
    <InvoiceDrawer
      mode="edit"
      open
      detail={detail}
      onClose={vi.fn()}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />,
  );
  return { detail, onSaved, onDeleted };
}

const panel = () => screen.findByTestId('invoice-drawer');

/** Add a line through the quick line: type it, then ↵. */
async function quickAdd(user: ReturnType<typeof setUser>, text: string) {
  // The drawer opens on "Patient & team"; the quick line sits in the Items step.
  if (!screen.queryByTestId('invoice-drawer-quick-line-input')) {
    await user.click(await screen.findByTestId('invoice-drawer-step-items-trigger'));
  }
  const line = await screen.findByTestId('invoice-drawer-quick-line-input');
  await user.click(line);
  await user.type(line, text);
  await screen.findByTestId('invoice-drawer-quick-line-option');
  await user.keyboard('{Enter}');
}

const totals = (cell: 'subtotal' | 'discount-gst' | 'bill' | 'due') =>
  screen.getByTestId(`invoice-drawer-totals-${cell}`);

/** The totals' caption: where the server's preview stands. */
const previewStatus = () => screen.getByTestId('invoice-drawer-totals-status');

/** A refusal as clinozy-be answers it. */
function refusal(status: number, error: Record<string, unknown>) {
  return new HttpError('refused', status, '/app/invoices', 'POST', { error });
}

/** The server's billed rate of each offering today: Research Peel with its ₹149.50-off offer. */
const BILLED: Readonly<Record<string, { rate: number; gstPct: number; name: string }>> = {
  [TEST_PEEL_ID]: { rate: 1650.5, gstPct: 18, name: 'Research Peel' },
  [TEST_LHR_ID]: { rate: 4800, gstPct: 18, name: 'LHR Full Face' },
  [TEST_CONSULTATION_ID]: { rate: 500, gstPct: 0, name: 'Consultation' },
};

/** The server's preview of a bill — its lines priced as the live stack prices them. */
function serverPreview(input: InvoiceInput, overrides: Partial<InvoicePreview> = {}) {
  return invoicePreview(
    input.items.map((line) => {
      const billed = BILLED[line.offeringId] ?? { rate: 0, gstPct: 0, name: '' };
      return {
        id: line.id,
        offeringId: line.offeringId,
        name: billed.name,
        qty: line.qty,
        rate: billed.rate,
        gstPct: billed.gstPct,
        discountPct: Math.round(line.discountPct * 100) / 100,
        offerIds: line.offeringId === TEST_PEEL_ID ? [TEST_PEEL_OFFER_ID] : [],
        sessionsTotal: line.offeringId === TEST_LHR_ID ? 7 * line.qty : line.qty,
      };
    }),
    overrides,
  );
}

/** What a new invoice's save answers: invoice #6 as the server saved the input. */
function savedOf(input: InvoiceInput, seq = 6) {
  const preview = serverPreview(input);
  const invoice = invoiceRecord({
    id: 'invc_new000000000000000000',
    seq,
    number: `2026-27/000${seq}`,
    type: input.type,
    total: preview.total,
    paid: input.paidNow.reduce((sum, split) => sum + split.amount, 0),
    due: preview.total - input.paidNow.reduce((sum, split) => sum + split.amount, 0),
    items: [],
  });
  return { detail: invoiceDetail(invoice), planLinked: 0 };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockReset();
  resetClinicFixtures();
  vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue(INVOICE_TEST_BRANCHES);
  vi.mocked(fetchAllOfferings).mockResolvedValue(INVOICE_TEST_OFFERINGS);
  vi.mocked(fetchAllOffers).mockResolvedValue(INVOICE_TEST_OFFERS);
  vi.mocked(fetchTeamDirectory).mockResolvedValue(INVOICE_TEST_TEAM);
  vi.mocked(findMyMembershipId).mockResolvedValue(TEST_MONEY_AUTHOR_ID);
  vi.mocked(fetchPlan).mockResolvedValue({ suggestions: [], planTotal: 0 });
  vi.mocked(listVisitTreatmentsToBill).mockResolvedValue([]);
  vi.mocked(fetchInvoicePresets).mockResolvedValue({
    packages: [],
    lastByType: {},
    recentTeamIds: [],
  });
  vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 0, paid: 0 });
  vi.mocked(fetchPatient).mockResolvedValue(
    patientRecord({
      id: TEST_MONEY_PATIENT_ID,
      contactId: TEST_MONEY_CONTACT_ID,
      name: 'Kavya Mehta',
      firstName: 'Kavya',
      lastName: 'Mehta',
      phone: '+919825005865',
    }),
  );
  vi.mocked(previewInvoice).mockImplementation(async (input) => serverPreview(input));
  vi.mocked(previewInvoiceChange).mockImplementation(async ({ invoice }) =>
    serverPreview(
      {
        type: 'consultation',
        branchId: invoice.branchId,
        contactId: invoice.contactId,
        teamIds: [],
        items: invoice.items.map((line) => ({
          id: line.id,
          offeringId: line.offeringId ?? '',
          qty: line.qty,
          discountPct: line.discountPct,
          suggestionId: null,
          treatmentIds: [],
        })),
        overallDiscount: 0,
        date: invoice.date,
        remark: null,
        prescriptionId: null,
        paidNow: [],
      },
      { type: invoice.type, paid: invoice.paid, due: invoice.total - invoice.paid },
    ),
  );
  vi.mocked(createInvoice).mockImplementation(async ({ input }) => savedOf(input));
  vi.mocked(updateInvoice).mockImplementation(async ({ invoice }) => ({
    detail: invoiceDetail(invoice),
    planLinked: 0,
  }));
  vi.mocked(deleteInvoice).mockResolvedValue(undefined);
  vi.mocked(restoreInvoice).mockResolvedValue(invoiceRecord());
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetClinicFixtures();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('InvoiceDrawer — New invoice on clinozy-be (KICKOFF §6.9)', () => {
  it('opens 840px wide with the header, the type switch, three steps and the totals', async () => {
    signIn();
    renderCreate();
    const drawer = await panel();
    expect(drawer).toHaveClass('md:w-[min(840px,calc(100vw-56px))]');
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'New invoice',
    );
    const types = within(drawer).getByRole('radiogroup', { name: 'Type' });
    expect(
      within(types)
        .getAllByRole('radio')
        .map((radio) => [radio.textContent, radio.getAttribute('aria-checked')]),
    ).toEqual([
      ['Clinic', 'true'],
      ['Medical', 'false'],
      ['Consultation', 'false'],
    ]);
    for (const step of ['party', 'items', 'payment']) {
      expect(within(drawer).getByTestId(`invoice-drawer-step-${step}`)).toBeVisible();
    }
    expect(within(drawer).getByTestId('invoice-drawer-badges')).toHaveTextContent(
      'ClinicBill ₹0Draft',
    );
    expect(totals('bill')).toHaveTextContent('₹0');
    expect(within(drawer).getByTestId('invoice-drawer-save')).toHaveTextContent(
      'Create clinic invoice',
    );
    // Nothing to price yet: no preview is asked.
    expect(previewInvoice).not.toHaveBeenCalled();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('reads the URL’s patient: their name in the summary, their contact on the bill', async () => {
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    const drawer = await panel();
    await waitFor(() =>
      expect(within(drawer).getByTestId('invoice-drawer-footer')).toHaveTextContent(
        'Clinic · Kavya Mehta · 0 items',
      ),
    );
    expect(fetchPatient).toHaveBeenCalledWith(TEST_MONEY_PATIENT_ID);
  });

  it('prices a line on the server as it is typed — rate, GST, final, totals — and names the offer', async () => {
    const user = setUser();
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await quickAdd(user, 'peel 2 10%');
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    expect(row.getByRole('spinbutton', { name: 'Qty' })).toHaveValue('2');
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('10');
    // ₹1,650.50 (₹1,800 less the ₹149.50 offer) × 2, 10% off, 18% GST on top.
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹3,505.66'));
    expect(row.getByText('₹1,650.50')).toBeInTheDocument();
    expect(row.getByText('18%')).toBeInTheDocument();
    expect(row.getByRole('textbox', { name: 'Final' })).toHaveValue('3505.66');
    expect(totals('subtotal')).toHaveTextContent('₹3,301');
    expect(totals('discount-gst')).toHaveTextContent('−₹330.10 · +₹534.76');
    expect(previewStatus()).toHaveAttribute('data-status', 'ready');
    expect(notifyMock.info).toHaveBeenCalledWith('Peel week applied to Research Peel');
    // The preview is the bill without "Paid now", the patient's contact on it.
    expect(vi.mocked(previewInvoice).mock.lastCall?.[0]).toMatchObject({
      type: 'clinic',
      branchId: TEST_MONEY_BRANCH_ID,
      contactId: TEST_MONEY_CONTACT_ID,
      items: [{ id: null, offeringId: TEST_PEEL_ID, qty: 2, discountPct: 10 }],
      paidNow: [],
    });
    expect(screen.getByTestId('invoice-drawer-badges')).toHaveTextContent(
      '₹3,505.66 due',
    );
  });

  it('turns a typed Final into the line’s discount, which the server then prices', async () => {
    const user = setUser();
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID, type: 'consultation' });
    await quickAdd(user, 'consult 1');
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    await waitFor(() =>
      expect(row.getByRole('textbox', { name: 'Final' })).toHaveValue('500'),
    );
    const final = row.getByRole('textbox', { name: 'Final' });
    await user.clear(final);
    await user.type(final, '400');
    await user.tab();
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('20');
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹400'));
  });

  it('marks a line under its lowest price, naming the price, and keeps the save from going', async () => {
    const user = setUser();
    signIn();
    vi.mocked(previewInvoice).mockImplementation(async (input) => {
      if (input.items.some((line) => line.discountPct > 0)) {
        throw refusal(400, {
          reason: 'below_lowest_price',
          errors: [
            {
              field: 'items/0',
              message: 'Research Peel is below its lowest price of 1500',
            },
          ],
        });
      }
      return serverPreview(input);
    });
    const { onCreated } = renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await quickAdd(user, 'peel 1 50%');
    await waitFor(() =>
      expect(previewStatus()).toHaveAttribute('data-status', 'refused'),
    );
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    expect(row.getByRole('textbox', { name: 'Final' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      row.getByText('Below the lowest price ₹1,500 for Research Peel'),
    ).toBeInTheDocument();
    expect(totals('bill')).toHaveTextContent('—');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith(
      'Research Peel is below its lowest price ₹1,500 · raise the final price',
    );
    expect(createInvoice).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('names no floor to a member who may not see the lowest price', async () => {
    const user = setUser();
    signIn(OWNER_CODES.filter((code) => code !== 'offering:lower_price:read'));
    vi.mocked(previewInvoice).mockRejectedValue(
      refusal(400, {
        reason: 'below_lowest_price',
        errors: [{ field: 'items/0', message: 'below' }],
      }),
    );
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await quickAdd(user, 'peel 1 50%');
    await waitFor(() =>
      expect(previewStatus()).toHaveAttribute('data-status', 'refused'),
    );
    expect(screen.queryByText(/₹1,500/)).toBeNull();
    expect(
      within(screen.getByTestId('invoice-drawer-items-row')).getByText(
        /^Below the lowest price for /,
      ),
    ).toBeInTheDocument();
  });

  it('asks for a patient, then a line, before anything is sent', async () => {
    const user = setUser();
    signIn();
    const { onCreated } = renderCreate();
    await panel();
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick a patient');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('refuses "Paid now" above the server’s bill', async () => {
    const user = setUser();
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID, type: 'consultation' });
    await quickAdd(user, 'consult 1');
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹500'));
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '900');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith(
      'Paid ₹900 is more than the bill ₹500',
    );
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('creates the invoice with "Full" paid now — one receipt, in rupees — "Clinic invoice #6 created"', async () => {
    const user = setUser();
    signIn();
    const { onCreated } = renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await quickAdd(user, 'peel 1');
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹1,947.59'));
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.click(screen.getByTestId('invoice-drawer-payment-fill-full'));
    expect(totals('due')).toHaveTextContent('₹0');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createInvoice).toHaveBeenCalledWith({
      input: expect.objectContaining({
        type: 'clinic',
        branchId: TEST_MONEY_BRANCH_ID,
        contactId: TEST_MONEY_CONTACT_ID,
        teamIds: [TEST_MONEY_AUTHOR_ID],
        items: [
          {
            id: null,
            offeringId: TEST_PEEL_ID,
            qty: 1,
            discountPct: 0,
            suggestionId: null,
            treatmentIds: [],
          },
        ],
        overallDiscount: 0,
        date: '2026-10-10',
        paidNow: [{ mode: 'upi', amount: 1947.59 }],
      }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Clinic invoice #6 created');
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 6, type: 'clinic', planLinked: 0 }),
    );
  });

  it('sends the overall discount in rupees and shows the server’s figures for it', async () => {
    const user = setUser();
    signIn();
    vi.mocked(previewInvoice).mockImplementation(async (input) =>
      serverPreview(input, input.overallDiscount > 0 ? { total: 400, due: 400 } : {}),
    );
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID, type: 'consultation' });
    await quickAdd(user, 'consult 1');
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(screen.getByTestId('invoice-drawer-overall-discount'), '100');
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹400'));
    expect(vi.mocked(previewInvoice).mock.lastCall?.[0]).toMatchObject({
      overallDiscount: 100,
    });
  });

  it('says in its own words why the server refused "Paid now" (409 more_than_due)', async () => {
    const user = setUser();
    signIn();
    vi.mocked(createInvoice).mockRejectedValue(
      refusal(409, { reason: 'more_than_due', detail: 'More than due' }),
    );
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID, type: 'consultation' });
    await quickAdd(user, 'consult 1');
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹500'));
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Paid now is more than the bill'),
    );
    expect(screen.getByTestId('invoice-drawer-step-payment')).toHaveAttribute(
      'data-status',
      'open',
    );
  });

  it('puts a line the save is refused for on its row (400 below_lowest_price, items/<n>)', async () => {
    const user = setUser();
    signIn();
    vi.mocked(createInvoice).mockRejectedValue(
      refusal(400, {
        type: 'validation_error',
        reason: 'below_lowest_price',
        errors: [
          {
            field: 'items/0',
            message: 'Research Peel is below its lowest price of 1500',
          },
        ],
      }),
    );
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await quickAdd(user, 'peel 1');
    await waitFor(() => expect(previewStatus()).toHaveAttribute('data-status', 'ready'));
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('invoice-drawer-items-row')).getByRole('textbox', {
          name: 'Disc %',
        }),
      ).toHaveAttribute('aria-invalid', 'true'),
    );
  });

  it('clears the items on a switch of type, and lists a consultation’s offerings only', async () => {
    const user = setUser();
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await quickAdd(user, 'peel 1');
    await user.click(screen.getByTestId('invoice-drawer-type-consultation'));
    expect(screen.getByTestId('invoice-drawer-save')).toHaveTextContent(
      'Create consultation invoice',
    );
    expect(
      within(screen.getByTestId('invoice-drawer-items-row')).queryByText('Research Peel'),
    ).toBeNull();
    const line = screen.getByTestId('invoice-drawer-quick-line-input');
    await user.click(line);
    const options = await screen.findAllByTestId('invoice-drawer-quick-line-option');
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('Consultation'),
    ]);
  });

  it('is view only for a member without payment:create, and asks for no preview', async () => {
    signIn(['organization:read', 'payment:read']);
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    const drawer = await panel();
    await waitFor(() =>
      expect(drawer).toHaveTextContent('View only · your role can’t change this'),
    );
    expect(within(drawer).queryByTestId('invoice-drawer-save')).toBeNull();
    expect(previewInvoice).not.toHaveBeenCalled();
  });

  it('offers "New offering" in a line’s picker only with offering:create', async () => {
    const user = setUser();
    signIn(OWNER_CODES.filter((code) => code !== 'offering:create'));
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await user.click(await screen.findByTestId('invoice-drawer-step-items-trigger'));
    await user.click(await screen.findByTestId('invoice-drawer-items-item'));
    await screen.findByRole('listbox');
    expect(screen.queryByText('New offering')).toBeNull();
    expect(createOffering).not.toHaveBeenCalled();
  });
});

describe('InvoiceDrawer — Quick fill on clinozy-be', () => {
  it('repeats the patient’s last invoice — its offerings, quantities, discounts and team', async () => {
    const user = setUser();
    signIn();
    vi.mocked(fetchInvoicePresets).mockResolvedValue({
      packages: [{ offeringId: TEST_LHR_ID }],
      lastByType: {
        clinic: {
          id: 'invc_last00000000000000000',
          seq: 4,
          type: 'clinic',
          items: [
            {
              ...invoiceRecord().items[0]!,
              offeringId: TEST_PEEL_ID,
              qty: 2,
              discountPct: 5,
              name: 'Research Peel',
            },
          ],
          teamIds: [TEST_DOCTOR_ID],
        },
      },
      recentTeamIds: [TEST_DOCTOR_ID],
    });
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await user.click(await screen.findByTestId('invoice-drawer-quick-fill-repeat'));
    await user.click(screen.getByTestId('invoice-drawer-step-items-trigger'));
    const row = within(await screen.findByTestId('invoice-drawer-items-row'));
    expect(row.getByText('Research Peel')).toBeInTheDocument();
    expect(row.getByRole('spinbutton', { name: 'Qty' })).toHaveValue('2');
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('5');
    // The package she holds: another unit of it.
    await user.click(
      screen.getByTestId(`invoice-drawer-quick-fill-package-${TEST_LHR_ID}`),
    );
    expect(
      within(screen.getByTestId('invoice-drawer-items-row')).getByText('LHR Full Face'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('invoice-drawer-badges')).toHaveTextContent(
        'Covers 7 sessions',
      ),
    );
  });

  it('bills a plan row with its agreed price as the discount, the row linked', async () => {
    const user = setUser();
    signIn();
    vi.mocked(fetchPlan).mockResolvedValue({
      planTotal: 1320.4,
      suggestions: [
        {
          id: 'osug_peel0000000000000000',
          offeringId: TEST_PEEL_ID,
          name: 'Research Peel',
          quantity: 1,
          price: 1320.4,
          status: 'accepted',
          reason: null,
          sourceLabel: 'Patient file',
          suggestedById: null,
          invoicedQuantity: 0,
          isFullyInvoiced: false,
          isBelowLowestPrice: false,
          createdAt: '2026-10-01T05:00:00.000Z',
          updatedAt: '2026-10-01T05:00:00.000Z',
        },
      ],
    });
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await user.click(
      await screen.findByTestId(
        'invoice-drawer-quick-fill-plan-osug_peel0000000000000000',
      ),
    );
    await user.click(screen.getByTestId('invoice-drawer-step-items-trigger'));
    const row = within(await screen.findByTestId('invoice-drawer-items-row'));
    // ₹1,320.40 of the ₹1,650.50 billed today: 20% off.
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('20');
    await waitFor(() =>
      expect(vi.mocked(previewInvoice).mock.lastCall?.[0].items).toEqual([
        expect.objectContaining({
          offeringId: TEST_PEEL_ID,
          suggestionId: 'osug_peel0000000000000000',
          discountPct: 20,
        }),
      ]),
    );
  });
});

/** The visit "Create invoice from visit" bills (D156). */
const VISIT_ID = 'appt_kavya0000000000000000';

/** A session done at the visit, of `offeringId`, still to bill (`is_billed` false). */
function sessionToBill(id: string, offeringId: string, name: string): TreatmentRecord {
  return {
    id,
    patientId: TEST_MONEY_PATIENT_ID,
    appointmentId: VISIT_ID,
    offeringId,
    name,
    template: 'skin',
    performedAt: '2026-10-10T04:00:00.000Z',
    doctorId: TEST_DOCTOR_ID,
    therapistId: null,
    bodyParts: ['face'],
    sessionNumber: 1,
    parameters: {},
    remark: null,
    aftercareCall: 'none',
    packageId: null,
    isBilled: false,
    status: 'done',
    reversedReason: null,
    reversedAt: null,
    latestCheckIn: null,
    createdAt: '2026-10-10T04:00:00.000Z',
    updatedAt: '2026-10-10T04:00:00.000Z',
  };
}

describe('InvoiceDrawer — Create invoice from visit (?appointment=, D156)', () => {
  it('bills the visit’s sessions still to bill — one line per offering, enough units, each carrying them', async () => {
    signIn();
    vi.mocked(listVisitTreatmentsToBill).mockResolvedValue([
      sessionToBill('trt_peelone00000000000000', TEST_PEEL_ID, 'Research Peel'),
      sessionToBill('trt_peeltwo00000000000000', TEST_PEEL_ID, 'Research Peel'),
      sessionToBill('trt_lhrone000000000000000', TEST_LHR_ID, 'LHR Full Face'),
    ]);
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID, appointmentId: VISIT_ID });

    await waitFor(() =>
      expect(listVisitTreatmentsToBill).toHaveBeenCalledWith(
        TEST_MONEY_PATIENT_ID,
        VISIT_ID,
      ),
    );
    // Two single sessions of the peel bill two units; the seven-session package covers its one.
    await waitFor(() =>
      expect(vi.mocked(previewInvoice).mock.lastCall?.[0].items).toEqual([
        expect.objectContaining({
          offeringId: TEST_PEEL_ID,
          qty: 2,
          treatmentIds: ['trt_peelone00000000000000', 'trt_peeltwo00000000000000'],
        }),
        expect.objectContaining({
          offeringId: TEST_LHR_ID,
          qty: 1,
          treatmentIds: ['trt_lhrone000000000000000'],
        }),
      ]),
    );
  });

  it('reads no sessions without a visit', async () => {
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    await panel();
    expect(listVisitTreatmentsToBill).not.toHaveBeenCalled();
  });
});

describe('InvoiceDrawer — Edit invoice on clinozy-be', () => {
  it('opens a saved invoice with its number, the server’s figures, Print and — with payment:delete — Delete', async () => {
    const user = setUser();
    signIn();
    renderEdit();
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'Edit invoice',
    );
    expect(within(drawer).getByTestId('invoice-drawer-tag')).toHaveTextContent('#5');
    expect(within(drawer).queryByRole('radiogroup', { name: 'Type' })).toBeNull();
    expect(within(drawer).getByTestId('invoice-drawer-delete')).toBeInTheDocument();
    // The stored lines' preview: ₹500 billed, ₹400 paid, ₹100 due.
    await waitFor(() => expect(totals('due')).toHaveTextContent('₹100'));
    expect(previewInvoiceChange).toHaveBeenCalled();
    // Closed, the Payment step peeks at what is paid and due — no "Paid now" on a saved invoice.
    const payment = within(drawer).getByTestId('invoice-drawer-step-payment');
    expect(payment).toHaveTextContent('Paid ₹400 · due ₹100');
    expect(payment).not.toHaveTextContent('Quick fill');
    await user.click(within(drawer).getByTestId('invoice-drawer-step-payment-trigger'));
    expect(screen.getByTestId('invoice-drawer-paid-now')).toHaveTextContent(
      'Paid ₹400 · due ₹100',
    );
    expect(screen.queryByTestId('invoice-drawer-payment-fill')).toBeNull();
    await user.click(within(drawer).getByTestId('invoice-drawer-quick-fill-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('saves what changed with the invoice as read: "Invoice #5 saved"', async () => {
    const user = setUser();
    signIn();
    const { detail, onSaved } = renderEdit();
    await panel();
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    const remark = screen.getByTestId('invoice-drawer-remark');
    await user.clear(remark);
    await user.type(remark, 'Second sitting next week');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateInvoice).toHaveBeenCalledWith({
      invoice: detail.invoice,
      input: expect.objectContaining({
        remark: 'Second sitting next week',
        items: [expect.objectContaining({ id: detail.invoice.items[0]?.id, qty: 1 })],
        paidNow: [],
      }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Invoice #5 saved');
  });

  it('offers Reload when someone saved the invoice first (409 record_changed) and starts over on theirs', async () => {
    const user = setUser();
    signIn();
    vi.mocked(updateInvoice).mockRejectedValueOnce(
      new HttpError('stale', 409, '/app/invoices', 'PATCH', {
        error: { reason: 'record_changed', detail: 'Changed by Nisha Shah' },
      }),
    );
    const fresh = invoiceDetail(
      invoiceRecord({ remark: 'Saved by Nisha', updatedAt: '2026-10-10T05:00:00.000Z' }),
    );
    vi.mocked(fetchInvoice).mockResolvedValue(fresh);
    renderEdit();
    await panel();
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(screen.getByTestId('invoice-drawer-remark'), ' · mine');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Reload' }) }),
      ),
    );
    const call = notifyMock.error.mock.calls.find(([, options]) => options?.action);
    call?.[1].action.onClick();
    await waitFor(() =>
      expect(screen.getByTestId('invoice-drawer-remark')).toHaveValue('Saved by Nisha'),
    );
    expect(fetchInvoice).toHaveBeenCalledWith(TEST_INVOICE_ID);
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() => expect(updateInvoice).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateInvoice).mock.lastCall?.[0].invoice).toBe(fresh.invoice);
  });

  it('says why a change is refused in its own words (409 below_paid)', async () => {
    const user = setUser();
    signIn();
    vi.mocked(updateInvoice).mockRejectedValue(
      refusal(409, { reason: 'below_paid', detail: 'Below paid' }),
    );
    renderEdit();
    await panel();
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(screen.getByTestId('invoice-drawer-remark'), ' again');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'The bill can’t go below what is already paid',
      ),
    );
  });

  it('is view only for a member without payment:update — its figures as saved, no preview', async () => {
    signIn(['organization:read', 'payment:read']);
    renderEdit();
    const drawer = await panel();
    await waitFor(() =>
      expect(
        within(drawer).getByText('View only · your role can’t change this'),
      ).toBeVisible(),
    );
    expect(within(drawer).queryByTestId('invoice-drawer-save')).toBeNull();
    expect(within(drawer).queryByTestId('invoice-drawer-delete')).toBeNull();
    expect(totals('due')).toHaveTextContent('₹100');
    expect(previewInvoiceChange).not.toHaveBeenCalled();
    // Printing is a read: it stays.
    expect(within(drawer).getByTestId('invoice-drawer-quick-fill-print')).toBeVisible();
  });

  it('reads only a settled invoice (a payment on a closed day), saying why', async () => {
    signIn();
    renderEdit(invoiceDetail(invoiceRecord({ isSettled: true })));
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-notice')).toHaveTextContent(
      'Settled · a payment on this invoice falls on a closed day, so it can’t change',
    );
    expect(within(drawer).queryByTestId('invoice-drawer-save')).toBeNull();
    expect(within(drawer).queryByTestId('invoice-drawer-delete')).toBeNull();
  });

  it('reads only a Medical sale’s invoice — Medical changes it', async () => {
    signIn();
    renderEdit(invoiceDetail(invoiceRecord({ type: 'medical', patientId: null })));
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-notice')).toHaveTextContent(
      'A Medical sale’s invoice · change it from Medical',
    );
    expect(within(drawer).queryByTestId('invoice-drawer-quick-line-input')).toBeNull();
    expect(within(drawer).queryByTestId('invoice-drawer-delete')).toBeNull();
  });

  it('deletes with a reason and brings it back from the toast’s Undo', async () => {
    const user = setUser();
    signIn();
    const { onDeleted } = renderEdit();
    await user.click(await screen.findByTestId('invoice-drawer-delete'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: /mistake/i }));
    await user.click(within(confirm).getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteInvoice).toHaveBeenCalledWith({
      invoiceId: TEST_INVOICE_ID,
      reason: 'mistake',
      note: null,
    });
    const [message, options] = notifyMock.undo.mock.calls[0] ?? [];
    expect(message).toBe('Invoice #5 deleted');
    options.onUndo();
    await waitFor(() =>
      expect(restoreInvoice).toHaveBeenCalledWith(TEST_INVOICE_ID, expect.any(String)),
    );
  });

  it('keeps an invoice with money on it, saying why, the confirm closed (409 invoice_paid)', async () => {
    const user = setUser();
    signIn();
    vi.mocked(deleteInvoice).mockRejectedValue(
      refusal(409, { reason: 'invoice_paid', detail: 'Paid' }),
    );
    const { onDeleted } = renderEdit();
    await user.click(await screen.findByTestId('invoice-drawer-delete'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: /mistake/i }));
    await user.click(within(confirm).getByRole('button', { name: /delete/i }));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'This invoice has money paid or a credit note · it can’t be deleted',
      ),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });
});

describe('InvoiceDrawer — Copy invoice (patient-file.md:43)', () => {
  it('opens a copy as a new invoice of today — its lines without their ids — and saves it as one', async () => {
    const user = setUser();
    signIn();
    const source = invoiceDetail(
      invoiceRecord({ remark: 'Second sitting', teamIds: [TEST_DOCTOR_ID] }),
    );
    const { onCreated } = renderCreate({ copyOf: source });
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'New invoice',
    );
    expect(within(drawer).queryByTestId('invoice-drawer-tag')).toBeNull();
    await waitFor(() => expect(totals('bill')).toHaveTextContent('₹500'));
    expect(totals('due')).toHaveTextContent('₹500');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createInvoice).toHaveBeenCalledWith({
      input: expect.objectContaining({
        type: 'consultation',
        contactId: TEST_MONEY_CONTACT_ID,
        teamIds: [TEST_DOCTOR_ID],
        items: [expect.objectContaining({ id: null, offeringId: TEST_CONSULTATION_ID })],
        remark: 'Second sitting',
        date: '2026-10-10',
        paidNow: [],
      }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Copied as #6');
  });
});

describe('InvoiceDrawer — Medical sale (§6.7, §6.9)', () => {
  it('locks the type to Medical: "New sale", Customer, Prescribed by, no switch', async () => {
    renderCreate({}, true);
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'New sale',
    );
    expect(
      within(drawer).getByText('Medical invoice · stock updates by earliest expiry'),
    ).toBeVisible();
    expect(within(drawer).queryByRole('radiogroup', { name: 'Type' })).toBeNull();
    expect(within(drawer).getByText('Customer')).toBeInTheDocument();
    expect(within(drawer).getByText('Prescribed by')).toBeInTheDocument();
    expect(within(drawer).getByTestId('invoice-drawer-save')).toHaveTextContent(
      'Create medical invoice',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('lets a member with Medical but no Payments make a New sale, never a clinic invoice', async () => {
    signIn(['organization:read', 'medicine:read', 'medicine:create', 'medicine:update']);
    const sale = renderCreate({}, true);
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-save')).toBeInTheDocument();
    expect(drawer).not.toHaveTextContent('View only · your role can’t change this');
    sale.unmount();
    renderCreate();
    const invoice = await panel();
    expect(invoice).toHaveTextContent('View only · your role can’t change this');
  });

  it('adds a medicine the store lacks as a quick draft (Q-M4) — from the line and from Browse', async () => {
    const user = setUser();
    asRole('pharmacist');
    renderCreate({ patientId: RHEA, type: 'medical' }, true);
    await user.click(await screen.findByTestId('invoice-drawer-step-items-trigger'));
    const line = await screen.findByTestId('invoice-drawer-quick-line-input');
    await user.type(line, 'azel cream 2');
    await user.click(await screen.findByTestId('invoice-drawer-quick-line-typed'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Azel Cream added · set MRP later in Stock',
      ),
    );
    expect(
      clinicFixtures.medicines.snapshot((medicine) => medicine.name === 'Azel Cream')[0],
    ).toMatchObject({ isQuick: true, mrp: 0 });
    await waitFor(() =>
      expect(screen.getByTestId('invoice-drawer-items-row')).toHaveTextContent(
        'Azel Cream',
      ),
    );
    expect(screen.getByTestId('invoice-drawer-items-qty')).toHaveValue('2');

    // Browse's inline "New medicine name" adds one more, on the next row.
    await user.click(screen.getByTestId('invoice-drawer-quick-line-browse'));
    const browse = await screen.findByTestId('invoice-drawer-quick-line-browse-panel');
    const name = within(browse).getByTestId('invoice-drawer-quick-line-browse-new');
    expect(name).toHaveAttribute('placeholder', 'New medicine name');
    await user.type(name, 'Derma gel{Enter}');
    await waitFor(() =>
      expect(screen.getAllByTestId('invoice-drawer-items-row')).toHaveLength(2),
    );
    expect(
      clinicFixtures.medicines.snapshot((medicine) => medicine.name === 'Derma gel'),
    ).toHaveLength(1);
  });

  it('offers no new medicine to a role that cannot create one', async () => {
    const user = setUser();
    asRole('accountant');
    renderCreate({ patientId: RHEA, type: 'medical' });
    await user.click(await screen.findByTestId('invoice-drawer-step-items-trigger'));
    await user.type(await screen.findByTestId('invoice-drawer-quick-line-input'), 'zzq');
    expect(await screen.findByTestId('invoice-drawer-quick-line-no-match')).toBeVisible();
    expect(screen.queryByTestId('invoice-drawer-quick-line-typed')).toBeNull();
    await user.click(screen.getByTestId('invoice-drawer-quick-line-browse'));
    const browse = await screen.findByTestId('invoice-drawer-quick-line-browse-panel');
    expect(
      within(browse).queryByTestId('invoice-drawer-quick-line-browse-new'),
    ).toBeNull();
  });

  it('bills a medicine at its MRP with no GST on top (D45), and refuses more than the stock', async () => {
    const user = setUser();
    renderCreate({ patientId: RHEA, type: 'medical' }, true);
    await quickAdd(user, 'glycolac 4');
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    expect(row.getByText('0%')).toBeInTheDocument();
    expect(totals('bill')).toHaveTextContent('₹648');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Only 3 of Glycolac Cream in stock');
  });
});
describe('InvoiceDrawer — phone (below md)', () => {
  it('fills the screen, the item rows wrapping without their heads', async () => {
    viewport.tier = 'phone';
    const user = setUser();
    signIn();
    renderCreate({ patientId: TEST_MONEY_PATIENT_ID });
    const drawer = await panel();
    await quickAdd(user, 'peel 1');
    expect(within(drawer).queryByTestId('invoice-drawer-items-header')).toBeNull();
    expect(within(drawer).getByTestId('invoice-drawer-close')).toBeInTheDocument();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });
});
