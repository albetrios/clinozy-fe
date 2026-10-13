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

  it('keeps every pill when values repeat — two rows of one offering, two members of one name', () => {
    const repeats: DrawerStep[] = [
      { id: 'open', title: 'Open', content: <p>open body</p> },
      {
        id: 'items',
        title: 'Items',
        peek: [
          { kind: 'items', label: 'Offering', names: ['Corn Removal', 'Corn Removal'] },
        ],
        content: null,
      },
      {
        id: 'team',
        title: 'Team',
        peek: [
          {
            kind: 'multi',
            label: 'Team',
            values: [{ label: 'Riya S.' }, { label: 'Riya S.' }, { label: 'Kiran P.' }],
          },
        ],
        content: null,
      },
    ];
    const { rerender } = render(
      <DrawerSteps steps={repeats} value="open" onValueChange={() => {}} testId="pt" />,
    );
    const pills = () => [
      ...within(screen.getByTestId('pt-step-items-peek')).getAllByText('Corn Removal'),
      ...within(screen.getByTestId('pt-step-team-peek')).getAllByText(
        /Riya S\.|Kiran P\./,
      ),
    ];
    expect(pills()).toHaveLength(5);
    rerender(
      <DrawerSteps steps={repeats} value="open" onValueChange={() => {}} testId="pt" />,
    );
    expect(pills()).toHaveLength(5);
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

  it('keeps a locked step shut: its hint, a grey number, the attempt instead of opening', async () => {
    const user = userEvent.setup();
    const attempts: string[] = [];
    const steps: DrawerStep[] = [
      { id: 'contact', title: 'Contact', content: <p>contact body</p> },
      {
        id: 'details',
        title: 'Lead details',
        summary: 'Source, interest and who handles it',
        locked: { hint: 'After contact', onAttempt: () => attempts.push('details') },
        content: <p>details body</p>,
      },
    ];
    render(
      <DrawerSteps
        steps={steps}
        value="contact"
        onValueChange={() => {}}
        tone="lav"
        testId="nl"
      />,
    );

    const locked = screen.getByTestId('nl-step-details-trigger');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveTextContent('After contact');
    expect(locked).toHaveTextContent('Source, interest and who handles it');
    expect(locked.querySelector('[data-slot="pill"]')).toHaveClass(
      'bg-border',
      'text-disabled',
    );
    // The open step before it offers no "Next" into a locked one.
    expect(screen.queryByTestId('nl-step-contact-next')).toBeNull();

    await user.click(locked);
    expect(attempts).toEqual(['details']);
    expect(screen.getByTestId('nl-step-details')).toHaveAttribute('data-state', 'closed');
  });

  it('turns a filled-in step’s circle green, open or not', () => {
    render(
      <DrawerSteps
        steps={[
          {
            id: 'identity',
            title: 'Identity & reach',
            complete: true,
            content: <p>a</p>,
          },
          { id: 'preferences', title: 'Contact preferences', content: <p>b</p> },
        ]}
        value="identity"
        onValueChange={() => {}}
        tone="stone"
        testId="ce"
      />,
    );
    const circle = (id: string) =>
      screen.getByTestId(`ce-step-${id}-trigger`).querySelector('[data-slot="pill"]');
    expect(circle('identity')).toHaveClass('bg-success');
    expect(circle('identity')).toHaveTextContent('1');
    expect(circle('preferences')).not.toHaveClass('bg-success');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Steps />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
