import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { type Control, useForm, type UseFormReturn } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import {
  ItemsNumberInput,
  ItemsPickerCell,
  ItemsQtyCell,
  ItemsTextCell,
} from './items-field-cells.tsx';

interface Row {
  mode: string | null;
  qty: number;
  batch: string | null;
}
interface CellForm {
  rows: Row[];
}

type FormRef = { current: UseFormReturn<CellForm> | null };

/** One row's cells under a form, as an items field renders them. */
function CellHarness({
  formRef,
  initial = { mode: null, qty: 2, batch: null },
  children,
}: {
  formRef?: FormRef;
  initial?: Row;
  children: (control: Control<CellForm>) => ReactNode;
}) {
  const form = useForm<CellForm>({ defaultValues: { rows: [initial] } });
  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);
  return <TooltipProvider>{children(form.control)}</TooltipProvider>;
}

function renderCells(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const user = userEvent.setup();
  return {
    user,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('ItemsQtyCell — the 32px stepper (H:924)', () => {
  it('steps with its buttons and the arrow keys, and stops at min', async () => {
    const formRef: FormRef = { current: null };
    const { user, container } = renderCells(
      <CellHarness formRef={formRef}>
        {(control) => (
          <ItemsQtyCell control={control} name="rows.0.qty" label="Qty" testId="qty" />
        )}
      </CellHarness>,
    );
    const qty = screen.getByRole('spinbutton', { name: 'Qty' });
    expect(qty).toHaveValue('2');
    // The buttons stay out of the tab order; the arrows step from the keyboard.
    expect(screen.getByTestId('qty-decrease')).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByTestId('qty-decrease')).toHaveAccessibleName('Decrease');
    expect(screen.getByTestId('qty-increase')).toHaveAccessibleName('Increase');

    await user.click(screen.getByTestId('qty-decrease'));
    expect(qty).toHaveValue('1');
    expect(screen.getByTestId('qty-decrease')).toBeDisabled();

    await user.click(qty);
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}');
    expect(qty).toHaveValue('2');
    expect(qty).toHaveAttribute('aria-valuenow', '2');
    expect(formRef.current?.getValues('rows.0.qty')).toBe(2);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('replaces the count as typed and brings an empty or too-small one back to min', async () => {
    const formRef: FormRef = { current: null };
    const { user } = renderCells(
      <CellHarness formRef={formRef}>
        {(control) => (
          <ItemsQtyCell control={control} name="rows.0.qty" label="Qty" testId="qty" />
        )}
      </CellHarness>,
    );
    const qty = screen.getByRole('spinbutton', { name: 'Qty' });

    await user.type(qty, '12');
    expect(formRef.current?.getValues('rows.0.qty')).toBe(12);

    await user.clear(qty);
    expect(qty).toHaveValue('');
    await user.tab();
    expect(qty).toHaveValue('1');

    await user.type(qty, '0');
    expect(qty).toHaveValue('0');
    await user.tab();
    expect(qty).toHaveValue('1');
    expect(formRef.current?.getValues('rows.0.qty')).toBe(1);
  });

  it('starts at 0 for a free quantity, and does nothing while read-only', async () => {
    const { user, unmount } = renderCells(
      <CellHarness initial={{ mode: null, qty: 0, batch: null }}>
        {(control) => (
          <ItemsQtyCell
            control={control}
            name="rows.0.qty"
            label="Free"
            testId="free"
            min={0}
          />
        )}
      </CellHarness>,
    );
    expect(screen.getByRole('spinbutton', { name: 'Free' })).toHaveValue('0');
    expect(screen.getByTestId('free-decrease')).toBeDisabled();
    await user.click(screen.getByTestId('free-increase'));
    expect(screen.getByRole('spinbutton', { name: 'Free' })).toHaveValue('1');
    unmount();

    const view = renderCells(
      <CellHarness>
        {(control) => (
          <ItemsQtyCell
            control={control}
            name="rows.0.qty"
            label="Qty"
            testId="qty"
            readOnly
          />
        )}
      </CellHarness>,
    );
    const qty = screen.getByRole('spinbutton', { name: 'Qty' });
    await view.user.click(qty);
    await view.user.keyboard('{ArrowUp}');
    expect(qty).toHaveValue('2');
    expect(screen.getByTestId('qty-increase')).toBeDisabled();
  });

  it('shows a message on its red edge and in its description', () => {
    renderCells(
      <CellHarness>
        {(control) => (
          <ItemsQtyCell
            control={control}
            name="rows.0.qty"
            label="Qty"
            testId="qty"
            error="Only 3 of Glycolac Cream in stock"
          />
        )}
      </CellHarness>,
    );
    const qty = screen.getByRole('spinbutton', { name: 'Qty' });
    expect(qty).toHaveAttribute('aria-invalid', 'true');
    expect(qty).toHaveAccessibleDescription('Only 3 of Glycolac Cream in stock');
    expect(qty.parentElement).toHaveClass('border-destructive');
  });
});

/** An unbound number cell keeping its value in state, as a derived column would. */
function NumberHarness({
  initial = 0,
  money = false,
  decimals,
  error,
  onValue = () => {},
}: {
  initial?: number;
  money?: boolean;
  decimals?: number;
  error?: string;
  onValue?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TooltipProvider>
      <ItemsNumberInput
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValue(next);
        }}
        label="Final"
        money={money}
        decimals={decimals}
        error={error}
        testId="final"
      />
    </TooltipProvider>
  );
}

describe('ItemsNumberInput — a number cell', () => {
  it('types rupees into paise, keeping "12." while focused', async () => {
    const onValue = vi.fn();
    const { user } = renderCells(<NumberHarness money onValue={onValue} />);
    const final = screen.getByRole('textbox', { name: 'Final' });
    expect(final).toHaveValue('');
    expect(final).toHaveAttribute('placeholder', '₹ 0');
    expect(final).toHaveAttribute('inputMode', 'decimal');

    await user.type(final, '12.');
    expect(final).toHaveValue('12.');
    expect(onValue).toHaveBeenLastCalledWith(1200);
    await user.type(final, '5a0');
    expect(final).toHaveValue('12.50');
    expect(onValue).toHaveBeenLastCalledWith(1250);

    await user.tab();
    expect(final).toHaveValue('12.5');
  });

  it('does a sum in rupees and stores its paise (feat-write-less)', async () => {
    const onValue = vi.fn();
    const { user } = renderCells(<NumberHarness money onValue={onValue} />);
    const final = screen.getByRole('textbox', { name: 'Final' });
    await user.type(final, '1500+300');
    expect(final).toHaveValue('1500+300');
    expect(onValue).toHaveBeenLastCalledWith(180_000);
    await user.type(final, '+');
    expect(onValue).toHaveBeenLastCalledWith(150_000);
    await user.type(final, '{Backspace}');
    await user.tab();
    expect(final).toHaveValue('1800');
  });

  it('takes whole numbers by default, under a "0" placeholder', async () => {
    const onValue = vi.fn();
    const { user } = renderCells(<NumberHarness initial={5} onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: 'Final' });
    expect(input).toHaveValue('5');
    expect(input).toHaveAttribute('placeholder', '0');
    expect(input).toHaveAttribute('inputMode', 'numeric');

    await user.clear(input);
    await user.type(input, '7.5');
    expect(input).toHaveValue('75');
    expect(onValue).toHaveBeenLastCalledWith(75);
  });

  it('marks its message for the tooltip and the screen reader', () => {
    renderCells(<NumberHarness money error="Below the lowest price ₹4,000" />);
    const final = screen.getByRole('textbox', { name: 'Final' });
    expect(final).toHaveAttribute('aria-invalid', 'true');
    expect(final).toHaveAccessibleDescription('Below the lowest price ₹4,000');
  });
});

describe('ItemsTextCell — a text field of a row', () => {
  it('shows an empty value for null and writes what is typed', async () => {
    const formRef: FormRef = { current: null };
    const { user } = renderCells(
      <CellHarness formRef={formRef}>
        {(control) => (
          <ItemsTextCell
            control={control}
            name="rows.0.batch"
            label="Batch"
            testId="batch"
            placeholder="e.g. CSH26044"
            maxLength={16}
          />
        )}
      </CellHarness>,
    );
    const batch = screen.getByRole('textbox', { name: 'Batch' });
    expect(batch).toHaveValue('');
    expect(batch).toHaveAttribute('maxLength', '16');
    expect(batch).not.toHaveClass('text-end');

    await user.type(batch, 'ASC002');
    expect(formRef.current?.getValues('rows.0.batch')).toBe('ASC002');
  });

  it('shows the field’s own validation message', () => {
    const formRef: FormRef = { current: null };
    renderCells(
      <CellHarness formRef={formRef}>
        {(control) => (
          <ItemsTextCell
            control={control}
            name="rows.0.batch"
            label="Expiry"
            testId="expiry"
            align="end"
          />
        )}
      </CellHarness>,
    );
    act(() => {
      formRef.current?.setError('rows.0.batch', { message: 'Enter the expiry' });
    });
    const expiry = screen.getByRole('textbox', { name: 'Expiry' });
    expect(expiry).toHaveClass('text-end');
    expect(expiry).toHaveAttribute('aria-invalid', 'true');
    expect(expiry).toHaveAccessibleDescription('Enter the expiry');
  });
});

const MODES: PickerOption[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
];

describe('ItemsPickerCell — the row’s picker', () => {
  it('writes the picked key and hands the option back; clearing hands back null', async () => {
    const formRef: FormRef = { current: null };
    const onPick = vi.fn();
    const { user } = renderCells(
      <CellHarness formRef={formRef}>
        {(control) => (
          <ItemsPickerCell
            control={control}
            name="rows.0.mode"
            label="Mode"
            testId="mode"
            options={MODES}
            clearable
            onPick={onPick}
          />
        )}
      </CellHarness>,
    );
    const trigger = screen.getByTestId('mode');
    expect(trigger).toHaveAccessibleName('Mode');
    expect(trigger.className).toContain('min-h-8');

    await user.click(trigger);
    await user.click(await screen.findByTestId('mode-option-upi'));
    expect(formRef.current?.getValues('rows.0.mode')).toBe('upi');
    expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'upi' }));
    expect(screen.getByTestId('mode')).toHaveAccessibleName('Mode · UPI');

    await user.click(screen.getByTestId('mode-clear'));
    expect(formRef.current?.getValues('rows.0.mode')).toBeNull();
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  it('takes the form’s focus on its trigger and shows its message', async () => {
    const formRef: FormRef = { current: null };
    renderCells(
      <CellHarness formRef={formRef}>
        {(control) => (
          <ItemsPickerCell
            control={control}
            name="rows.0.mode"
            label="Mode"
            testId="mode"
            options={MODES}
          />
        )}
      </CellHarness>,
    );
    act(() => {
      formRef.current?.setError('rows.0.mode', { message: 'Pick a mode' });
      formRef.current?.setFocus('rows.0.mode');
    });
    const trigger = screen.getByTestId('mode');
    // RHF focuses on the next task.
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick a mode');
  });
});
