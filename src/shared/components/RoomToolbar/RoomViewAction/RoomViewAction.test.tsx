import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ClipboardList, Tag } from '@/shared/icons/index.ts';

import { RoomViewAction } from './RoomViewAction.tsx';

describe('RoomViewAction', () => {
  it('collapses to its named icon below xl and runs on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <RoomViewAction
        actionId="discount"
        tableId="medical-medicines"
        icon={Tag}
        label="Sell all at 20% off"
        onClick={onClick}
      />,
    );
    const action = screen.getByTestId('medical-medicines-view-action-discount');
    expect(action).toHaveAccessibleName('Sell all at 20% off');
    expect(action).toHaveClass('max-xl:w-9');
    expect(screen.getByText('Sell all at 20% off')).toHaveClass('max-xl:sr-only');
    await user.click(action);
    expect(onClick).toHaveBeenCalledOnce();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps its label at every width without collapse', async () => {
    const { container } = render(
      <RoomViewAction
        actionId="check"
        tableId="stock-items"
        icon={ClipboardList}
        label="Stock check"
        collapse={false}
        iconClassName="size-3.75"
      />,
    );
    const action = screen.getByRole('button', { name: 'Stock check' });
    expect(action).not.toHaveClass('max-xl:w-9');
    expect(screen.getByText('Stock check')).not.toHaveClass('max-xl:sr-only');
    expect(action.querySelector('svg')).toHaveClass('size-3.75');
    expect(await axe(container)).toHaveNoViolations();
  });
});
