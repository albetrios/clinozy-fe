import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { Copy, PenLine, Receipt, Trash } from '@/shared/icons/index.ts';

import { type DataTableRowAction, DataTableRowActions } from './DataTableRowActions.tsx';

function renderActions(
  actions: DataTableRowAction[],
  props: { showPrimaryLabel?: boolean } = {},
) {
  const { container } = render(
    <TooltipProvider>
      <DataTableRowActions actions={actions} testIdPrefix="patients" {...props} />
    </TooltipProvider>,
  );
  return { container };
}

/** Whether a click stopped on its way up — the row behind would have opened. */
function watchClickPropagation() {
  const stop = vi.spyOn(Event.prototype, 'stopPropagation');
  return () => stop.mock.contexts.some((event) => (event as Event).type === 'click');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataTableRowActions', () => {
  it('puts the destructive action last, after a 1px separator', () => {
    renderActions([
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash,
        onSelect: vi.fn(),
        destructive: true,
      },
      { id: 'edit', label: 'Edit', icon: PenLine, onSelect: vi.fn() },
    ]);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Edit',
      'Delete',
    ]);
    expect(buttons[1]?.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(buttons[1]?.className).toContain('bg-destructive-tint');
  });

  it('runs the action without opening the row', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderActions([{ id: 'edit', label: 'Edit', icon: PenLine, onSelect }]);
    const stopped = watchClickPropagation();
    await user.click(screen.getByTestId('patients-row-action-edit'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(stopped()).toBe(true);
  });

  it('labels the primary action only when the row has room', () => {
    const actions: DataTableRowAction[] = [
      {
        id: 'invoice',
        label: 'New invoice',
        icon: Receipt,
        onSelect: vi.fn(),
        primary: true,
      },
    ];
    renderActions(actions);
    expect(screen.getByTestId('patients-row-action-invoice')).not.toHaveTextContent(
      'New invoice',
    );
  });

  it('shows the primary label when asked', () => {
    renderActions(
      [
        {
          id: 'invoice',
          label: 'New invoice',
          icon: Receipt,
          onSelect: vi.fn(),
          primary: true,
        },
      ],
      { showPrimaryLabel: true },
    );
    expect(screen.getByTestId('patients-row-action-invoice')).toHaveTextContent(
      'New invoice',
    );
  });

  it('lists menu actions under "More actions", destructive last', async () => {
    const user = userEvent.setup();
    const duplicate = vi.fn();
    renderActions([
      { id: 'edit', label: 'Edit', icon: PenLine, onSelect: vi.fn() },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash,
        onSelect: vi.fn(),
        destructive: true,
        menu: true,
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: Copy,
        onSelect: duplicate,
        menu: true,
      },
    ]);
    const stopped = watchClickPropagation();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(stopped()).toBe(true);
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Duplicate', 'Delete']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(duplicate).toHaveBeenCalledTimes(1);
  });

  it('meets the tablet and phone touch sizes', () => {
    renderActions([{ id: 'edit', label: 'Edit', icon: PenLine, onSelect: vi.fn() }]);
    const button = screen.getByTestId('patients-row-action-edit');
    expect(button.className).toContain('md:max-xl:min-w-9');
    expect(button.className).toContain('max-md:min-w-10');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderActions([
      { id: 'edit', label: 'Edit', icon: PenLine, onSelect: vi.fn() },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash,
        onSelect: vi.fn(),
        destructive: true,
      },
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
