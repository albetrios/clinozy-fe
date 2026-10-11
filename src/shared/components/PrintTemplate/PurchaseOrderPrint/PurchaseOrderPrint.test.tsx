import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { MedicalPurchaseOrder } from '@/shared/api/app/app-schema.ts';
import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  clinicOrganization,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import { PRINT_TEMPLATE_TEST_IDS } from '@/shared/components/PrintTemplate/print-template.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  PurchaseOrderPrint,
  type PurchaseOrderPrintProps,
} from './PurchaseOrderPrint.tsx';

/** The fixture records behind one printed order, as the Purchase order view passes them. */
function propsFor(
  seq: number,
  overrides: Partial<MedicalPurchaseOrder> = {},
): PurchaseOrderPrintProps {
  const found = appFixtures.purchaseOrders.snapshot((row) => row.seq === seq)[0];
  if (!found) throw new Error(`purchase order #${seq}`);
  const order = { ...found, ...overrides };
  const medicines = appFixtures.medicines.snapshot();
  const supplier = appFixtures.suppliers.snapshot(
    (row) => row.id === order.supplierId,
  )[0];
  const branch = appFixtures.branches.snapshot((row) => row.isMain)[0];
  if (!(supplier && branch)) throw new Error(`the supplier and branch of #${seq}`);
  return {
    order,
    itemNames: order.items.map(
      (item) => medicines.find((row) => row.id === item.medicineId)?.name ?? '',
    ),
    supplier,
    organization: clinicOrganization(),
    branch,
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
    resetAppFixtures();
    useLocaleStore.setState({ formatLocale: 'en-IN', currencyCode: 'INR' });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAppFixtures();
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
          medicineId: ref.medicine(454),
          qty: 5,
          free: 0,
          rate: 18_200,
          batchNo: 'ASC002',
          expiry: '12/27',
          received: true,
        },
        {
          medicineId: ref.medicine(457),
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
