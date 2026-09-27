import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OrgListControls } from './OrgListControls.tsx';

describe('OrgListControls', () => {
  it('forwards search input and exposes a sort select', async () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const user = userEvent.setup();

    render(
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

    await user.type(screen.getByTestId('items-search'), 'a');
    expect(onSearchChange).toHaveBeenCalled();
    expect(screen.getByTestId('items-sort')).toBeInTheDocument();
  });
});
