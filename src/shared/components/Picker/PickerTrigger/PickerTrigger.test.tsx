import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PickerOption } from '@/shared/components/Picker/picker.types.ts';
import { Clock, Wallet } from '@/shared/icons/index.ts';

import { PickerTrigger, PickerTriggerClear, PickerValue } from './PickerTrigger.tsx';

const DOCTOR: PickerOption = {
  key: 'd1',
  label: 'Dr. Mavani',
  sub: 'Dermatology',
  meta: '4 today',
  leading: { kind: 'avatar', initials: 'NM' },
  tone: 'sage',
};

describe('PickerTrigger', () => {
  it.each([
    ['sm', 'min-h-8', 'text-body'],
    ['md', 'min-h-9', 'text-field'],
    ['lg', 'min-h-11', 'text-field'],
  ] as const)('is %s: %s and %s', (size, height, type) => {
    render(<PickerTrigger size={size}>Pick</PickerTrigger>);
    const trigger = screen.getByRole('button', { name: 'Pick' });
    expect(trigger).toHaveClass(height, type, 'rounded-lg', 'border');
    expect(trigger).toHaveAttribute('data-slot', 'button');
  });

  it('insets the text 12px, 10px when compact, 7px beside an avatar', () => {
    const { rerender } = render(<PickerTrigger>Pick</PickerTrigger>);
    expect(screen.getByRole('button')).toHaveClass('ps-3');
    rerender(<PickerTrigger inset="compact">Pick</PickerTrigger>);
    expect(screen.getByRole('button')).toHaveClass('ps-2.5');
    rerender(<PickerTrigger inset="avatar">Pick</PickerTrigger>);
    expect(screen.getByRole('button')).toHaveClass('ps-1.75');
  });

  it('wraps chips, reserves the clear button and draws a leading glyph', () => {
    render(
      <PickerTrigger wrap reserveClear icon={<Clock data-testid="glyph" />}>
        Pick
      </PickerTrigger>,
    );
    const trigger = screen.getByRole('button', { name: 'Pick' });
    expect(trigger).toHaveClass('py-1.25', 'whitespace-normal');
    expect(trigger.querySelector('.w-5')).not.toBeNull();
    expect(within(trigger).getByTestId('glyph')).toBeInTheDocument();
  });

  it('marks the open state for the border, ring and turned chevron', () => {
    render(<PickerTrigger aria-expanded="true">Pick</PickerTrigger>);
    const trigger = screen.getByRole('button');
    expect(trigger.className).toContain('aria-expanded:border-disabled');
    expect(trigger.className).toContain('aria-expanded:ring-[3px]');
    expect(
      trigger.querySelector('.group-aria-expanded\\/picker-trigger\\:rotate-180'),
    ).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PickerTrigger aria-label="Doctor">Pick</PickerTrigger>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PickerTriggerClear', () => {
  it('is a labelled 20px button beside the chevron that clears', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<PickerTriggerClear label="Clear" onClear={onClear} testId="field-clear" />);
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(clear).toHaveAttribute('title', 'Clear');
    expect(clear).toHaveClass('size-5', 'end-8');
    await user.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('PickerValue', () => {
  it('shows the placeholder with nothing picked', () => {
    render(
      <PickerValue
        selected={[]}
        multiple={false}
        size="md"
        placeholder="Select…"
        maxChips={3}
      />,
    );
    expect(screen.getByText('Select…')).toHaveClass('text-muted-foreground');
  });

  it('draws a single pick with its tone dot and meta (not at sm)', () => {
    const option: PickerOption = {
      key: 'c',
      label: 'Confirmed',
      meta: '12',
      tone: 'sky',
    };
    const { container, rerender } = render(
      <PickerValue
        selected={[option]}
        multiple={false}
        size="md"
        placeholder=""
        maxChips={3}
      />,
    );
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(container.querySelector('.bg-tone-sky-dot')).not.toBeNull();
    rerender(
      <PickerValue
        selected={[option]}
        multiple={false}
        size="sm"
        placeholder=""
        maxChips={3}
      />,
    );
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('draws an icon instead of the dot, and nothing for leading none', () => {
    const { container, rerender } = render(
      <PickerValue
        selected={[
          { key: 'p', label: 'Payments', leading: { kind: 'icon', icon: Wallet } },
        ]}
        multiple={false}
        size="md"
        placeholder=""
        maxChips={3}
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(
      <PickerValue
        selected={[{ key: 'x', label: 'Cancel', leading: { kind: 'none' } }]}
        multiple={false}
        size="md"
        placeholder=""
        maxChips={3}
      />,
    );
    expect(container.querySelector('[class*="-dot"]')).toBeNull();
  });

  it('draws a person as an avatar chip', () => {
    const { container } = render(
      <PickerValue
        selected={[DOCTOR]}
        multiple={false}
        size="lg"
        placeholder=""
        maxChips={3}
      />,
    );
    expect(screen.getByText('NM')).toBeInTheDocument();
    expect(screen.getByText('Dr. Mavani').closest('[data-slot="pill"]')).toHaveClass(
      'h-7',
    );
    expect(container.querySelector('.bg-tone-sage')).not.toBeNull();
  });

  it('draws multi picks as tone chips, then +N', () => {
    const picks: PickerOption[] = ['Andheri', 'Bandra', 'Powai', 'Thane', 'Vashi'].map(
      (label) => ({ key: label, label, tone: 'sky' }),
    );
    render(
      <PickerValue selected={picks} multiple size="md" placeholder="" maxChips={3} />,
    );
    expect(screen.getByText('Andheri')).toBeInTheDocument();
    expect(screen.getByText('Powai')).toBeInTheDocument();
    expect(screen.queryByText('Thane')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveAttribute('data-slot', 'pill');
  });
});
