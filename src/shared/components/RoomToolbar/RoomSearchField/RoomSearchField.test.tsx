import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RoomSearchField, type RoomSearchFieldProps } from './RoomSearchField.tsx';

function Field(
  props: Partial<Omit<RoomSearchFieldProps, 'value' | 'onValueChange'>> & {
    onType?: (value: string) => void;
  },
) {
  const [value, setValue] = useState('');
  const { onType, ...rest } = props;
  return (
    <RoomSearchField
      placeholder="Search sections"
      label="Search settings"
      testId="field"
      inputTestId="field-input"
      {...rest}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onType?.(next);
      }}
    />
  );
}

describe('RoomSearchField', () => {
  it('folds the toolbar field while empty and unfocused, and opens on focus', async () => {
    const user = userEvent.setup();
    const { container } = render(<Field keyHint />);
    const field = screen.getByTestId('field');
    expect(field).toHaveAttribute('data-expanded', 'false');
    expect(field.className).toContain('md:flex-[0_0_36px]');

    await user.click(screen.getByRole('searchbox', { name: 'Search settings' }));
    expect(field).toHaveAttribute('data-expanded', 'true');
    expect(field).toHaveTextContent('/');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('never folds as `fill`: it fills its container, with no key hint', async () => {
    const { container } = render(<Field layout="fill" keyHint />);
    const field = screen.getByTestId('field');
    expect(field).toHaveAttribute('data-expanded', 'true');
    expect(field).toHaveClass('w-full');
    expect(field.className).not.toContain('md:flex-[0_1_200px]');
    expect(field).not.toHaveTextContent('/');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports each keystroke and leaves on Esc', async () => {
    const user = userEvent.setup();
    const onType = vi.fn();
    render(<Field layout="fill" onType={onType} />);
    const input = screen.getByTestId('field-input');

    await user.type(input, 'pa');
    expect(onType).toHaveBeenLastCalledWith('pa');
    expect(input).toHaveValue('pa');

    await user.keyboard('{Escape}');
    expect(input).not.toHaveFocus();
  });

  it('becomes a combobox over a listbox: keys reach its owner first, a prevented Esc stays', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: { key: string; preventDefault: () => void }) => {
      if (event.key === 'Escape') event.preventDefault();
    });
    const onFocusChange = vi.fn();
    render(
      <Field
        layout="fill"
        combobox={{
          expanded: true,
          controls: 'results',
          activeDescendant: 'result-first',
        }}
        onKeyDown={onKeyDown}
        onFocusChange={onFocusChange}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Search settings' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', 'results');
    expect(input).toHaveAttribute('aria-activedescendant', 'result-first');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    await user.click(input);
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    await user.keyboard('{ArrowDown}{Escape}');
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(input).toHaveFocus();
    await user.tab();
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });
});
