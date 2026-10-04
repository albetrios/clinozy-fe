import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  DrawerNumberInput,
  DrawerQuickChips,
  DrawerStepper,
} from './drawer-number-controls.tsx';

function Money({ max }: { max?: number }) {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="price">Price</label>
      <DrawerNumberInput
        id="price"
        value={value}
        onValueChange={setValue}
        prefix="₹"
        placeholder="0"
        max={max}
        maxLength={7}
      />
    </>
  );
}

function Stepped({ onChange = vi.fn() }: { onChange?: (value: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <>
      <label htmlFor="sessions">Sessions</label>
      <DrawerStepper
        id="sessions"
        label="Sessions"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        min={0}
        max={99}
        quick={[1, 4, 6].map((count) => ({ label: String(count), value: count }))}
        testId="sessions"
      />
    </>
  );
}

describe('DrawerNumberInput (H:1592)', () => {
  it('takes digits and one point, behind its prefix tile', async () => {
    const user = userEvent.setup();
    const { container } = render(<Money />);
    const input = screen.getByLabelText('Price');
    expect(screen.getByText('₹')).toBeInTheDocument();
    await user.type(input, '1a5.0.0x');
    expect(input).toHaveValue('15.00');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('caps a figure above its maximum', async () => {
    const user = userEvent.setup();
    render(<Money max={100} />);
    const input = screen.getByLabelText('Price');
    await user.type(input, '250');
    expect(input).toHaveValue('100');
  });

  it('shows a unit after the figure', () => {
    render(
      <DrawerNumberInput
        aria-label="GST rate"
        value="18"
        onValueChange={vi.fn()}
        suffix="%"
      />,
    );
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.getByLabelText('GST rate')).toHaveValue('18');
  });
});

describe('DrawerStepper (H:1593)', () => {
  it('steps between its bounds: "−" stops at the minimum', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Stepped onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Increase' }));
    expect(screen.getByRole('textbox', { name: 'Sessions' })).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'Decrease' }));
    await user.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(screen.getByRole('textbox', { name: 'Sessions' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled();
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('takes a typed figure, capped, and reads an empty box as the minimum on blur', async () => {
    const user = userEvent.setup();
    render(<Stepped />);
    const input = screen.getByRole('textbox', { name: 'Sessions' });
    await user.clear(input);
    await user.type(input, '250');
    expect(input).toHaveValue('99');
    await user.clear(input);
    fireEvent.blur(input);
    expect(input).toHaveValue('0');
  });

  it('offers quick picks, the current one pressed', async () => {
    const user = userEvent.setup();
    render(<Stepped />);
    expect(screen.getByTestId('sessions-quick-1')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByTestId('sessions-quick-6'));
    expect(screen.getByRole('textbox', { name: 'Sessions' })).toHaveValue('6');
    expect(screen.getByTestId('sessions-quick-6')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('DrawerQuickChips', () => {
  it('names its group and reports the picked value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DrawerQuickChips
        label="Validity"
        options={[
          { label: 'None', value: 0 },
          { label: '3 mo', value: 90 },
        ]}
        value={0}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('group', { name: 'Validity' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '3 mo' }));
    expect(onChange).toHaveBeenCalledWith(90);
  });
});
