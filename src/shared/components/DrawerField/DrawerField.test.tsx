import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Input } from '@/shared/components/ui/input.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';

import {
  DRAWER_INPUT_CLASS,
  DRAWER_TEXTAREA_CLASS,
  drawerFieldErrorId,
} from './drawer-field-controls.ts';
import { DrawerField, DrawerFieldGrid } from './DrawerField.tsx';

describe('DrawerField', () => {
  it('labels its control, with the required mark and the hint beside the label', () => {
    render(
      <DrawerField label="Mobile" htmlFor="pt-mobile" required hint="10 digits">
        <Input id="pt-mobile" required className={DRAWER_INPUT_CLASS} />
      </DrawerField>,
    );

    const input = screen.getByLabelText(/Mobile/);
    expect(input).toHaveAttribute('id', 'pt-mobile');
    const mark = screen.getByText('*');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveClass('text-destructive');
    const hint = screen.getByText('10 digits');
    expect(hint).toHaveClass('truncate');
    expect(hint).toHaveAttribute('title', '10 digits');
  });

  it('shows the field’s error under the control, at <id>-error', () => {
    render(
      <DrawerField label="First name" htmlFor="pt-first" error="Add a first name">
        <Input id="pt-first" aria-describedby={drawerFieldErrorId('pt-first')} />
      </DrawerField>,
    );

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Add a first name');
    expect(error).toHaveAttribute('id', 'pt-first-error');
    expect(screen.getByLabelText('First name')).toHaveAccessibleDescription(
      'Add a first name',
    );
  });

  it('sizes drawer inputs at 36px, rounded-lg, 13.5px — and keeps a textarea’s rows', () => {
    render(
      <>
        <Input aria-label="Name" className={DRAWER_INPUT_CLASS} />
        <Textarea aria-label="Notes" rows={3} className={DRAWER_TEXTAREA_CLASS} />
      </>,
    );

    expect(screen.getByLabelText('Name')).toHaveClass(
      'h-9',
      'rounded-lg',
      'px-2.5',
      'text-field',
    );
    // The stock size classes are replaced, not stacked beside the drawer's.
    expect(screen.getByLabelText('Name')).not.toHaveClass('text-base', 'md:text-sm');
    expect(screen.getByLabelText('Notes')).toHaveClass(
      'field-sizing-fixed',
      'resize-y',
      'text-field',
    );
  });
});

describe('DrawerFieldGrid', () => {
  it('lays fields on six columns and stretches the last field of a row', () => {
    render(
      <DrawerFieldGrid>
        <DrawerField label="First name" span="half" testId="f-first">
          <Input aria-label="First name" />
        </DrawerField>
        <DrawerField label="Mobile" span="third" testId="f-mobile">
          <Input aria-label="Mobile" />
        </DrawerField>
        <DrawerField label="Notes" testId="f-notes">
          <Textarea aria-label="Notes" />
        </DrawerField>
      </DrawerFieldGrid>,
    );

    const cell = (id: string) => screen.getByTestId(id).parentElement;
    expect(cell('f-first')?.parentElement).toHaveClass(
      'grid',
      'grid-cols-6',
      'gap-(--form-gap)',
    );
    expect(cell('f-first')).toHaveClass('col-span-4');
    expect(cell('f-mobile')).toHaveClass('col-span-2');
    expect(cell('f-notes')).toHaveClass('col-span-6');
  });

  it('heads a titled group with the uppercase section label and names the group', () => {
    render(
      <DrawerFieldGrid title="Contact">
        <DrawerField label="First name" span="half">
          <Input aria-label="First name" />
        </DrawerField>
      </DrawerFieldGrid>,
    );

    expect(screen.getByRole('group', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.getByText('Contact')).toHaveClass('text-micro', 'uppercase');
  });

  it('skips empty children', () => {
    const show = false;
    render(
      <DrawerFieldGrid>
        {show ? <DrawerField label="Hidden">x</DrawerField> : null}
        <DrawerField label="Shown" span="third" testId="f-shown">
          <Input aria-label="Shown" />
        </DrawerField>
      </DrawerFieldGrid>,
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.getByTestId('f-shown').parentElement).toHaveClass('col-span-3');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DrawerFieldGrid>
        <DrawerField label="First name" htmlFor="a-first" required span="half">
          <Input id="a-first" required className={DRAWER_INPUT_CLASS} />
        </DrawerField>
        <DrawerField label="Notes" htmlFor="a-notes" hint="Shown on the print">
          <Textarea id="a-notes" className={DRAWER_TEXTAREA_CLASS} />
        </DrawerField>
      </DrawerFieldGrid>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
