import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import type { SplitRow } from './split-rows.ts';
import { SplitRowsField } from './SplitRowsField.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const T = 'rows';

/** A form holding the rows, as Receive payment and Give back hold them. */
function Rows({ start, limit }: { start: SplitRow[]; limit: number | null }) {
  const form = useForm<{ note: string; splits: SplitRow[] }>({
    defaultValues: { note: '', splits: start },
  });
  const rows = useWatch({ control: form.control, name: 'splits' });
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <SplitRowsField
      control={form.control}
      label="Paid back by"
      rows={rows}
      limit={limit}
      addLabel="Add another mode"
      total={`Total ${total / 100}`}
      testId={T}
    />
  );
}

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('SplitRowsField (H:5071)', () => {
  it('draws Mode · Amount rows with the total at their foot', async () => {
    const { container } = renderWithProviders(
      <Rows start={[{ mode: 'upi', amount: 50_000 }]} limit={50_000} />,
    );
    expect(await screen.findByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByTestId(`${T}-mode`)).toHaveTextContent('UPI');
    expect(screen.getByTestId(`${T}-amount`)).toHaveValue('500');
    expect(screen.getByTestId(`${T}-total`)).toHaveTextContent('Total 500');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds the next mode with what is left, until every mode is used', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderWithProviders(
      <Rows start={[{ mode: 'upi', amount: 30_000 }]} limit={50_000} />,
    );
    await user.click(await screen.findByTestId(`${T}-add`));
    const amounts = screen.getAllByTestId(`${T}-amount`);
    expect(amounts).toHaveLength(2);
    expect(amounts[1]).toHaveValue('200');
    expect(screen.getAllByTestId(`${T}-mode`)[1]).toHaveTextContent('Cash');
    expect(screen.getByTestId(`${T}-total`)).toHaveTextContent('Total 500');
    await user.click(screen.getByTestId(`${T}-add`));
    expect(screen.getAllByTestId(`${T}-mode`)[2]).toHaveTextContent('Card');
    await waitFor(() => expect(screen.queryByTestId(`${T}-add`)).toBeNull());
  });

  it('clears the last row back to an empty UPI one', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderWithProviders(<Rows start={[{ mode: 'cash', amount: 30_000 }]} limit={null} />);
    await user.click(await screen.findByTestId(`${T}-remove`));
    expect(screen.getAllByTestId(`${T}-row`)).toHaveLength(1);
    expect(screen.getByTestId(`${T}-mode`)).toHaveTextContent('UPI');
    expect(screen.getByTestId(`${T}-amount`)).toHaveValue('');
  });
});
