import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { capitalizesFirstLetter } from './auto-capitalize.ts';
import { DrawerInput, DrawerTextarea } from './drawer-text-controls.tsx';

describe('DrawerInput — first letter capitalised as typed (H:4515–4521)', () => {
  it('capitalises a name and keeps typing where the caret is', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(
      <DrawerInput
        aria-label="Full name"
        onChange={(event) => seen.push(event.target.value)}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Full name' });
    await user.type(field, 'riya shah');
    expect(field).toHaveValue('Riya shah');
    // The caller's own onChange already reads the capitalised value.
    expect(seen.at(-1)).toBe('Riya shah');
    expect(seen[0]).toBe('R');
  });

  it('hands react-hook-form the capitalised value', async () => {
    const user = userEvent.setup();
    let read: () => string = () => '';
    function Form() {
      const { register, getValues } = useForm<{ name: string }>({
        defaultValues: { name: '' },
      });
      read = () => getValues('name');
      return <DrawerInput aria-label="Name" {...register('name')} />;
    }
    render(<Form />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'meera');
    expect(read()).toBe('Meera');
  });

  it.each([
    ['a phone type', { type: 'tel', 'aria-label': 'Mobile number' }],
    ['an email type', { type: 'email', 'aria-label': 'Work address' }],
    ['a numeric input mode', { inputMode: 'numeric' as const, 'aria-label': 'Qty' }],
    ['an Instagram placeholder', { placeholder: 'Instagram handle', 'aria-label': 'IG' }],
    ['the opt-out', { capitalize: false, 'aria-label': 'Code' }],
  ])('leaves %s alone', async (_case, props) => {
    const user = userEvent.setup();
    render(<DrawerInput data-testid="field" {...props} />);
    await user.type(screen.getByTestId('field'), 'abc');
    expect(screen.getByTestId('field')).toHaveValue('abc');
  });

  it('leaves a handle typed with its "@" alone', async () => {
    const user = userEvent.setup();
    render(<DrawerInput aria-label="Referred by" />);
    const field = screen.getByRole('textbox', { name: 'Referred by' });
    await user.type(field, '@riya');
    expect(field).toHaveValue('@riya');
  });

  it('reads a visible label as well as aria-label and placeholder', () => {
    render(
      <>
        <label htmlFor="mobile">Phone</label>
        <DrawerInput id="mobile" />
      </>,
    );
    expect(capitalizesFirstLetter(screen.getByRole('textbox'))).toBe(false);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<DrawerInput aria-label="Full name" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DrawerTextarea', () => {
  it('capitalises a note but not a message', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DrawerTextarea aria-label="Note" />
        <DrawerTextarea aria-label="Message" />
      </>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'called twice');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hello');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Called twice');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('hello');
  });
});
