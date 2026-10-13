import { screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { RecordDrawerPending } from './record-drawer-pending.tsx';

describe('RecordDrawerPending', () => {
  it('shows the drawer’s shell over a skeleton, with nothing to save', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onClose = vi.fn();
    renderWithProviders(
      <RecordDrawerPending
        open
        onClose={onClose}
        title="Edit offering"
        sub="Used in bookings, invoices and packages"
        recordLabel="Offering"
        testId="offering-drawer"
      />,
    );
    const panel = await screen.findByTestId('offering-drawer');
    expect(within(panel).getByTestId('offering-drawer-title')).toHaveTextContent(
      'Edit offering',
    );
    expect(within(panel).getByTestId('offering-drawer-skeleton')).toBeInTheDocument();
    expect(within(panel).queryByTestId('offering-drawer-save')).not.toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
    await user.click(within(panel).getByTestId('offering-drawer-dismiss'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
