import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRINT_TEMPLATE_TEST_IDS } from '@/shared/components/PrintTemplate/print-template.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  PurchaseOrderPrint,
  type PurchaseOrderPrintProps,
} from './PurchaseOrderPrint.tsx';

type PrintedOrder = PurchaseOrderPrintProps['order'];
type PrintedLine = PrintedOrder['items'][number];

/** One line as the sheet takes it — the rate in paise — not yet received. */
const line = (
  medicineId: string,
  qty: number,
  free: number,
  rate: number,
): PrintedLine => ({
  medicineId,
  qty,
  free,
  rate,
  batchNo: null,
  expiry: null,
  received: false,
});

/** The medicines the orders below buy, by id. */
const MEDICINE_NAMES: Readonly<Record<string, string>> = {
  med_ascorbic0000000000000: 'Ascorbic Serum',
  med_eberconaz000000000000: 'Eberconazole Cream',
  med_sunscreen000000000000: 'Sunscreen SPF 50',
  med_clonixlot000000000000: 'Clonix-B Lotion',
};

/**
 * The orders as the Purchase order view passes them: PO #431 (received, unpaid — ₹2,980) to
 * Shree Ramdev Medical Agency, and PO #428 (paid ₹1,200 of ₹1,296 — it owes nothing, H:5421) to
 * Akshar Medicines.
 */
const ORDERS: Readonly<
  Record<number, { order: PrintedOrder; supplier: string; phone: string }>
> = {
  431: {
    order: {
      seq: 431,
      date: '2026-09-25',
      stage: 'received',
      supplierBillNo: '1631',
      items: [
        {
          ...line('med_ascorbic0000000000000', 5, 0, 18_200),
          batchNo: 'ASC002',
          expiry: '12/27',
          received: true,
        },
        { ...line('med_eberconaz000000000000', 3, 1, 69_000), received: true },
      ],
      paid: 0,
    },
    supplier: 'Shree Ramdev Medical Agency',
    phone: '+918866672532',
  },
  428: {
    order: {
      seq: 428,
      date: '2026-09-22',
      stage: 'paid',
      supplierBillNo: '25420',
      items: [
        { ...line('med_sunscreen000000000000', 5, 0, 12_300), received: true },
        { ...line('med_clonixlot000000000000', 3, 0, 22_700), received: true },
      ],
      paid: 120_000,
    },
    supplier: 'Akshar Medicines',
    phone: '+919904765865',
  },
};

/** The records behind one printed order, as the Purchase order view passes them. */
function propsFor(
  seq: number,
  overrides: Partial<PrintedOrder> = {},
): PurchaseOrderPrintProps {
  const found = ORDERS[seq];
  if (!found) throw new Error(`purchase order #${seq}`);
  const order = { ...found.order, ...overrides };
  return {
    order,
    itemNames: order.items.map((item) => MEDICINE_NAMES[item.medicineId] ?? ''),
    supplier: { name: found.supplier, phone: found.phone, gstNumber: '24AJPPG5277K1ZR' },
    organization: { name: 'Cresence Skin', specialties: ['skin'], currency: 'INR' },
    branch: { phone: '+917490020099', gstNumber: '24AAKFC4821M1Z6' },
  };
}

const field = (label: string) => screen.getByText(label).nextElementSibling;

/** Each row of the items table as its cells' text. */
function tableRows() {
  return within(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.purchaseOrderItems))
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
}

/** A Payment Summary figure by its label. */
const summaryValue = (label: string) =>
  within(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.purchaseOrderSummary)).getByText(
    label,
  ).nextElementSibling;

describe('PurchaseOrderPrint (Q-M7)', () => {
  beforeEach(() => {
    // On the prototype's own day, so every seed carries the prototype's dates.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T06:30:00Z'));
    useLocaleStore.setState({ formatLocale: 'en-IN', currencyCode: 'INR' });
  });

  afterEach(() => {
    vi.useRealTimers();
    useLocaleStore.setState({
      formatLocale: 'en-US',
      currencyCode: 'USD',
      numberStyle: 'auto',
    });
  });

  it('prints the supplier and the order’s details', async () => {
    const props = propsFor(428);
    const { container } = render(<PurchaseOrderPrint {...props} />);
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.purchaseOrder)).toBeInTheDocument();
    expect(screen.getByText('Supplier Information')).toBeInTheDocument();
    expect(screen.getByText('Order Details')).toBeInTheDocument();
    expect(field('Name:')).toHaveTextContent(props.supplier.name);
    expect(field('Name:')).toHaveClass('uppercase', 'font-bold');
    expect(field('Phone:')).toHaveTextContent(
      props.supplier.phone ? props.supplier.phone.slice(1) : '—',
    );
    expect(field('GSTIN:')).toHaveTextContent(props.supplier.gstNumber ?? '—');
    expect(field('Order Date:')).toHaveTextContent('22/09/2026');
    expect(field('Purchase Order:')).toHaveTextContent('PO #428');
    expect(field('Invoice No.:')).toHaveTextContent('25420');
    expect(field('Status:')).toHaveTextContent('Paid');
    expect(field('Status:')).toHaveClass('uppercase');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('prints each line — batch and expiry as received — and the totals (S:830)', () => {
    const props = propsFor(431, {
      items: [
        {
          medicineId: 'med_ascorbic0000000000000',
          qty: 5,
          free: 0,
          rate: 18_200,
          batchNo: 'ASC002',
          expiry: '12/27',
          received: true,
        },
        {
          medicineId: 'med_eberconaz000000000000',
          qty: 3,
          free: 1,
          rate: 69_000,
          batchNo: null,
          expiry: null,
          received: false,
        },
      ],
    });
    render(<PurchaseOrderPrint {...props} />);
    const [first, second] = props.itemNames;
    expect(tableRows()).toEqual([
      ['Medicine Name', 'Batch', 'Expiry', 'Qty', 'Free', 'Rate', 'Amount'],
      [first, 'ASC002', '12/27', '5', '0', '₹182.00', '₹910.00'],
      [second, '—', '—', '3', '1', '₹690.00', '₹2,070.00'],
      ['', '8', '1', '', '₹2,980.00'],
    ]);
  });

  it('summarises the bill: total, paid and what is still due', () => {
    // #431 is received and unpaid; #428 is paid — it owes nothing (H:5421).
    const { unmount } = render(<PurchaseOrderPrint {...propsFor(431)} />);
    expect(summaryValue('Total Amount:')).toHaveTextContent('₹2,980.00');
    expect(summaryValue('Paid:')).toHaveTextContent('₹0.00');
    expect(summaryValue('Balance Due:')).toHaveTextContent('₹2,980.00');
    expect(field('Status:')).toHaveTextContent('Received');
    unmount();

    render(<PurchaseOrderPrint {...propsFor(428)} />);
    expect(summaryValue('Total Amount:')).toHaveTextContent('₹1,296.00');
    expect(summaryValue('Paid:')).toHaveTextContent('₹1,200.00');
    expect(summaryValue('Balance Due:')).toHaveTextContent('₹0.00');
  });

  it('notes nothing, and signs off from the clinic, not to a patient', () => {
    const props = propsFor(428);
    render(<PurchaseOrderPrint {...props} />);
    expect(screen.getByText('No additional notes')).toBeInTheDocument();
    const footer = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer);
    expect(footer).toHaveTextContent(`Purchase order from ${props.organization.name}`);
    expect(footer).not.toHaveTextContent('Thank you');
  });
});
