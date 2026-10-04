import { type ColumnDef, useTable } from '@tanstack/react-table';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPaletteLazy } from '@/shared/components/CommandPalette/index.ts';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import type { PickerOption } from '@/shared/components/Picker/picker.types.ts';
import { useStackedDrawer } from '@/shared/hooks/useStackedDrawer/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { PenLine, Receipt, Trash } from '@/shared/icons/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { RecordDrawer } from './RecordDrawer.tsx';

/**
 * The Esc chain (KICKOFF §6.0; `_patterns.md:271`): Esc closes the top-most
 * surface first — the command menu, then an open list or menu, then a stacked
 * child drawer, then the drawer — and the table selection waits under all of
 * them. Every surface is a Radix layer in one stack, so the order is the
 * order they opened in; nothing below the top hears the key.
 */

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

// The command engine stays out: the menu's dialog is the shell's, and the
// shell is what joins the layer stack.
vi.mock('@/shared/components/CommandPalette/CommandPalette.tsx', () => ({
  CommandPaletteContent: () => <input aria-label="Search" />,
}));

const user = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const STATUSES: PickerOption[] = [
  { key: 'scheduled', label: 'Scheduled', tone: 'butter' },
  { key: 'confirmed', label: 'Confirmed', tone: 'sky' },
];

/** A status field, as a drawer's form has one. */
function StatusField() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Picker
      label="Status"
      options={STATUSES}
      value={value}
      onChange={setValue}
      testId="status"
    />
  );
}

/** A purchase drawer whose "New supplier" opens a full drawer on top (S:116). */
function PurchasePage({ onParentClose }: { onParentClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const child = useStackedDrawer<{ name: string }>(() => {});
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        New purchase
      </button>
      <RecordDrawer
        open={open}
        title="New purchase"
        testId="po"
        onClose={() => {
          onParentClose?.();
          setOpen(false);
        }}
      >
        <StatusField />
        <button type="button" onClick={() => child.open('Medline')}>
          New supplier
        </button>
      </RecordDrawer>
      <RecordDrawer
        open={child.isOpen}
        stacked
        title="New supplier"
        testId="sup"
        onClose={child.close}
      >
        <Picker
          label="Supplier type"
          options={STATUSES}
          value={null}
          onChange={() => {}}
          testId="kind"
        />
      </RecordDrawer>
      <CommandPaletteLazy />
    </>
  );
}

const menuOpen = () => screen.queryByRole('dialog', { name: 'Command menu' });

async function openPurchase(props: { onParentClose?: () => void } = {}) {
  const u = user();
  renderWithProviders(<PurchasePage {...props} />);
  await u.click(await screen.findByRole('button', { name: 'New purchase' }));
  const title = await screen.findByTestId('po-title');
  await waitFor(() => expect(title).toHaveFocus());
  return { u, title };
}

beforeEach(() => {
  viewport.tier = 'desktop';
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  act(() => useUIStore.setState({ commandPaletteOpen: false }));
});

describe('Esc layers — the command menu over a drawer', () => {
  it('one Esc closes the menu alone and hands focus back into the drawer; the next closes the drawer', async () => {
    const onParentClose = vi.fn();
    const { u, title } = await openPurchase({ onParentClose });

    await u.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('dialog', { name: 'Command menu' })).toBeVisible();

    await u.keyboard('{Escape}');

    await waitFor(() => expect(menuOpen()).toBeNull());
    expect(screen.getByTestId('po')).toBeInTheDocument();
    expect(onParentClose).not.toHaveBeenCalled();
    expect(title).toHaveFocus();

    await u.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('po')).toBeNull());
    expect(onParentClose).toHaveBeenCalledTimes(1);
  });

  it('a press outside the menu closes the menu, not the drawer under it', async () => {
    const onParentClose = vi.fn();
    const { u } = await openPurchase({ onParentClose });

    await u.keyboard('{Control>}k{/Control}');
    await screen.findByRole('dialog', { name: 'Command menu' });
    const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    await u.click(overlay!);

    await waitFor(() => expect(menuOpen()).toBeNull());
    expect(screen.getByTestId('po')).toBeInTheDocument();
    expect(onParentClose).not.toHaveBeenCalled();
  });
});

describe('Esc layers — a Picker open inside a drawer', () => {
  it.each<[string, ViewportTier, string]>([
    ['the popover from md up', 'desktop', 'popover'],
    ['the bottom sheet on a phone', 'phone', 'sheet'],
  ])('Esc closes %s first, then the drawer', async (_, tier, surface) => {
    viewport.tier = tier;
    const onParentClose = vi.fn();
    const { u } = await openPurchase({ onParentClose });

    const trigger = screen.getByTestId('status');
    await u.click(trigger);
    const panel = await screen.findByTestId('status-panel');
    expect(panel).toHaveAttribute('data-picker-surface', surface);

    await u.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('status-panel')).toBeNull());
    expect(screen.getByTestId('po')).toBeInTheDocument();
    expect(onParentClose).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());

    await u.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('po')).toBeNull());
    expect(onParentClose).toHaveBeenCalledTimes(1);
  });
});

describe('Esc layers — a stacked child drawer over its parent', () => {
  it('peels one layer per Esc: menu, list, child drawer, parent drawer', async () => {
    const onParentClose = vi.fn();
    const { u } = await openPurchase({ onParentClose });

    await u.click(screen.getByRole('button', { name: 'New supplier' }));
    await waitFor(() => expect(screen.getByTestId('sup-title')).toHaveFocus());
    await u.click(screen.getByTestId('kind'));
    await screen.findByTestId('kind-panel');
    await u.keyboard('{Meta>}k{/Meta}');
    await screen.findByRole('dialog', { name: 'Command menu' });

    await u.keyboard('{Escape}');
    await waitFor(() => expect(menuOpen()).toBeNull());
    expect(screen.getByTestId('kind-panel')).toBeInTheDocument();

    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('kind-panel')).toBeNull());
    expect(screen.getByTestId('sup')).toBeInTheDocument();

    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('sup')).toBeNull());
    expect(screen.getByTestId('po')).toBeInTheDocument();
    expect(onParentClose).not.toHaveBeenCalled();

    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('po')).toBeNull());
    expect(onParentClose).toHaveBeenCalledTimes(1);
  });
});

interface Person {
  id: string;
  name: string;
}

const PEOPLE: Person[] = [
  { id: 'p1', name: 'Asha Rao' },
  { id: 'p2', name: 'Ravi Menon' },
  { id: 'p3', name: 'Meera Iyer' },
];

const COLUMNS: ColumnDef<DataTableFeatures, Person>[] = [
  { accessorKey: 'name', header: 'Name', meta: { track: 'minmax(200px,1fr)' } },
];

const ACTIONS: DataTableRowAction[] = [
  { id: 'invoice', label: 'New invoice', icon: Receipt, onSelect: () => {} },
  { id: 'edit', label: 'Edit', icon: PenLine, onSelect: () => {}, menu: true },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash,
    onSelect: () => {},
    destructive: true,
    menu: true,
  },
];

/** A list whose rows open a drawer, with selection, row menus and the command menu. */
function PeoplePage() {
  const [opened, setOpened] = useState<string | null>(null);
  const table = useTable({
    features: dataTableFeatures,
    data: PEOPLE,
    columns: COLUMNS,
    getRowId: (row) => row.id,
  });
  return (
    <>
      <DataTable
        table={table}
        tableId="people"
        selectable
        rowActions={() => ACTIONS}
        onRowClick={(row) => setOpened(row.original.name)}
      />
      <RecordDrawer
        open={opened !== null}
        title={opened ?? ''}
        testId="person"
        onClose={() => setOpened(null)}
      />
      <CommandPaletteLazy />
    </>
  );
}

const bulkBar = () => screen.queryByRole('toolbar', { name: 'Bulk actions' });

async function selectTwo() {
  const u = user();
  renderWithProviders(<PeoplePage />);
  await u.click(await screen.findByRole('checkbox', { name: 'Select Asha Rao' }));
  await u.click(screen.getByRole('checkbox', { name: 'Select Ravi Menon' }));
  expect(bulkBar()).toHaveTextContent('2 selected');
  return u;
}

describe('Esc layers — the table selection waits under every surface', () => {
  it('an open drawer takes the first Esc and keeps the selection; the next Esc clears it', async () => {
    const u = await selectTwo();

    await u.click(screen.getByText('Meera Iyer'));
    await waitFor(() => expect(screen.getByTestId('person-title')).toHaveFocus());

    await u.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('person')).toBeNull());
    expect(bulkBar()).toHaveTextContent('2 selected');

    await u.keyboard('{Escape}');

    await waitFor(() => expect(bulkBar()).toBeNull());
  });

  it('the command menu takes Esc before the selection', async () => {
    const u = await selectTwo();

    await u.keyboard('{Meta>}k{/Meta}');
    await screen.findByRole('dialog', { name: 'Command menu' });
    await u.keyboard('{Escape}');

    await waitFor(() => expect(menuOpen()).toBeNull());
    expect(bulkBar()).toHaveTextContent('2 selected');
  });

  it('an open row menu takes Esc before the selection', async () => {
    const u = await selectTwo();
    const row = screen.getByText('Meera Iyer').closest<HTMLElement>('[role="row"]');

    await u.click(within(row!).getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menu')).toBeVisible();
    await u.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(bulkBar()).toHaveTextContent('2 selected');
  });
});
