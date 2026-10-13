import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { pickerTestIds } from '@/shared/components/Picker/index.ts';
import { renderWithQueryClient } from '@/tests/utils/renderWithProviders.tsx';

import { OrgListControls } from './OrgListControls.tsx';

function renderControls() {
  const onSearchChange = vi.fn();
  const onSortChange = vi.fn();
  const view = renderWithQueryClient(
    <OrgListControls
      search=""
      onSearchChange={onSearchChange}
      sort="nameAsc"
      onSortChange={onSortChange}
      searchPlaceholder="Search items…"
      searchTestId="items-search"
      sortTestId="items-sort"
    />,
  );
  return { ...view, onSearchChange, onSortChange };
}

describe('OrgListControls', () => {
  it('forwards search input and exposes the sort picker', async () => {
    const user = userEvent.setup();
    const { container, onSearchChange } = renderControls();

    await user.type(screen.getByTestId('items-search'), 'a');
    expect(onSearchChange).toHaveBeenCalled();
    expect(screen.getByTestId('items-sort')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports the sort picked from the picker', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderControls();
    const sort = pickerTestIds('items-sort');

    await user.click(screen.getByTestId(sort.trigger));
    await user.click(await screen.findByTestId(sort.option('newest')));
    expect(onSortChange).toHaveBeenCalledWith('newest');
  });
});
