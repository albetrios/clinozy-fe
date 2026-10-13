import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  AvatarStack,
  IdPill,
  MoneyCell,
  PersonChip,
  StatusEdge,
  TonePill,
} from './index.ts';

/** A Payments-style row built only from the cells (H:5030), as a table would. */
function InvoiceRow() {
  return (
    <div role="table" aria-label="Invoices">
      <div role="row" tabIndex={-1} className="relative grid grid-cols-5 gap-3 ps-5">
        <StatusEdge tone="peach" />
        <span role="cell">
          <IdPill>{displayId.invoice(4120)}</IdPill>
        </span>
        <span role="cell">
          <PersonChip name="Rhea Shah" sub="#3508" tone="sage" patient />
        </span>
        <span role="cell">
          <TonePill tone="butter" dot>
            Partly paid
          </TonePill>
        </span>
        <span role="cell">
          <AvatarStack
            people={[
              { id: 'rs', name: 'Riya Shah', tone: 'blush' },
              { id: 'dr', name: 'Dr. Rakesh Patel', tone: 'sky' },
              { id: 'nk', name: 'Nidhi Kapoor', tone: 'lav' },
              { id: 'ks', name: 'Kunal Shah', tone: 'mint' },
            ]}
          />
        </span>
        <span role="cell" className="text-end">
          <MoneyCell paise={-1250000} className="font-semibold" />
        </span>
      </div>
    </div>
  );
}

describe('Cells', () => {
  beforeEach(() => {
    useLocaleStore.setState({ formatLocale: 'en-IN' });
  });

  afterEach(() => {
    useLocaleStore.setState({ formatLocale: 'en-US' });
  });

  it('compose into one table row', () => {
    render(<InvoiceRow />);
    const row = screen.getByRole('row');
    expect(within(row).getByText('INV-4120')).toBeInTheDocument();
    expect(within(row).getByText('Rhea Shah')).toBeInTheDocument();
    expect(
      within(row).getByText('Partly paid').closest('[data-slot="pill"]'),
    ).toHaveClass('bg-tone-butter');
    expect(within(row).getByTestId('avatar-stack-more')).toHaveTextContent('+1');
    expect(within(row).getByText('−₹12,500')).toBeInTheDocument();
  });

  it('a composed row has no accessibility violations', async () => {
    const { container } = render(<InvoiceRow />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
