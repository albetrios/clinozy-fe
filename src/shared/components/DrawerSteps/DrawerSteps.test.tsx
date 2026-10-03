import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { type DrawerStep, DrawerSteps } from './DrawerSteps.tsx';

const STEPS: DrawerStep[] = [
  {
    id: 'contact',
    title: 'Contact & personal',
    summary: 'Priya · Shah',
    peek: [
      { kind: 'value', label: 'First name', value: 'Priya' },
      { kind: 'value', label: 'Mobile' },
      { kind: 'value', label: 'Status', value: 'New', tone: 'sky' },
    ],
    content: <input aria-label="First name" defaultValue="Priya" />,
  },
  {
    id: 'clinic',
    title: 'Clinic, referral & follow-up',
    missing: ['Status', 'Patient type'],
    peek: [
      {
        kind: 'multi',
        label: 'Interests',
        values: [
          { label: 'LHR', tone: 'blush' },
          { label: 'Peel' },
          { label: 'Botox' },
          { label: 'Fillers' },
          { label: 'HydraFacial' },
          { label: 'Acne' },
        ],
      },
    ],
    content: <p>clinic body</p>,
  },
  {
    id: 'items',
    title: 'Items',
    peek: [
      {
        kind: 'items',
        label: 'Medicine',
        names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
    ],
    content: <p>items body</p>,
  },
  {
    id: 'notes',
    title: 'Notes',
    peek: [{ kind: 'items', label: 'Photos', names: [] }],
    content: <p>notes body</p>,
  },
];

function Steps({ initial = 'contact' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <DrawerSteps
      steps={STEPS}
      value={value}
      onValueChange={setValue}
      tone="sky"
      testId="pt"
    />
  );
}

const card = (id: string) => screen.getByTestId(`pt-step-${id}`);
const trigger = (id: string) => screen.getByTestId(`pt-step-${id}-trigger`);

describe('DrawerSteps', () => {
  it('opens the first step: its body, its summary line and "Next: <step> →"', () => {
    render(<Steps />);

    expect(card('contact')).toHaveAttribute('data-status', 'open');
    expect(card('contact')).toHaveAttribute('data-state', 'open');
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(within(trigger('contact')).getByText('Priya · Shah')).toBeInTheDocument();
    expect(screen.getByTestId('pt-step-contact-next')).toHaveTextContent(
      'Next: Clinic, referral & follow-up →',
    );
    // An open card shows no peek and no hint.
    expect(screen.queryByTestId('pt-step-contact-peek')).not.toBeInTheDocument();
    expect(within(trigger('contact')).queryByText('Open')).not.toBeInTheDocument();
  });

  it('marks a later step with a missing required field with "!" and names the fields', () => {
    render(<Steps />);

    expect(card('clinic')).toHaveAttribute('data-status', 'missing');
    expect(within(trigger('clinic')).getByText('!')).toBeInTheDocument();
    expect(
      within(trigger('clinic')).getByText('Missing: Status, Patient type'),
    ).toBeInTheDocument();
    expect(within(trigger('clinic')).getByText('Open')).toBeInTheDocument();
  });

  it('numbers the later steps and offers to open them', () => {
    render(<Steps />);

    expect(card('items')).toHaveAttribute('data-status', 'later');
    expect(within(trigger('items')).getByText('3')).toBeInTheDocument();
    expect(within(trigger('items')).getByText('Open')).toBeInTheDocument();
  });

  it('peeks a multi-select as four pills then "+N"', () => {
    render(<Steps />);

    const peek = screen.getByTestId('pt-step-clinic-peek');
    expect(within(peek).getByText('Interests')).toBeInTheDocument();
    for (const pick of ['LHR', 'Peel', 'Botox', 'Fillers']) {
      expect(within(peek).getByText(pick)).toBeInTheDocument();
    }
    expect(within(peek).queryByText('HydraFacial')).not.toBeInTheDocument();
    expect(within(peek).getByText('+2')).toBeInTheDocument();
  });

  it('peeks an items table as "<N> added", six names then "+N" — or "None yet"', () => {
    render(<Steps />);

    const items = screen.getByTestId('pt-step-items-peek');
    expect(within(items).getByText('Medicine · 8 added')).toBeInTheDocument();
    expect(within(items).getByText('F')).toBeInTheDocument();
    expect(within(items).queryByText('G')).not.toBeInTheDocument();
    expect(within(items).getByText('+2')).toBeInTheDocument();

    const notes = screen.getByTestId('pt-step-notes-peek');
    expect(within(notes).getByText('Photos · None yet')).toBeInTheDocument();
  });

  it('"Next" opens the next step, marks the one left done and moves focus to it', async () => {
    const user = userEvent.setup();
    render(<Steps />);

    await user.click(screen.getByTestId('pt-step-contact-next'));

    expect(card('clinic')).toHaveAttribute('data-status', 'open');
    expect(screen.getByText('clinic body')).toBeInTheDocument();
    expect(trigger('clinic')).toHaveFocus();
    expect(card('contact')).toHaveAttribute('data-status', 'done');
    expect(within(trigger('contact')).getByText('Edit')).toBeInTheDocument();
    // The open step's missing fields are not flagged while it is being filled.
    expect(within(trigger('clinic')).queryByText(/^Missing:/)).not.toBeInTheDocument();
  });

  it('shows a collapsed step’s peek, with "Empty" on a dashed tile for a blank field', async () => {
    const user = userEvent.setup();
    render(<Steps />);

    await user.click(trigger('items'));

    const peek = screen.getByTestId('pt-step-contact-peek');
    expect(within(peek).getByText('Priya')).toBeInTheDocument();
    expect(within(peek).getByText('Empty').parentElement).toHaveClass('border-dashed');
    expect(within(peek).getByText('New')).toHaveAttribute('data-slot', 'pill');
    // With a peek, the summary line gives way to it.
    expect(
      within(trigger('contact')).queryByText('Priya · Shah'),
    ).not.toBeInTheDocument();
  });

  it('lets a closed card be opened anywhere — its head stretches over the peek', () => {
    render(<Steps />);

    expect(card('items')).toHaveClass('relative');
    expect(trigger('items')).toHaveClass(
      'data-[state=closed]:after:absolute',
      'data-[state=closed]:after:inset-0',
    );
  });

  it('collapses the open step and keeps the steps already passed done', async () => {
    const user = userEvent.setup();
    render(<Steps initial="items" />);

    await user.click(trigger('items'));

    expect(card('items')).toHaveAttribute('data-state', 'closed');
    expect(card('items')).toHaveAttribute('data-status', 'done');
    expect(card('contact')).toHaveAttribute('data-status', 'done');
    expect(card('notes')).toHaveAttribute('data-status', 'later');
  });

  it('fills the open step’s circle with the section tone’s ink', () => {
    render(<Steps />);

    const circle = trigger('contact').querySelector('[data-slot="pill"]');
    expect(circle).toHaveClass('bg-tone-sky-foreground', 'text-background');
    expect(circle).toHaveTextContent('1');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Steps />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
