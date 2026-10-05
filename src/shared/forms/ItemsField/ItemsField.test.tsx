import { zodResolver } from '@hookform/resolvers/zod';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { type ReactElement, useEffect, useState } from 'react';
import {
  type Control,
  useController,
  useForm,
  type UseFormReturn,
} from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { z } from 'zod';

import { clinicHttpError } from '@/shared/api/clinic/clinic-fixture-store.ts';
import { invoiceLineAmounts } from '@/shared/api/clinic/clinic-money.ts';
import type { InvoiceItem, PrescriptionItem } from '@/shared/api/clinic/clinic-schema.ts';
import { MoneyCell } from '@/shared/components/Cells/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  type ExplicitDrawerWidth,
  RecordDrawer,
} from '@/shared/components/RecordDrawer/index.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import { useItemsTotal } from '@/shared/hooks/useItemsTotal/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import type { ItemsColumn } from './items-field.types.ts';
import {
  ItemsNumberCell,
  ItemsNumberInput,
  ItemsPickerCell,
  ItemsQtyCell,
  ItemsTextCell,
} from './items-field-cells.tsx';
import { ItemsField, type ItemsFieldProps } from './ItemsField.tsx';

// ── A generic host: name · qty · rate, with a note ─────────────────────────

interface Line {
  name: string;
  qty: number;
  rate: number;
  note: string;
}
interface LinesForm {
  lines: Line[];
}

const BLANK: Line = { name: '', qty: 1, rate: 0, note: '' };
const GLOVES: Line = { name: 'Nitrile gloves', qty: 2, rate: 25_000, note: '' };
const GAUZE: Line = { name: 'Gauze swabs', qty: 1, rate: 12_000, note: '' };

const LINES_SCHEMA = z.object({
  lines: z
    .array(
      z.object({
        name: z.string().min(1, 'Pick an item'),
        qty: z.number().int().min(1),
        rate: z.number().positive('Enter the rate'),
        note: z.string(),
      }),
    )
    .min(1, 'Add at least one item'),
});

const LINE_COLUMNS: ItemsColumn<LinesForm, 'lines'>[] = [
  {
    id: 'item',
    header: 'Item',
    track: 'minmax(0,2fr)',
    cell: (row) => <ItemsTextCell {...row.bind('name')} />,
  },
  {
    id: 'qty',
    header: 'Qty',
    track: '88px',
    align: 'end',
    cell: (row) => <ItemsQtyCell {...row.bind('qty')} />,
  },
  {
    id: 'rate',
    header: 'Rate',
    track: '96px',
    align: 'end',
    cell: (row) => <ItemsNumberCell {...row.bind('rate')} money />,
  },
];

type FieldOverrides = Partial<
  Omit<ItemsFieldProps<LinesForm, 'lines'>, 'control' | 'name' | 'total'>
>;

interface HarnessProps extends FieldOverrides {
  initial?: Line[];
  validate?: boolean;
  formRef?: { current: UseFormReturn<LinesForm> | null };
}

/** A purchase-like form: name · qty · rate rows, a qty × rate total, a Save button. */
function LinesHarness({
  initial = [GLOVES],
  validate = false,
  formRef,
  ...field
}: HarnessProps) {
  const form = useForm<LinesForm>({
    defaultValues: { lines: initial },
    resolver: validate ? zodResolver(LINES_SCHEMA) : undefined,
  });
  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);
  const total = useItemsTotal(form.control, 'lines', (line) => line.qty * line.rate);
  return (
    <form onSubmit={form.handleSubmit(() => {})}>
      <ItemsField
        control={form.control}
        name="lines"
        label="Items"
        columns={LINE_COLUMNS}
        newRow={() => ({ ...BLANK })}
        addLabel="Add item"
        total={<MoneyCell paise={total} />}
        totalLabel="Total"
        testId="lines"
        {...field}
      />
      <button type="submit">Save</button>
    </form>
  );
}

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const view = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { user, ...view };
}

const rows = () => screen.getAllByTestId('lines-row');

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('ItemsField — the frame (_patterns.md:139)', () => {
  it('is a table named by its label: a 34px canvas header, grid rows, the footer', async () => {
    const { container } = renderWithClient(<LinesHarness initial={[GLOVES, GAUZE]} />);

    const table = screen.getByRole('table', { name: 'Items' });
    expect(table).toHaveStyle({ '--items-cols': 'minmax(0,2fr) 88px 96px 30px' });
    const header = screen.getByTestId('lines-header');
    expect(header).toHaveClass(
      'h-8.75',
      'bg-canvas',
      'text-tiny',
      'font-semibold',
      'uppercase',
      'tracking-[0.04em]',
      'grid-cols-(--items-cols)',
    );
    const heads = within(header).getAllByRole('columnheader');
    expect(heads.map((head) => head.textContent)).toEqual([
      'Item',
      'Qty',
      'Rate',
      'Remove',
    ]);
    expect(heads[1]).toHaveClass('text-end');
    expect(within(heads[3] as HTMLElement).getByText('Remove')).toHaveClass('sr-only');

    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveClass(
      'grid',
      'grid-cols-(--items-cols)',
      'gap-2',
      'px-2.5',
      'py-1.5',
      'border-b-muted',
    );
    const rateCell = rows()[0]?.querySelector('[data-column="rate"]');
    expect(rateCell).toHaveClass('justify-end');

    const add = screen.getByTestId('lines-add');
    expect(add).toHaveAccessibleName('Add item');
    expect(add).toHaveClass('h-8', 'border-dashed', 'border-border-strong', 'rounded-lg');
    // 2 × ₹250 + ₹120, spoken as a total.
    expect(screen.getByTestId('lines-total')).toHaveTextContent('Total ₹620');
    expect(within(screen.getByTestId('lines-total')).getByText('Total')).toHaveClass(
      'sr-only',
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('names each cell control by its column and wires the shared cells to the row', () => {
    renderWithClient(<LinesHarness />);
    const [row] = rows();
    const scope = within(row as HTMLElement);
    expect(scope.getByRole('textbox', { name: 'Item' })).toHaveValue('Nitrile gloves');
    expect(scope.getByRole('spinbutton', { name: 'Qty' })).toHaveValue('2');
    expect(scope.getByRole('textbox', { name: 'Rate' })).toHaveValue('250');
    expect(scope.getByTestId('lines-rate')).toHaveClass('text-end', 'h-8');
  });
});

describe('ItemsField — add and remove rows', () => {
  it('appends a blank row and moves the focus into it', async () => {
    const { user } = renderWithClient(<LinesHarness />);

    await user.click(screen.getByTestId('lines-add'));

    expect(rows()).toHaveLength(2);
    const added = within(rows()[1] as HTMLElement);
    expect(added.getByRole('textbox', { name: 'Item' })).toHaveValue('');
    expect(added.getByRole('spinbutton', { name: 'Qty' })).toHaveValue('1');
    expect(added.getByRole('textbox', { name: 'Item' })).toHaveFocus();
  });

  it('removes a row with its × and keeps the focus in the table', async () => {
    const { user } = renderWithClient(<LinesHarness initial={[GLOVES, GAUZE]} />);

    const [first] = screen.getAllByTestId('lines-remove');
    expect(first).toHaveAccessibleName('Remove row');
    await user.click(first as HTMLElement);

    expect(rows()).toHaveLength(1);
    expect(
      within(rows()[0] as HTMLElement).getByRole('textbox', { name: 'Item' }),
    ).toHaveValue('Gauze swabs');
    expect(screen.getByTestId('lines-remove')).toHaveFocus();
    expect(screen.getByTestId('lines-total')).toHaveTextContent('₹120');

    await user.click(screen.getByTestId('lines-remove'));
    expect(screen.queryAllByTestId('lines-row')).toHaveLength(0);
    expect(screen.getByTestId('lines-add')).toHaveFocus();
    // The header stays: an empty table still shows its columns.
    expect(screen.getByTestId('lines-header')).toBeInTheDocument();
  });

  it('keeps `minRows` rows: the × on the last one clears it instead', async () => {
    const { user } = renderWithClient(<LinesHarness minRows={1} />);

    await user.click(screen.getByTestId('lines-remove'));

    expect(rows()).toHaveLength(1);
    const row = within(rows()[0] as HTMLElement);
    expect(row.getByRole('textbox', { name: 'Item' })).toHaveValue('');
    expect(row.getByRole('spinbutton', { name: 'Qty' })).toHaveValue('1');
    expect(screen.getByTestId('lines-remove')).toHaveFocus();
  });

  it('clears a kept row to its own blank when it has one (Receive’s last row back to UPI)', async () => {
    const { user } = renderWithClient(
      <LinesHarness minRows={1} clearRow={() => ({ ...BLANK, name: 'Cleared' })} />,
    );
    await user.click(screen.getByTestId('lines-remove'));
    expect(rows()).toHaveLength(1);
    expect(
      within(rows()[0] as HTMLElement).getByRole('textbox', { name: 'Item' }),
    ).toHaveValue('Cleared');
    // "+ Add item" still appends a new row.
    await user.click(screen.getByTestId('lines-add'));
    expect(rows()).toHaveLength(2);
  });

  it('drops the × column when rows cannot be removed, and both actions when read-only', () => {
    const { unmount } = renderWithClient(<LinesHarness removable={false} />);
    expect(screen.getByRole('table')).toHaveStyle({
      '--items-cols': 'minmax(0,2fr) 88px 96px',
    });
    expect(screen.queryByTestId('lines-remove')).not.toBeInTheDocument();
    expect(screen.getByTestId('lines-add')).toBeInTheDocument();
    unmount();

    renderWithClient(<LinesHarness readOnly />);
    expect(screen.queryByTestId('lines-remove')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lines-add')).not.toBeInTheDocument();
    // The total still reads in the footer.
    expect(screen.getByTestId('lines-total')).toHaveTextContent('₹500');
  });

  it('has no add button without a blank row to add', () => {
    renderWithClient(<LinesHarness newRow={undefined} />);
    expect(screen.queryByTestId('lines-add')).not.toBeInTheDocument();
  });

  it('gives the × only to the rows a rule passes; the column shows while one does', async () => {
    // Receive goods: the ordered lines stay, an added (unnamed) line can go.
    const { user, container } = renderWithClient(
      <LinesHarness removable={(line) => line.name === ''} />,
    );
    expect(screen.getByRole('table')).toHaveStyle({
      '--items-cols': 'minmax(0,2fr) 88px 96px',
    });
    expect(screen.queryByTestId('lines-remove')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('lines-add'));
    expect(screen.getByRole('table')).toHaveStyle({
      '--items-cols': 'minmax(0,2fr) 88px 96px 30px',
    });
    // One × — on the added row; the kept row holds the column with an empty cell.
    expect(screen.getAllByTestId('lines-remove')).toHaveLength(1);
    const [kept, added] = rows();
    expect(within(kept as HTMLElement).getAllByRole('cell')).toHaveLength(4);
    expect(within(added as HTMLElement).getByTestId('lines-remove')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByTestId('lines-remove'));
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('table')).toHaveStyle({
      '--items-cols': 'minmax(0,2fr) 88px 96px',
    });
  });
});

describe('ItemsField — totals', () => {
  it('re-totals as a row changes (useItemsTotal)', async () => {
    const { user } = renderWithClient(<LinesHarness initial={[GLOVES, GAUZE]} />);
    const second = within(rows()[1] as HTMLElement);

    await user.click(second.getByTestId('lines-qty-increase'));
    expect(screen.getByTestId('lines-total')).toHaveTextContent('₹740');

    const rate = second.getByRole('textbox', { name: 'Rate' });
    await user.clear(rate);
    await user.type(rate, '100.5');
    // 2 × ₹250 + 2 × ₹100.50
    expect(screen.getByTestId('lines-total')).toHaveTextContent('₹701');
  });
});

describe('ItemsField — validation at the cell (fe-http-forms-errors)', () => {
  it('shows a row field’s Zod message on its own cell', async () => {
    const { user } = renderWithClient(
      <LinesHarness validate initial={[GLOVES, { ...GAUZE, rate: 0 }]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const bad = within(rows()[1] as HTMLElement).getByRole('textbox', { name: 'Rate' });
    expect(bad).toHaveAttribute('aria-invalid', 'true');
    expect(bad).toHaveAccessibleDescription('Enter the rate');
    const good = within(rows()[0] as HTMLElement).getByRole('textbox', { name: 'Rate' });
    expect(good).not.toHaveAttribute('aria-invalid');
    // RHF focuses the first invalid field.
    expect(bad).toHaveFocus();

    // From md up the message is the cell's tooltip too.
    await user.hover(bad);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Enter the rate');
  });

  it('lands a 422 field error from the server on that row’s cell', async () => {
    const formRef: { current: UseFormReturn<LinesForm> | null } = { current: null };
    renderWithClient(<LinesHarness initial={[GLOVES, GAUZE]} formRef={formRef} />);

    const error = clinicHttpError(422, 'validation', 'Enter the rate', {
      'lines.1.rate': ['Enter the rate'],
    });
    act(() => {
      expect(mapValidationErrors(error, formRef.current?.setError ?? (() => {}))).toBe(
        true,
      );
    });

    const rate = within(rows()[1] as HTMLElement).getByRole('textbox', { name: 'Rate' });
    expect(rate).toHaveAttribute('aria-invalid', 'true');
    expect(rate).toHaveAccessibleDescription('Enter the rate');
  });

  it('takes a stored message off its cell once that cell is edited; a fresh one shows again', async () => {
    const formRef: { current: UseFormReturn<LinesForm> | null } = { current: null };
    const { user } = renderWithClient(
      <LinesHarness initial={[GLOVES, GAUZE]} formRef={formRef} />,
    );
    const flag = () =>
      act(() => {
        for (const field of ['lines.0.name', 'lines.0.qty', 'lines.1.rate'] as const) {
          formRef.current?.setError(field, { type: 'client', message: 'Check this' });
        }
      });
    flag();
    const name = within(rows()[0] as HTMLElement).getByRole('textbox', { name: 'Item' });
    const qty = within(rows()[0] as HTMLElement).getByRole('spinbutton', { name: 'Qty' });
    const rate = within(rows()[1] as HTMLElement).getByRole('textbox', { name: 'Rate' });
    for (const cell of [name, qty, rate]) {
      expect(cell).toHaveAttribute('aria-invalid', 'true');
    }

    await user.type(name, 's');
    await user.type(qty, '3');
    await user.type(rate, '5');
    for (const cell of [name, qty, rate])
      expect(cell).not.toHaveAttribute('aria-invalid');
    // The other rows' cells were never flagged.
    expect(
      within(rows()[1] as HTMLElement).getByRole('textbox', { name: 'Item' }),
    ).not.toHaveAttribute('aria-invalid');

    flag();
    for (const cell of [name, qty, rate]) {
      expect(cell).toHaveAttribute('aria-invalid', 'true');
    }
  });

  it('shows the array’s own message under the table', async () => {
    const { user } = renderWithClient(<LinesHarness validate initial={[]} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByTestId('lines-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Add at least one item');
    expect(screen.getByRole('table', { name: 'Items' })).toHaveAccessibleDescription(
      'Add at least one item',
    );
  });
});

describe('ItemsField — the note line (H:924)', () => {
  it('writes the row’s note from a dashed full-width line', async () => {
    const formRef: { current: UseFormReturn<LinesForm> | null } = { current: null };
    const onNote = vi.fn();
    const { user } = renderWithClient(
      <LinesHarness formRef={formRef} note={{ key: 'note', onChange: onNote }} />,
    );

    const note = screen.getByTestId('lines-note');
    expect(note).toHaveAccessibleName('Remarks');
    expect(note).toHaveAttribute('maxLength', '200');
    const cell = note.closest('[role="cell"]');
    expect(cell).toHaveClass('col-span-full', '-mt-0.5');
    expect(cell).toHaveAttribute('aria-colspan', '4');
    expect(note.closest('label')).toHaveClass('border-dashed', 'bg-canvas', 'h-7.5');

    await user.type(note, 'after food');
    expect(formRef.current?.getValues('lines.0.note')).toBe('after food');
    expect(onNote).toHaveBeenLastCalledWith(
      'after food',
      expect.objectContaining({ index: 0, name: 'lines.0' }),
    );
  });
});

describe('ItemsField — phone (H:95–101)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('hides the header and wraps each row: first cell full width, last at the inline end', async () => {
    const { container } = renderWithClient(
      <LinesHarness initial={[GLOVES, GAUZE]} note={{ key: 'note' }} />,
    );

    expect(screen.queryByTestId('lines-header')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);

    const [row] = rows();
    expect(row).toHaveClass(
      'flex',
      'flex-wrap',
      'gap-x-2.5',
      'gap-y-2',
      'px-3',
      'py-2.5',
    );
    expect(row).not.toHaveClass('grid');
    const cells = within(row as HTMLElement).getAllByRole('cell');
    expect(cells[0]).toHaveClass('basis-full');
    // No end alignment on a phone: every cell starts.
    expect(cells[2]).not.toHaveClass('justify-end');
    // The × is the last cell: pushed to the inline end.
    expect(cells[3]).toHaveClass('ms-auto');
    expect(
      within(cells[3] as HTMLElement).getByTestId('lines-remove'),
    ).toBeInTheDocument();
    // The note keeps a line of its own.
    expect(cells[4]).toHaveClass('basis-full');
    expect(cells[4]).not.toHaveClass('-mt-0.5');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('pushes the last column to the end when rows have no ×', () => {
    renderWithClient(<LinesHarness removable={false} />);
    const cells = within(rows()[0] as HTMLElement).getAllByRole('cell');
    expect(cells[2]).toHaveClass('ms-auto');
  });

  it('shows only the footer while there are no rows', () => {
    renderWithClient(<LinesHarness initial={[]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('lines-add')).toBeInTheDocument();
  });
});

// ── The record drawer's width rule (KICKOFF 876–879, H:3850) ───────────────

const DRAWER_CLASS = (width: number) => `md:w-[min(${width}px,calc(100vw-56px))]`;

interface DrawerHarnessProps {
  compact?: boolean;
  width?: ExplicitDrawerWidth;
  hasItems?: boolean;
  fieldCount?: number;
  inStep?: boolean;
}

/** A drawer holding a purchase's items — in its body, or in a second step. */
function DrawerHarness({
  compact = false,
  width,
  hasItems,
  fieldCount = 3,
  inStep = false,
}: DrawerHarnessProps) {
  const form = useForm<LinesForm>({ defaultValues: { lines: [GLOVES] } });
  const [open, setOpen] = useState(true);
  const [withItems, setWithItems] = useState(true);
  const items = withItems ? (
    <ItemsField
      control={form.control}
      name="lines"
      label="Items"
      columns={LINE_COLUMNS}
      compact={compact}
      testId="lines"
    />
  ) : null;
  const steps: DrawerStep[] = [
    { id: 'bill', title: 'Bill', content: <p>bill fields</p> },
    { id: 'items', title: 'Items received', content: items },
  ];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <button type="button" onClick={() => setWithItems(false)}>
        Drop items
      </button>
      <RecordDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="New purchase"
        testId="drawer"
        content={{ fieldCount, ...(hasItems === undefined ? {} : { hasItems }) }}
        width={width}
        steps={inStep ? steps : undefined}
      >
        {inStep ? null : items}
      </RecordDrawer>
    </>
  );
}

/** The drawer's dirty guard blocks navigation, so it renders under a router. */
function renderDrawer(ui: ReactElement) {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  return { user, ...renderWithProviders(ui) };
}

describe('ItemsField — the drawer width rule (resolveDrawerWidth)', () => {
  it('widens a light form to 840px once its items field mounts', async () => {
    const { baseElement } = renderDrawer(<DrawerHarness />);
    const drawer = await screen.findByTestId('drawer');
    expect(drawer).toHaveClass(DRAWER_CLASS(840));
    expect(drawer).not.toHaveClass(DRAWER_CLASS(560));
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('leaves the width alone for compact Mode · Amount rows', async () => {
    renderDrawer(<DrawerHarness compact />);
    expect(await screen.findByTestId('drawer')).toHaveClass(DRAWER_CLASS(560));
  });

  it('keeps a wider explicit width', async () => {
    renderDrawer(<DrawerHarness width={1040} />);
    expect(await screen.findByTestId('drawer')).toHaveClass(DRAWER_CLASS(1040));
  });

  it('takes a collapsed step’s items table from the declared profile', async () => {
    renderDrawer(<DrawerHarness inStep hasItems />);
    expect(await screen.findByTestId('drawer')).toHaveClass(DRAWER_CLASS(840));
    expect(screen.queryByTestId('lines')).not.toBeInTheDocument();
  });

  it('stays wide once the items step has opened, until the drawer closes', async () => {
    const { user } = renderDrawer(<DrawerHarness inStep />);
    const drawer = await screen.findByTestId('drawer');
    expect(drawer).toHaveClass(DRAWER_CLASS(560));

    await user.click(screen.getByTestId('drawer-step-items-trigger'));
    expect(await screen.findByTestId('lines')).toBeInTheDocument();
    expect(drawer).toHaveClass(DRAWER_CLASS(840));

    await user.click(screen.getByTestId('drawer-step-bill-trigger'));
    expect(screen.queryByTestId('lines')).not.toBeInTheDocument();
    expect(drawer).toHaveClass(DRAWER_CLASS(840));

    // Closed, the drawer forgets: reopened without the table it is light again.
    await user.click(screen.getByTestId('drawer-dismiss'));
    await user.click(screen.getByRole('button', { name: 'Drop items', hidden: true }));
    await user.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(await screen.findByTestId('drawer')).toHaveClass(DRAWER_CLASS(560));
  });
});

// ── Host example: invoice lines (KICKOFF §6.9) ─────────────────────────────

type InvoiceLine = Pick<
  InvoiceItem,
  'offeringId' | 'name' | 'qty' | 'rate' | 'discountPct' | 'gstPct'
>;
interface InvoiceForm {
  items: InvoiceLine[];
}

interface OfferingPick {
  price: number;
  gstPct: number;
}

const OFFERINGS: PickerOption<OfferingPick>[] = [
  {
    key: 'lhr',
    label: 'LHR Full Face',
    meta: '₹4,800',
    data: { price: 480_000, gstPct: 18 },
  },
  {
    key: 'peel',
    label: 'Back Peeling',
    meta: '₹2,500',
    data: { price: 250_000, gstPct: 18 },
  },
];

const BLANK_INVOICE_LINE: InvoiceLine = {
  offeringId: null,
  name: '',
  qty: 1,
  rate: 0,
  discountPct: 0,
  gstPct: 0,
};

/** The invoice's rows: Offering · Qty · Rate · Disc % · GST · Final, through the money module. */
function invoiceColumns(
  form: UseFormReturn<InvoiceForm>,
): ItemsColumn<InvoiceForm, 'items'>[] {
  return [
    {
      id: 'offering',
      header: 'Offering',
      track: 'minmax(0,2.2fr)',
      cell: (row) => (
        <ItemsPickerCell<InvoiceForm, OfferingPick>
          {...row.bind('offeringId')}
          options={OFFERINGS}
          placeholder="Select offering…"
          onPick={(option) => {
            form.setValue(`${row.name}.name`, option?.label ?? '');
            form.setValue(`${row.name}.rate`, option?.data?.price ?? 0);
            form.setValue(`${row.name}.gstPct`, option?.data?.gstPct ?? 0);
            form.setValue(`${row.name}.discountPct`, 0);
          }}
        />
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      track: '88px',
      align: 'end',
      cell: (row) => <ItemsQtyCell {...row.bind('qty')} max={999} />,
    },
    {
      id: 'rate',
      header: 'Rate',
      track: '84px',
      align: 'end',
      cell: (row) => <MoneyCell paise={row.row.rate} />,
    },
    {
      id: 'discount',
      header: 'Disc %',
      track: '64px',
      align: 'end',
      cell: (row) => <ItemsNumberCell {...row.bind('discountPct')} max={100} />,
    },
    {
      id: 'gst',
      header: 'GST',
      track: '52px',
      align: 'end',
      cell: (row) => <span>{row.row.gstPct}%</span>,
    },
    {
      id: 'final',
      header: 'Final',
      track: '100px',
      align: 'end',
      cell: (row) => (
        <ItemsNumberInput
          money
          label={row.label}
          testId={row.testId}
          value={Math.round(invoiceLineAmounts(row.row).net)}
          onValueChange={(final) => {
            // Typing the final back-solves the discount (§6.9).
            const full = invoiceLineAmounts({ ...row.row, discountPct: 0 }).net;
            form.setValue(
              `${row.name}.discountPct`,
              full > 0 ? Math.round((1 - final / full) * 100) : 0,
            );
          }}
        />
      ),
    },
  ];
}

function InvoiceLinesHost() {
  const form = useForm<InvoiceForm>({ defaultValues: { items: [BLANK_INVOICE_LINE] } });
  const total = useItemsTotal(
    form.control,
    'items',
    (line) => invoiceLineAmounts(line).net,
  );
  return (
    <ItemsField
      control={form.control}
      name="items"
      label="Items"
      columns={invoiceColumns(form)}
      newRow={() => ({ ...BLANK_INVOICE_LINE })}
      addLabel="Add item"
      minRows={1}
      total={<MoneyCell paise={Math.round(total)} />}
      totalLabel="Total"
      testId="invoice-items"
    />
  );
}

describe('ItemsField — host: invoice lines (§6.9)', () => {
  it('fills a line from the picked offering and totals it through the money module', async () => {
    const { user, container } = renderWithClient(<InvoiceLinesHost />);
    const row = within(screen.getByTestId('invoice-items-row'));

    await user.click(row.getByTestId('invoice-items-offering'));
    await user.click(await screen.findByTestId('invoice-items-offering-option-lhr'));

    expect(row.getByTestId('invoice-items-offering')).toHaveAccessibleName(
      'Offering · LHR Full Face',
    );
    expect(row.getByText('₹4,800')).toBeInTheDocument();
    expect(row.getByText('18%')).toBeInTheDocument();
    // ₹4,800 + 18% GST.
    expect(row.getByRole('textbox', { name: 'Final' })).toHaveValue('5664');
    expect(screen.getByTestId('invoice-items-total')).toHaveTextContent('₹5,664');

    await user.click(row.getByTestId('invoice-items-qty-increase'));
    expect(screen.getByTestId('invoice-items-total')).toHaveTextContent('₹11,328');

    await user.type(row.getByRole('textbox', { name: 'Disc %' }), '10');
    // 2 × ₹4,800, 10% off, then 18% GST on the rest.
    expect(screen.getByTestId('invoice-items-total')).toHaveTextContent('₹10,195.20');

    const final = row.getByRole('textbox', { name: 'Final' });
    await user.clear(final);
    await user.type(final, '10000');
    expect(row.getByRole('textbox', { name: 'Disc %' })).toHaveValue('12');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('caps a discount at 100% and the qty at 999 (the contract’s range)', async () => {
    const { user } = renderWithClient(<InvoiceLinesHost />);
    const row = within(screen.getByTestId('invoice-items-row'));

    const discount = row.getByRole('textbox', { name: 'Disc %' });
    await user.type(discount, '150');
    expect(discount).toHaveValue('100');

    const qty = row.getByRole('spinbutton', { name: 'Qty' });
    expect(qty).toHaveAttribute('maxLength', '3');
    await user.type(qty, '999');
    await user.keyboard('{ArrowUp}');
    expect(qty).toHaveValue('999');
    expect(qty).toHaveAttribute('aria-valuemax', '999');
    expect(row.getByTestId('invoice-items-qty-increase')).toBeDisabled();
  });
});

// ── Host example: Rx medicines (KICKOFF §6.6) ──────────────────────────────

type RxLine = Pick<
  PrescriptionItem,
  'medicineId' | 'doseMorning' | 'doseAfternoon' | 'doseNight' | 'qty' | 'remarks'
>;
interface RxForm {
  meds: RxLine[];
}

const BLANK_RX_LINE: RxLine = {
  medicineId: null,
  doseMorning: 0,
  doseAfternoon: 0,
  doseNight: 0,
  qty: 1,
  remarks: '',
};

const MEDICINES: PickerOption[] = [
  { key: 'flubolt', label: 'Flubolt 400', sub: '8 in stock' },
  { key: 'clonix', label: 'Clonix-B Lotion', sub: 'Out of stock' },
];

const DOSE_PARTS = [
  ['doseMorning', 'Morning'],
  ['doseAfternoon', 'Afternoon'],
  ['doseNight', 'Night'],
] as const;

/** One dose tap (a host's own cell): 0 → 1 → 2 → 0. */
function DoseTap({
  control,
  name,
  label,
}: {
  control: Control<RxForm>;
  name: `meds.${number}.${(typeof DOSE_PARTS)[number][0]}`;
  label: string;
}) {
  const { field } = useController({ control, name });
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => field.onChange((field.value + 1) % 3)}
    >
      {field.value}
    </button>
  );
}

function RxHost() {
  const form = useForm<RxForm>({ defaultValues: { meds: [BLANK_RX_LINE] } });
  const columns: ItemsColumn<RxForm, 'meds'>[] = [
    {
      id: 'medicine',
      header: 'Medicine',
      track: 'minmax(160px,1.6fr)',
      cell: (row) => <ItemsPickerCell {...row.bind('medicineId')} options={MEDICINES} />,
    },
    {
      id: 'dose',
      header: 'Dose · M A N',
      track: '150px',
      cell: (row) => (
        <div role="group" aria-label={row.label}>
          {DOSE_PARTS.map(([part, label]) => (
            <DoseTap
              key={part}
              control={form.control}
              name={`${row.name}.${part}`}
              label={label}
            />
          ))}
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      track: '96px',
      align: 'end',
      cell: (row) => <ItemsQtyCell {...row.bind('qty')} />,
    },
  ];
  return (
    <ItemsField
      control={form.control}
      name="meds"
      label="Medicines"
      columns={columns}
      newRow={() => ({ ...BLANK_RX_LINE })}
      addLabel="Add medicine"
      minRows={1}
      note={{
        key: 'remarks',
        placeholder: 'Remarks · e.g. 10 days, apply thin layer, avoid sun',
        // "10 days" in the note recomputes the qty from the dose (KICKOFF §6.6).
        onChange: (value, row) => {
          const days = /\d+/.exec(value);
          const perDay = row.row.doseMorning + row.row.doseAfternoon + row.row.doseNight;
          if (days && /day/i.test(value) && perDay > 0)
            form.setValue(`${row.name}.qty`, Number(days[0]) * perDay);
        },
      }}
      testId="rx-meds"
    />
  );
}

describe('ItemsField — host: Rx medicines (§6.6)', () => {
  it('takes a medicine, a dose, a note that sets the qty, and clears the last row', async () => {
    const { user, container } = renderWithClient(<RxHost />);
    const row = () => within(screen.getByTestId('rx-meds-row'));

    expect(screen.getByRole('table', { name: 'Medicines' })).toHaveStyle({
      '--items-cols': 'minmax(160px,1.6fr) 150px 96px 30px',
    });
    await user.click(row().getByTestId('rx-meds-medicine'));
    await user.click(await screen.findByTestId('rx-meds-medicine-option-flubolt'));
    await user.click(row().getByRole('button', { name: 'Morning' }));
    await user.click(row().getByRole('button', { name: 'Night' }));

    const note = row().getByRole('textbox', {
      name: 'Remarks · e.g. 10 days, apply thin layer, avoid sun',
    });
    await user.type(note, '10 days');
    expect(row().getByRole('spinbutton', { name: 'Qty' })).toHaveValue('20');
    expect(screen.getByTestId('rx-meds-add')).toHaveTextContent('Add medicine');
    expect(await axe(container)).toHaveNoViolations();

    // The only row is cleared, not dropped (H:4807).
    await user.click(screen.getByTestId('rx-meds-remove'));
    expect(screen.getAllByTestId('rx-meds-row')).toHaveLength(1);
    expect(row().getByTestId('rx-meds-medicine')).toHaveAccessibleName('Medicine');
    expect(row().getByRole('spinbutton', { name: 'Qty' })).toHaveValue('1');
    expect(screen.getByTestId('rx-meds-note')).toHaveValue('');
  });
});
