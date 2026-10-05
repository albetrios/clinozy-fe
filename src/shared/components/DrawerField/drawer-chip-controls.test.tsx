import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { type DrawerChipOption, DrawerChips } from './drawer-chip-controls.tsx';

type Gender = 'female' | 'male' | 'other';
type Type = 'aesthetic' | 'clinical' | 'lhr';

const GENDERS: readonly DrawerChipOption<Gender>[] = [
  { value: 'female', label: 'Female', tone: 'blush' },
  { value: 'male', label: 'Male', tone: 'sky' },
  { value: 'other', label: 'Other', tone: 'stone' },
];
const TYPES: readonly DrawerChipOption<Type>[] = [
  { value: 'aesthetic', label: 'Aesthetic', tone: 'lav' },
  { value: 'clinical', label: 'Clinical', tone: 'sky' },
  { value: 'lhr', label: 'LHR', tone: 'blush' },
];

function OnePick({ clearable = false }: { clearable?: boolean }) {
  const [value, setValue] = useState<Gender | null>(null);
  return (
    <>
      <DrawerChips
        label="Gender"
        options={GENDERS}
        value={value}
        onChange={setValue}
        clearable={clearable}
        testId="gender"
      />
      <output>{value ?? 'none'}</output>
    </>
  );
}

function PickAny({ ordered = false }: { ordered?: boolean }) {
  const [value, setValue] = useState<Type[]>([]);
  return (
    <>
      <DrawerChips
        multiple
        ordered={ordered}
        label="Patient type"
        options={TYPES}
        value={value}
        onChange={setValue}
        testId="types"
      />
      <output>{value.join(',') || 'none'}</output>
    </>
  );
}

describe('DrawerChips — the drawer’s chip field (H:905)', () => {
  it('names the group by its label and draws each chip in its tone', () => {
    render(<OnePick />);
    const group = screen.getByRole('group', { name: 'Gender' });
    expect(group).toBeInTheDocument();
    const female = screen.getByRole('button', { name: 'Female' });
    expect(female).toHaveAttribute('aria-pressed', 'false');
    expect(female).toHaveAttribute('data-slot', 'pill');
    expect(female.className).toContain('bg-tone-blush');
    expect(screen.getByTestId('gender-male')).toHaveTextContent('Male');
  });

  it('takes one pick; tapping the picked chip keeps it unless the field is clearable', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OnePick />);
    await user.click(screen.getByRole('button', { name: 'Male' }));
    expect(screen.getByRole('status')).toHaveTextContent('male');
    expect(screen.getByRole('button', { name: 'Male' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Female' }));
    expect(screen.getByRole('status')).toHaveTextContent('female');
    await user.click(screen.getByRole('button', { name: 'Female' }));
    expect(screen.getByRole('status')).toHaveTextContent('female');
    unmount();

    render(<OnePick clearable />);
    await user.click(screen.getByRole('button', { name: 'Other' }));
    await user.click(screen.getByRole('button', { name: 'Other' }));
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });

  it('takes any number of picks, kept in the options’ order, each picked chip checked', async () => {
    const user = userEvent.setup();
    render(<PickAny />);
    await user.click(screen.getByRole('button', { name: 'LHR' }));
    await user.click(screen.getByRole('button', { name: 'Aesthetic' }));
    expect(screen.getByRole('status')).toHaveTextContent('aesthetic,lhr');
    const lhr = screen.getByRole('button', { name: 'LHR' });
    expect(lhr.querySelector('svg')).not.toBeNull();
    // The design's picked chip draws the boxed check (H:3023 `check`; KICKOFF §3.4).
    expect(lhr.querySelector('svg')?.getAttribute('class')).toContain(
      'lucide-square-check',
    );
    expect(
      screen.getByRole('button', { name: 'Clinical' }).querySelector('svg'),
    ).toBeNull();
    await user.click(lhr);
    expect(screen.getByRole('status')).toHaveTextContent('aesthetic');
  });

  it('keeps the picks in pick order when ordered — the first pick leads', async () => {
    const user = userEvent.setup();
    render(<PickAny ordered />);
    await user.click(screen.getByRole('button', { name: 'LHR' }));
    await user.click(screen.getByRole('button', { name: 'Aesthetic' }));
    expect(screen.getByRole('status')).toHaveTextContent('lhr,aesthetic');
    await user.click(screen.getByRole('button', { name: 'LHR' }));
    await user.click(screen.getByRole('button', { name: 'Clinical' }));
    expect(screen.getByRole('status')).toHaveTextContent('aesthetic,clinical');
  });

  it('marks a pick with its ink edge and ring, and draws an untoned chip on muted', () => {
    render(
      <DrawerChips
        label="Referrer type"
        options={[
          { value: 'patient', label: 'Patient' },
          { value: 'doctor', label: 'Doctor' },
        ]}
        value="doctor"
        onChange={() => {}}
      />,
    );
    const doctor = screen.getByRole('button', { name: 'Doctor' });
    expect(doctor.className).toContain('ring-current');
    expect(doctor.className).toContain('bg-muted');
    expect(screen.getByRole('button', { name: 'Patient' }).className).toContain(
      'border-transparent',
    );
  });

  it('can be disabled as a whole', async () => {
    const user = userEvent.setup();
    render(
      <DrawerChips
        label="Gender"
        options={GENDERS}
        value={null}
        onChange={() => {
          throw new Error('a disabled chip changed the field');
        }}
        disabled
      />,
    );
    const female = screen.getByRole('button', { name: 'Female' });
    expect(female).toBeDisabled();
    await user.click(female);
  });

  it('draws the outline look: dashed until picked, then muted on a solid edge, no check', () => {
    render(
      <DrawerChips
        multiple
        variant="outline"
        label="Contact preferences"
        options={[
          { value: 'no-calls', label: 'No calls' },
          { value: 'hindi', label: 'Hindi' },
        ]}
        value={['hindi']}
        onChange={() => {}}
      />,
    );
    const off = screen.getByRole('button', { name: 'No calls' });
    const on = screen.getByRole('button', { name: 'Hindi' });
    expect(off).toHaveClass('h-6', 'border-dashed', 'bg-card');
    expect(on).toHaveClass('bg-muted', 'border-foreground');
    expect(on).not.toHaveClass('border-dashed');
    expect(on.querySelector('svg')).toBeNull();
  });

  it('draws the button look: 32px and plain until picked, then in its tone', () => {
    render(
      <DrawerChips
        variant="button"
        label="Default channel"
        options={[
          { value: 'whatsapp', label: 'WhatsApp', tone: 'sage' },
          { value: 'call', label: 'Call', tone: 'sky' },
        ]}
        value="whatsapp"
        onChange={() => {}}
      />,
    );
    const on = screen.getByRole('button', { name: 'WhatsApp' });
    const off = screen.getByRole('button', { name: 'Call' });
    expect(on).toHaveClass('h-8', 'rounded-lg', 'bg-tone-sage', 'border-current');
    expect(on).toHaveAttribute('data-slot', 'button');
    expect(off).toHaveClass('bg-card', 'border-border');
    expect(off).not.toHaveClass('bg-tone-sky');
  });

  it('names a chip’s hint on hover — "20 minutes", "First visit or doctor review"', () => {
    render(
      <DrawerChips
        label="Length"
        options={[
          { value: '20', label: '20 min', hint: '20 minutes' },
          { value: '30', label: '30 min' },
        ]}
        value="20"
        onChange={() => undefined}
        testId="length"
      />,
    );
    expect(screen.getByTestId('length-20')).toHaveAttribute('title', '20 minutes');
    expect(screen.getByTestId('length-30')).not.toHaveAttribute('title');
  });

  it('has no axe violations', async () => {
    const { container } = render(<PickAny />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
