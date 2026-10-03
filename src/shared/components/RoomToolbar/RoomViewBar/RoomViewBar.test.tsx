import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { FilterChip } from '@/shared/components/RoomToolbar/RoomFilters/index.ts';

import { RoomViewBar } from './RoomViewBar.tsx';

function InvoiceViews({
  onValueChange = vi.fn(),
}: {
  onValueChange?: (id: string) => void;
}) {
  const [value, setValue] = useState('clinic');
  const [within30, setWithin30] = useState(false);
  return (
    <>
      <RoomViewBar
        label="Invoice type"
        views={[
          { id: 'clinic', label: 'Clinic' },
          { id: 'medical', label: 'Medical' },
          { id: 'credit', label: 'Credit notes' },
        ]}
        value={value}
        onValueChange={(id) => {
          setValue(id);
          onValueChange(id);
        }}
        controls="invoices-list"
        chipsLabel="Expiring within"
        testIdPrefix="invoices"
      >
        <FilterChip
          label="30 days"
          tone="blush"
          pressed={within30}
          onToggle={() => setWithin30((on) => !on)}
        />
      </RoomViewBar>
      <div id="invoices-list">Rows</div>
    </>
  );
}

describe('RoomViewBar', () => {
  it('lists the sub-views as tabs, the current one selected, then its chips', () => {
    render(<InvoiceViews />);
    const bar = screen.getByTestId('invoices-view-bar');
    const tabs = within(bar).getByRole('tablist', { name: 'Invoice type' });
    expect(within(tabs).getByRole('tab', { name: 'Clinic' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('invoices-view-medical')).toHaveAttribute(
      'aria-controls',
      'invoices-list',
    );
    const chips = within(bar).getByRole('group', { name: 'Expiring within' });
    expect(within(chips).getByRole('button', { name: '30 days' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('opens a view on a click, or on Enter after the arrows', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<InvoiceViews onValueChange={onValueChange} />);
    await user.click(screen.getByRole('tab', { name: 'Medical' }));
    expect(onValueChange).toHaveBeenLastCalledWith('medical');

    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith('credit');
    expect(screen.getByRole('tab', { name: 'Credit notes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('toggles its chips with the 1.5px ring in the chip ink', async () => {
    const user = userEvent.setup();
    render(<InvoiceViews />);
    const chip = screen.getByRole('button', { name: '30 days' });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    // The ring is drawn in the chip's ink: the button carries the tone's text colour.
    expect(chip.className).toContain('ring-[1.5px]');
    expect(chip.className).toContain('ring-current');
    expect(chip.className).toContain('text-tone-blush-foreground');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<InvoiceViews />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
