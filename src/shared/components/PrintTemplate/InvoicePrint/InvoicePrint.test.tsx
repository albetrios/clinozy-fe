import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { Invoice } from '@/shared/api/clinic/clinic-schema.ts';
import {
  clinicFixtures,
  clinicOrganization,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { PRINT_TEMPLATE_TEST_IDS } from '@/shared/components/PrintTemplate/print-template.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { InvoicePrint, type InvoicePrintProps } from './InvoicePrint.tsx';

/** The fixture records behind one printed invoice, as a screen would pass them. */
function propsFor(seq: number, overrides: Partial<Invoice> = {}): InvoicePrintProps {
  const found = clinicFixtures.invoices.snapshot((row) => row.seq === seq)[0];
  if (!found) throw new Error(`invoice #${seq}`);
  const invoice = { ...found, ...overrides };
  const branch = clinicFixtures.branches.snapshot(
    (row) => row.id === invoice.branchId,
  )[0];
  if (!branch) throw new Error(`branch of #${seq}`);
  return {
    invoice,
    sale:
      clinicFixtures.medicalSales.snapshot((row) => row.id === invoice.saleId)[0] ?? null,
    payments: clinicFixtures.payments.snapshot(),
    patient:
      clinicFixtures.patients.snapshot((row) => row.id === invoice.patientId)[0] ?? null,
    contact:
      clinicFixtures.medicalContacts.snapshot(
        (row) => row.id === invoice.medicalContactId,
      )[0] ?? null,
    organization: clinicOrganization(),
    branch,
  };
}

const field = (label: string) => screen.getByText(label).nextElementSibling;

/** Each row of the items table as its cells' text. */
function tableRows() {
  return within(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.invoiceItems))
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
}

describe('InvoicePrint', () => {
  beforeEach(() => {
    // On the prototype's own day, so every seed carries the prototype's dates.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T06:30:00Z'));
    resetClinicFixtures();
    useLocaleStore.setState({ formatLocale: 'en-IN', currencyCode: 'INR' });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetClinicFixtures();
    useLocaleStore.setState({
      formatLocale: 'en-US',
      currencyCode: 'USD',
      numberStyle: 'auto',
    });
  });

  it('prints the patient and the invoice details (H:437–438)', () => {
    const props = propsFor(791);
    render(<InvoicePrint {...props} />);
    expect(screen.getByText('Patient Information')).toBeInTheDocument();
    expect(screen.getByText('Invoice Details')).toBeInTheDocument();
    expect(field('Name:')).toHaveTextContent('Ishita Vora');
    expect(field('Name:')).toHaveClass('uppercase', 'font-bold');
    // "91" and the ten digits.
    expect(field('Phone:')).toHaveTextContent(/^91\d{10}$/);
    expect(field('Phone:')).toHaveTextContent(props.patient?.phone.slice(1) ?? '');
    expect(field('Invoice Date:')).toHaveTextContent('27/09/2026');
    expect(field('Invoice #:')).toHaveTextContent('INV-791');
    expect(field('Status:')).toHaveTextContent('Due');
    expect(field('Status:')).toHaveClass('uppercase');
  });

  it("prints each line's amount, discount, GST and net, and their totals (H:442–444)", () => {
    render(<InvoicePrint {...propsFor(791)} />);
    expect(tableRows()).toEqual([
      ['Item', 'Pack Size', 'Qty', 'Amount', 'Discount', 'GST', 'Net Amt.'],
      ['Chemical peel', '', '1', '₹3,500.00', '10.00%', '18.00%', '₹3,717.00'],
      ['', '₹3,500.00', '350.00', '₹567.00', '₹3,717.00'],
    ]);
  });

  it('summarises the payment from the ledger (H:448–451)', () => {
    render(<InvoicePrint {...propsFor(785)} />);
    const summary = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.invoiceSummary);
    expect(
      within(summary).getByText('Total Amount:').nextElementSibling,
    ).toHaveTextContent('₹1,476.40');
    expect(
      within(summary).getByText('Overall Discount:').nextElementSibling,
    ).toHaveTextContent('-₹0.00');
    expect(
      within(summary).getByText('Bill Amount:').nextElementSibling,
    ).toHaveTextContent('₹1,476.40');
    // ₹600 received by UPI (PAY-5512).
    expect(
      within(summary).getByText('Balance Due:').nextElementSibling,
    ).toHaveTextContent('₹876.40');
    expect(field('Status:')).toHaveTextContent('Partly paid');
  });

  it('takes the overall discount off the bill', () => {
    render(<InvoicePrint {...propsFor(791, { overallDiscount: 17_000 })} />);
    const summary = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.invoiceSummary);
    expect(
      within(summary).getByText('Overall Discount:').nextElementSibling,
    ).toHaveTextContent('-₹170.00');
    expect(
      within(summary).getByText('Bill Amount:').nextElementSibling,
    ).toHaveTextContent('₹3,547.00');
  });

  it('prints PAID once nothing is due', () => {
    render(<InvoicePrint {...propsFor(781)} />);
    expect(field('Status:')).toHaveTextContent('Paid');
    expect(screen.getByText('Balance Due:').nextElementSibling).toHaveTextContent(
      '₹0.00',
    );
  });

  it('prints the Remark as the note, else "No additional notes"', () => {
    const { unmount } = render(<InvoicePrint {...propsFor(786)} />);
    expect(screen.getByText('Free first visit')).toBeInTheDocument();
    unmount();
    render(<InvoicePrint {...propsFor(791)} />);
    expect(screen.getByText('No additional notes')).toBeInTheDocument();
  });

  it('prints a sale in the Medical form, numbered by the sale (medical.md:137–146)', () => {
    const props = propsFor(790);
    expect(props.sale?.seq).toBe(983);
    render(<InvoicePrint {...props} />);
    expect(screen.getByText('Customer Information')).toBeInTheDocument();
    expect(screen.getByText('Sale Details')).toBeInTheDocument();
    expect(field('Sale Date:')).toHaveTextContent('27/09/2026');
    expect(field('Sale #:')).toHaveTextContent('S-983');
    expect(screen.getByText('Medicine Items')).toBeInTheDocument();
    const [header, sunscreen] = tableRows();
    expect(header?.[0]).toBe('Medicine Name');
    // The pack size is read from the name, printed upper case (H:4416).
    expect(sunscreen?.slice(0, 2)).toEqual(['Admosh UV Sunscreen 60g', '60g']);
    expect(
      within(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.invoiceItems)).getByText('60g'),
    ).toHaveClass('uppercase');
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer)).toHaveTextContent(
      'Thank you for choosing Cresence Skin for your medicine needs',
    );
  });

  it('prints a line’s own pack size, else the one in its name', () => {
    const [peel] = propsFor(791).invoice.items;
    if (!peel) throw new Error('INV-791 line');
    render(
      <InvoicePrint
        {...propsFor(791, {
          items: [
            { ...peel, name: 'Arganlif Hair Serum 50 ml' },
            { ...peel, name: 'Sunscreen SPF 50 gel 1.5g' },
            { ...peel, name: 'Kojic soap', packSize: '75 g bar' },
            { ...peel, name: 'Densyl-AD Shampoo' },
          ],
        })}
      />,
    );
    expect(
      tableRows()
        .slice(1, 5)
        .map((row) => row[1]),
    ).toEqual(['50 ml', '1.5g', '75 g bar', '']);
  });

  it('bills a walk-in Medical customer by their own name and phone', () => {
    render(<InvoicePrint {...propsFor(789)} />);
    expect(field('Name:')).toHaveTextContent('Viral Sheth');
    expect(field('Phone:')).toHaveTextContent('919825077120');
    expect(field('Sale #:')).toHaveTextContent('S-982');
  });

  it("prints the clinic's name, the branch phone and its GSTIN, never the sample clinic", () => {
    const props = propsFor(791);
    const vesu = clinicFixtures.branches.snapshot((row) => row.name === 'Vesu')[0];
    if (!vesu) throw new Error('Vesu');
    render(
      <InvoicePrint
        {...props}
        organization={{ ...props.organization, name: 'Glow Clinic' }}
        branch={vesu}
      />,
    );
    const footer = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer);
    expect(footer).toHaveTextContent(
      'Thank you for choosing Glow Clinic for your skin care needs',
    );
    expect(footer).toHaveTextContent(
      'For any queries, please contact us at +91 74900 20098',
    );
    expect(footer).toHaveTextContent('GSTIN 24AAKFC4821M2Z5');
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.invoice)).not.toHaveTextContent(
      'Cresence',
    );
  });

  it('keeps money in standard notation under a compact number preference', () => {
    useLocaleStore.setState({ numberStyle: 'compact' });
    render(<InvoicePrint {...propsFor(791)} />);
    expect(tableRows()[2]).toEqual(['', '₹3,500.00', '350.00', '₹567.00', '₹3,717.00']);
  });

  it('has no axe violations', async () => {
    const { container } = render(<InvoicePrint {...propsFor(790)} />);
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});
