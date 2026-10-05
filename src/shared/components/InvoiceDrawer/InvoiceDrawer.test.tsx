import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchInvoice } from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceDetail } from '@/shared/api/clinic/invoices-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
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
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

import { InvoiceDrawer } from './InvoiceDrawer.tsx';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const DHARTI = patientRef('Dharti Galani');
const RHEA = patientRef('Rhea Shah');

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** A member previewed as `role` (View-as narrows the clinic access to its matrix). */
function asRole(role: Role) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
}

function renderCreate(
  prefill: { patientId?: string; type?: 'clinic' | 'medical' | 'consultation' } = {},
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

async function renderEdit(invoiceSeq: number) {
  const detail: InvoiceDetail = await fetchInvoice(ref.invoice(invoiceSeq));
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('InvoiceDrawer — New invoice (KICKOFF §6.9)', () => {
  it('opens 840px wide with the header, the type switch, three steps and the totals', async () => {
    renderCreate();
    const drawer = await panel();
    expect(drawer).toHaveClass('md:w-[min(840px,calc(100vw-56px))]');
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'New invoice',
    );
    expect(within(drawer).getByText('Pick the type, then add items')).toBeVisible();
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
      expect(
        within(drawer).getByTestId(`invoice-drawer-step-${step}`),
      ).toBeInTheDocument();
    }
    expect(within(drawer).getByTestId('invoice-drawer-badges')).toHaveTextContent(
      'ClinicBill ₹0Draft',
    );
    expect(totals('bill')).toHaveTextContent('₹0');
    expect(within(drawer).getByTestId('invoice-drawer-save')).toHaveTextContent(
      'Create clinic invoice',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('opens on its first step with the URL’s patient picked, named in the summary', async () => {
    renderCreate({ patientId: DHARTI });
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-step-party')).toHaveAttribute(
      'data-status',
      'open',
    );
    await waitFor(() =>
      expect(within(drawer).getByTestId('invoice-drawer-footer')).toHaveTextContent(
        'Clinic · Dharti Galani · 0 items',
      ),
    );
    // The open step's sub line names its values (H:3840).
    expect(within(drawer).getByTestId('invoice-drawer-step-party')).toHaveTextContent(
      'Dharti Galani',
    );
  });

  it('adds a line from the quick line — "corn 2 10%": two, 10% off — and totals it', async () => {
    const user = setUser();
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 2 10%');
    const rows = screen.getAllByTestId('invoice-drawer-items-row');
    expect(rows).toHaveLength(1);
    const row = within(rows[0] as HTMLElement);
    expect(row.getByRole('spinbutton', { name: 'Qty' })).toHaveValue('2');
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('10');
    expect(row.getByRole('textbox', { name: 'Final' })).toHaveValue('1800');
    expect(totals('subtotal')).toHaveTextContent('₹2,000');
    expect(totals('discount-gst')).toHaveTextContent('−₹200 · +₹0');
    expect(totals('bill')).toHaveTextContent('₹1,800');
    expect(totals('due')).toHaveTextContent('₹1,800');
    expect(screen.getByTestId('invoice-drawer-badges')).toHaveTextContent('₹1,800 due');
  });

  it('names a live offer when it prices a line — "Navratri glow applied to Back Peeling"', async () => {
    const user = setUser();
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'back 1');
    expect(notifyMock.info).toHaveBeenCalledWith('Navratri glow applied to Back Peeling');
    // ₹3,000 at 20% off: the effective price is the rate (Q-O2).
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    expect(row.getByText('₹2,400')).toBeInTheDocument();
    expect(totals('bill')).toHaveTextContent('₹2,400');
  });

  it('takes the overall discount before tax (Q-G7)', async () => {
    const user = setUser();
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 2');
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(screen.getByTestId('invoice-drawer-overall-discount'), '10');
    // 10% of ₹2,000 — no GST on Corn Removal.
    expect(totals('bill')).toHaveTextContent('₹1,800');
    expect(totals('discount-gst')).toHaveTextContent('−₹200');
  });

  it('back-solves the discount from a typed Final, which then holds', async () => {
    const user = setUser();
    asRole('admin');
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 2');
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    const final = row.getByRole('textbox', { name: 'Final' });
    await user.clear(final);
    await user.type(final, '1700');
    await user.tab();
    expect(row.getByRole('textbox', { name: 'Final' })).toHaveValue('1700');
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('15');
    expect(totals('bill')).toHaveTextContent('₹1,700');
  });

  it('turns a Final below the lowest price red, naming it for a role that sees floors (H:5059)', async () => {
    const user = setUser();
    asRole('admin');
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 2');
    const row = within(screen.getByTestId('invoice-drawer-items-row'));
    const final = row.getByRole('textbox', { name: 'Final' });
    await user.clear(final);
    await user.type(final, '1400');
    await user.tab();
    expect(row.getByRole('textbox', { name: 'Final' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      row.getByText('Below the lowest price ₹1,500 for Corn Removal'),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith(
      'Corn Removal is below its lowest price ₹1,500 · raise the final price',
    );
  });

  it('caps a role without `disc` at the offer price — "ask an admin" (Q-U8)', async () => {
    const user = setUser();
    asRole('front_desk');
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 1 5%');
    expect(
      screen.getByText('Too much discount on Corn Removal · ask an admin'),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith(
      'Corn Removal has more discount than allowed · raise the final price or ask an admin',
    );
  });

  it('asks for a patient, then a line, before anything is sent', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    await panel();
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick a patient');
    expect(screen.getByTestId('invoice-drawer-step-party')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('refuses "Paid now" above the bill', async () => {
    const user = setUser();
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 1');
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    await user.type(amount, '5000');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith(
      'Paid ₹5,000 is more than the bill ₹1,000',
    );
  });

  it('creates the invoice with "Full" paid now: one receipt, "Clinic invoice #N created"', async () => {
    const user = setUser();
    const { onCreated } = renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 1');
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.click(screen.getByTestId('invoice-drawer-payment-fill-full'));
    expect(totals('due')).toHaveTextContent('₹0');
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const result = onCreated.mock.calls[0]?.[0] as { detail: InvoiceDetail } | undefined;
    expect(result?.detail.balance).toMatchObject({
      bill: 100_000,
      paid: 100_000,
      status: 'paid',
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      `Clinic invoice #${result?.detail.invoice.seq} created`,
    );
  });

  it('clears the items on a switch of type, and lists a consultation’s offerings only', async () => {
    const user = setUser();
    renderCreate({ patientId: DHARTI });
    await quickAdd(user, 'corn 1');
    await user.click(screen.getByTestId('invoice-drawer-type-consultation'));
    expect(screen.getByTestId('invoice-drawer-save')).toHaveTextContent(
      'Create consultation invoice',
    );
    expect(
      within(screen.getByTestId('invoice-drawer-items-row')).queryByText('Corn Removal'),
    ).toBeNull();
    const line = screen.getByTestId('invoice-drawer-quick-line-input');
    await user.click(line);
    const options = await screen.findAllByTestId('invoice-drawer-quick-line-option');
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('Consultation · New'),
    ]);
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

  it('lets a pharmacist — Medical, no Payments — make a New sale, never a clinic invoice', async () => {
    asRole('pharmacist');
    const sale = renderCreate({}, true);
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-save')).toBeInTheDocument();
    expect(drawer).not.toHaveTextContent('View only · your role can’t change this');
    sale.unmount();
    renderCreate();
    const invoice = await panel();
    expect(invoice).toHaveTextContent('View only · your role can’t change this');
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

describe('InvoiceDrawer — Edit invoice', () => {
  it('opens a saved invoice with its number, no switch, Print and — with `void` — Delete', async () => {
    const user = setUser();
    asRole('admin');
    await renderEdit(787);
    const drawer = await panel();
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'Edit invoice',
    );
    expect(within(drawer).getByTestId('invoice-drawer-tag')).toHaveTextContent('#787');
    expect(within(drawer).getByText('Changes are logged on the invoice')).toBeVisible();
    expect(within(drawer).queryByRole('radiogroup', { name: 'Type' })).toBeNull();
    expect(within(drawer).getByTestId('invoice-drawer-save')).toHaveTextContent(
      'Save changes',
    );
    expect(within(drawer).getByTestId('invoice-drawer-delete')).toBeInTheDocument();
    await user.click(within(drawer).getByTestId('invoice-drawer-quick-fill-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('is view only for a role without Payments Edit', async () => {
    asRole('doctor');
    await renderEdit(787);
    const drawer = await panel();
    expect(
      within(drawer).getByText('View only · your role can’t change this'),
    ).toBeVisible();
    expect(within(drawer).queryByTestId('invoice-drawer-save')).toBeNull();
  });

  it('keeps a sale’s medicines read only (S:51)', async () => {
    await renderEdit(790);
    const drawer = await panel();
    expect(within(drawer).queryByTestId('invoice-drawer-quick-line-input')).toBeNull();
    expect(within(drawer).queryByTestId('invoice-drawer-items-add')).toBeNull();
    expect(within(drawer).queryByTestId('invoice-drawer-delete')).toBeNull();
  });

  it('saves a change: "Invoice #787 saved"', async () => {
    const user = setUser();
    const { onSaved } = await renderEdit(787);
    await panel();
    await user.click(screen.getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(
      screen.getByTestId('invoice-drawer-remark'),
      'Second sitting next week',
    );
    await user.click(screen.getByTestId('invoice-drawer-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // Dharti's plan row for the offering is linked again (H:4410).
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Invoice #787 saved · offering suggestions updated',
    );
    expect(clinicFixtures.invoices.snapshot((row) => row.seq === 787)[0]?.remark).toBe(
      'Second sitting next week',
    );
  });
});

describe('InvoiceDrawer — phone (below md)', () => {
  it('fills the screen, the item rows wrapping without their heads', async () => {
    viewport.tier = 'phone';
    const user = setUser();
    renderCreate({ patientId: DHARTI });
    const drawer = await panel();
    await quickAdd(user, 'corn 1');
    expect(within(drawer).queryByTestId('invoice-drawer-items-header')).toBeNull();
    expect(within(drawer).getByTestId('invoice-drawer-close')).toBeInTheDocument();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });
});
