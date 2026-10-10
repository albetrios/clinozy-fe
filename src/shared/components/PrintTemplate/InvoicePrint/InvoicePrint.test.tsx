import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import { PRINT_TEMPLATE_TEST_IDS } from '@/shared/components/PrintTemplate/print-template.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { invoiceDetail, TEST_PEEL_ID } from '@/tests/utils/invoice-doubles.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';

import { InvoicePrint, type InvoicePrintProps } from './InvoicePrint.tsx';

/** One line of Research Peel as the server priced it: ₹1,650.50 × 2, 10% off, 18% GST on top. */
const PEEL_LINE: InvoiceRecord['items'][number] = {
  id: 'iitm_peel0000000000000000',
  lineNumber: 1,
  offeringId: TEST_PEEL_ID,
  medicineId: null,
  name: 'Research Peel',
  packSize: null,
  qty: 2,
  rate: 1650.5,
  discountPct: 10,
  discountAmount: 330.1,
  gstPct: 18,
  isGstInclusive: false,
  taxableAmount: 2970.9,
  gstAmount: 534.76,
  amount: 3505.66,
  suggestionId: null,
  patientOfferingId: null,
  treatmentIds: [],
  batchNo: null,
};

/** A clinic invoice with that line, ₹1,000 paid — as `fetchInvoice` reads it. */
const peelInvoice = (overrides: Partial<InvoiceRecord> = {}) =>
  invoiceRecord({
    type: 'clinic',
    items: [PEEL_LINE],
    subtotal: 3301,
    discountTotal: 330.1,
    taxableTotal: 2970.9,
    gstTotal: 534.76,
    total: 3505.66,
    paid: 1000,
    due: 2505.66,
    status: 'partial',
    remark: null,
    ...overrides,
  });

/** The sheet's props for an invoice, as `invoiceSheet` hands them. */
function propsFor(invoice: InvoiceRecord = peelInvoice()): InvoicePrintProps {
  const detail = invoiceDetail(invoice);
  return {
    invoice: detail.invoice,
    sale: detail.sale,
    party: detail.party,
    organization: detail.sheet.organization,
    branch: detail.sheet.branch,
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
    useLocaleStore.setState({ formatLocale: 'en-IN', currencyCode: 'INR' });
  });

  afterEach(() => {
    useLocaleStore.setState({
      formatLocale: 'en-US',
      currencyCode: 'USD',
      numberStyle: 'auto',
    });
  });

  it('prints the patient and the invoice details — its statutory number (H:437–438)', () => {
    render(<InvoicePrint {...propsFor()} />);
    expect(screen.getByText('Patient Information')).toBeInTheDocument();
    expect(screen.getByText('Invoice Details')).toBeInTheDocument();
    expect(field('Name:')).toHaveTextContent('Kavya Mehta');
    expect(field('Name:')).toHaveClass('uppercase', 'font-bold');
    // "91" and the ten digits.
    expect(field('Phone:')).toHaveTextContent('919825005865');
    expect(field('Invoice Date:')).toHaveTextContent('10/10/2026');
    expect(field('Invoice #:')).toHaveTextContent('2026-27/0005');
    expect(field('Status:')).toHaveTextContent('Partly paid');
    expect(field('Status:')).toHaveClass('uppercase');
  });

  it("prints each line's amount, discount, GST and net as the server keeps them, and their totals (H:442–444)", () => {
    render(<InvoicePrint {...propsFor()} />);
    expect(tableRows()).toEqual([
      ['Item', 'Pack Size', 'Qty', 'Amount', 'Discount', 'GST', 'Net Amt.'],
      ['Research Peel', '', '2', '₹3,301.00', '10.00%', '18.00%', '₹3,505.66'],
      ['', '₹3,301.00', '330.10', '₹534.76', '₹3,505.66'],
    ]);
  });

  it('summarises the payment: the taxable amount and its GST make the bill, what is due after what was paid', () => {
    render(<InvoicePrint {...propsFor()} />);
    const summary = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.invoiceSummary);
    expect(
      within(summary).getByText('Taxable Amount:').nextElementSibling,
    ).toHaveTextContent('₹2,970.90');
    expect(within(summary).getByText('GST:').nextElementSibling).toHaveTextContent(
      '₹534.76',
    );
    expect(
      within(summary).getByText('Bill Amount:').nextElementSibling,
    ).toHaveTextContent('₹3,505.66');
    expect(
      within(summary).getByText('Balance Due:').nextElementSibling,
    ).toHaveTextContent('₹2,505.66');
  });

  it('prints PAID once nothing is due', () => {
    render(
      <InvoicePrint
        {...propsFor(peelInvoice({ paid: 3505.66, due: 0, status: 'paid' }))}
      />,
    );
    expect(field('Status:')).toHaveTextContent('Paid');
    expect(screen.getByText('Balance Due:').nextElementSibling).toHaveTextContent(
      '₹0.00',
    );
  });

  it('prints the Remark as the note, else "No additional notes"', () => {
    const { unmount } = render(
      <InvoicePrint {...propsFor(peelInvoice({ remark: 'Free first visit' }))} />,
    );
    expect(screen.getByText('Free first visit')).toBeInTheDocument();
    unmount();
    render(<InvoicePrint {...propsFor()} />);
    expect(screen.getByText('No additional notes')).toBeInTheDocument();
  });

  it('prints a sale in the Medical form, numbered by the sale (medical.md:137–146)', () => {
    const props = propsFor(
      peelInvoice({
        type: 'medical',
        items: [{ ...PEEL_LINE, name: 'Admosh UV Sunscreen 60g', offeringId: null }],
      }),
    );
    render(<InvoicePrint {...props} sale={{ seq: 983 }} />);
    expect(screen.getByText('Customer Information')).toBeInTheDocument();
    expect(screen.getByText('Sale Details')).toBeInTheDocument();
    expect(field('Sale #:')).toHaveTextContent('S-983');
    expect(screen.getByText('Medicine Items')).toBeInTheDocument();
    const [header, sunscreen] = tableRows();
    expect(header?.[0]).toBe('Medicine Name');
    // The pack size is read from the name, printed upper case (H:4416).
    expect(sunscreen?.slice(0, 2)).toEqual(['Admosh UV Sunscreen 60g', '60g']);
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer)).toHaveTextContent(
      'Thank you for choosing Demo Organization for your medicine needs',
    );
  });

  it('prints a line’s own pack size, else the one in its name', () => {
    render(
      <InvoicePrint
        {...propsFor(
          peelInvoice({
            items: [
              { ...PEEL_LINE, id: 'iitm_a', name: 'Arganlif Hair Serum 50 ml' },
              { ...PEEL_LINE, id: 'iitm_b', name: 'Sunscreen SPF 50 gel 1.5g' },
              { ...PEEL_LINE, id: 'iitm_c', name: 'Kojic soap', packSize: '75 g bar' },
              { ...PEEL_LINE, id: 'iitm_d', name: 'Densyl-AD Shampoo' },
            ],
          }),
        )}
      />,
    );
    expect(
      tableRows()
        .slice(1, 5)
        .map((row) => row[1]),
    ).toEqual(['50 ml', '1.5g', '75 g bar', '']);
  });

  it("prints the clinic's name, the branch phone and its GSTIN (GET /app/branches/my)", () => {
    const props = propsFor();
    render(
      <InvoicePrint
        {...props}
        organization={{ ...props.organization, name: 'Glow Clinic' }}
      />,
    );
    const footer = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer);
    expect(footer).toHaveTextContent(
      'Thank you for choosing Glow Clinic for your skin care needs',
    );
    expect(footer).toHaveTextContent(
      'For any queries, please contact us at +91 98000 00000',
    );
    expect(footer).toHaveTextContent('GSTIN 24ABCDE1234F1Z5');
  });

  it('prints no GSTIN for a branch without one', () => {
    const props = propsFor();
    render(
      <InvoicePrint
        {...props}
        branch={props.branch && { ...props.branch, gstNumber: null }}
      />,
    );
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer)).not.toHaveTextContent(
      'GSTIN',
    );
  });

  it('keeps money in standard notation under a compact number preference', () => {
    useLocaleStore.setState({ numberStyle: 'compact' });
    render(<InvoicePrint {...propsFor()} />);
    expect(tableRows()[2]).toEqual(['', '₹3,301.00', '330.10', '₹534.76', '₹3,505.66']);
  });

  it('has no axe violations', async () => {
    const { container } = render(<InvoicePrint {...propsFor()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
