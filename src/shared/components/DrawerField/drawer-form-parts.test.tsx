import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { DrawerStepBody } from './drawer-step-body.tsx';
import { DrawerField } from './DrawerField.tsx';
import { useDrawerFieldIds } from './use-drawer-field-ids.ts';

interface Values {
  name: string;
}

/** One field wired through the shared ids, inside a step body; "Refuse" sets a server error. */
function NameStep({ readOnly = false }: { readOnly?: boolean }) {
  const form = useForm<Values>({ defaultValues: { name: '' } });
  const name = useDrawerFieldIds(form, 'drawer')('name');
  return (
    <>
      <DrawerStepBody readOnly={readOnly}>
        <DrawerField label="Name" htmlFor={name.id} error={name.error}>
          <input {...name.control} {...form.register('name')} />
        </DrawerField>
      </DrawerStepBody>
      <button
        type="button"
        onClick={() => form.setError('name', { type: 'server', message: 'Name taken' })}
      >
        Refuse
      </button>
    </>
  );
}

describe('DrawerStepBody', () => {
  it('disables every control of a view-only step at once', () => {
    render(<NameStep readOnly />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});

describe('useDrawerFieldIds', () => {
  it('names the control, and ties an error to it when the form has one', async () => {
    const { container } = render(<NameStep />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('id', 'drawer-name');
    expect(input).not.toHaveAttribute('aria-invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Name taken');
    expect(await axe(container)).toHaveNoViolations();
  });
});
