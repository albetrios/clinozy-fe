import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';

import { PRINT_TEMPLATE_TEST_IDS } from './print-template.constants.ts';
import { PrintBox, PrintField, PrintFooter, PrintSheet } from './PrintTemplate.tsx';

const organization = { name: 'Glow Dental Studio', specialties: ['dental' as const] };
const branch = { phone: '+917490020098', gstNumber: '24AAKFC4821M2Z5' };

function Sheet() {
  return (
    <PrintSheet kind="invoice" testId="demo-print">
      <PrintBox title="Invoice Details" titleClassName="pb-[1.6mm]">
        <dl>
          <PrintField label="Invoice #:" value="INV-787" strong />
        </dl>
      </PrintBox>
      <PrintFooter kind="invoice" organization={organization} branch={branch} />
    </PrintSheet>
  );
}

describe('PrintSheet', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('is an A4 sheet in the print language, its content box clear of the letterhead', () => {
    render(<Sheet />);
    const sheet = screen.getByTestId('demo-print');
    expect(sheet).toHaveAttribute('lang', 'en');
    expect(sheet).toHaveAttribute('dir', 'ltr');
    expect(sheet).toHaveClass('min-h-[297mm]', 'w-[210mm]', 'pt-[38.1mm]', 'ps-[23.3mm]');
    expect(sheet.firstElementChild).toHaveClass('w-[169.5mm]');
  });

  it('leaves the prescription its own letterhead space', () => {
    render(
      <PrintSheet kind="prescription" testId="rx-sheet">
        <p>Rx</p>
      </PrintSheet>,
    );
    const sheet = screen.getByTestId('rx-sheet');
    expect(sheet).toHaveClass('pt-[42.3mm]', 'ps-[19mm]');
    expect(sheet.firstElementChild).toHaveClass('w-[178.1mm]');
  });

  it('pairs a label with its value, the value in bold when asked', () => {
    render(<Sheet />);
    expect(screen.getByText('Invoice #:').tagName).toBe('DT');
    expect(screen.getByText('INV-787')).toHaveClass('font-bold');
  });

  it('prints English whatever language the screen is in (Q-X2)', async () => {
    await ensureNamespace('de', 'common');
    await i18n.changeLanguage('de');
    render(<Sheet />);
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer)).toHaveTextContent(
      'Thank you for choosing Glow Dental Studio for your dental care needs',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<Sheet />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PrintFooter', () => {
  it("thanks the organization for its specialty and gives the branch's phone and GSTIN", () => {
    render(<Sheet />);
    const footer = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer);
    expect(footer).toHaveTextContent(
      'Thank you for choosing Glow Dental Studio for your dental care needs',
    );
    expect(footer).toHaveTextContent(
      'For any queries, please contact us at +91 74900 20098',
    );
    expect(footer).toHaveTextContent('GSTIN 24AAKFC4821M2Z5');
    expect(footer).not.toHaveTextContent('Cresence Skin');
  });

  it('thanks a Medical customer for their medicine needs', () => {
    render(
      <PrintFooter
        kind="invoice"
        organization={{ name: 'Cresence Skin', specialties: ['skin'] }}
        branch={branch}
        medical
      />,
    );
    expect(screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer)).toHaveTextContent(
      'Thank you for choosing Cresence Skin for your medicine needs',
    );
  });

  it('leaves the GSTIN out for a branch without one, and falls back to general care', () => {
    render(
      <PrintFooter
        kind="prescription"
        organization={{ name: 'Family Clinic', specialties: [] }}
        branch={{ phone: '+917490020097', gstNumber: null }}
      />,
    );
    const footer = screen.getByTestId(PRINT_TEMPLATE_TEST_IDS.footer);
    expect(footer).toHaveTextContent(
      'Thank you for choosing Family Clinic for your health care needs',
    );
    expect(footer).not.toHaveTextContent('GSTIN');
  });
});
