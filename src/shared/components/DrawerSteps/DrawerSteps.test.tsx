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
      { kind: 'value', label: 'Status' },
      { kind: 'value', label: 'Patient type' },
      { kind: 'value', label: 'Referred by' },
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

function Steps({
  initial = 'contact',
  revealMissing,
}: {
  initial?: string;
  revealMissing?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DrawerSteps
      steps={STEPS}
      value={value}
      onValueChange={setValue}
      tone="sky"
      revealMissing={revealMissing}
      testId="pt"
    />
  );
}

const card = (id: string) => screen.getByTestId(`pt-step-${id}`);
const trigger = (id: string) => screen.getByTestId(`pt-step-${id}-trigger`);
const chevron = (id: string) => trigger(id).querySelector('[data-slot="step-chevron"]');

describe('DrawerSteps', () => {
  it('opens the first step: its body and "Next: <step> →", no sub line, no hint', () => {
    render(<Steps />);

    expect(card('contact')).toHaveAttribute('data-status', 'open');
    expect(card('contact')).toHaveAttribute('data-state', 'open');
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByTestId('pt-step-contact-next')).toHaveTextContent(
      'Next: Clinic, referral & follow-up →',
    );
    // An open card shows no peek, no sub line and no hint — its fields are right there.
    expect(screen.queryByTestId('pt-step-contact-peek')).not.toBeInTheDocument();
    expect(within(trigger('contact')).queryByText('Open')).not.toBeInTheDocument();
    expect(within(trigger('contact')).queryByText('Priya')).not.toBeInTheDocument();
    // Its chevron points up: it folds away.
    expect(chevron('contact')).toHaveClass('rotate-180');
  });

  it('never flags a step the user has not reached: a grey number and "Open"', () => {
    render(<Steps />);

    expect(card('clinic')).toHaveAttribute('data-status', 'later');
    expect(within(trigger('clinic')).getByText('2')).toBeInTheDocument();
    expect(within(trigger('clinic')).queryByText('!')).not.toBeInTheDocument();
    expect(within(trigger('clinic')).queryByText(/^Missing:/)).not.toBeInTheDocument();
    expect(within(trigger('clinic')).getByText('Open')).toBeInTheDocument();
    expect(chevron('clinic')).not.toHaveClass('rotate-180');
  });

  it('flags a reached step with an empty required field: "!", "Missing: …" in red, "Edit"', async () => {
    const user = userEvent.setup();
    render(<Steps />);

    await user.click(screen.getByTestId('pt-step-contact-next'));
    await user.click(trigger('clinic'));

    expect(card('clinic')).toHaveAttribute('data-status', 'missing');
    expect(within(trigger('clinic')).getByText('!')).toBeInTheDocument();
    const line = within(trigger('clinic')).getByText('Missing: Status, Patient type');
    expect(line).toHaveClass('text-destructive');
    expect(within(trigger('clinic')).getByText('Edit')).toBeInTheDocument();
    // The missing fields are named once — not again in "Not filled".
    const peek = screen.getByTestId('pt-step-clinic-peek');
    expect(within(peek).getByText('Not filled: Referred by')).toBeInTheDocument();
  });

  it('flags every step with an empty required field once a save was tried', () => {
    render(<Steps revealMissing />);

    expect(card('clinic')).toHaveAttribute('data-status', 'missing');
    expect(card('notes')).toHaveAttribute('data-status', 'later');
  });

  it('reads a step that holds something as done before it is reached — a saved record, a default', () => {
    render(<Steps />);

    expect(card('items')).toHaveAttribute('data-status', 'done');
    expect(within(trigger('items')).getByText('Edit')).toBeInTheDocument();
    // Nothing in it and never opened: later.
    expect(card('notes')).toHaveAttribute('data-status', 'later');
  });

  it('reads a collapsed step back as its values — no field names on the card — and counts the empty ones', async () => {
    const user = userEvent.setup();
    render(<Steps />);

    await user.click(trigger('items'));

    const peek = screen.getByTestId('pt-step-contact-peek');
    const [lead, status] = within(peek).getAllByRole('listitem');
    // The lead value in the full ink; its field's name only read out and on hover.
    expect(lead).toHaveTextContent('First name: Priya');
    expect(lead).toHaveClass('text-foreground', 'font-medium');
    expect(lead).toHaveAttribute('title', 'First name · Priya');
    expect(within(lead!).getByText('First name:', { exact: false })).toHaveClass(
      'sr-only',
    );
    expect(within(status!).getByText('New')).toHaveAttribute('data-slot', 'pill');
    // No dashed tile per empty field: one quiet count, the names read out and on hover.
    expect(within(peek).queryByText('Empty')).not.toBeInTheDocument();
    expect(within(peek).getByText('1 not filled')).toBeVisible();
    expect(within(peek).getByText('Not filled: Mobile')).toHaveClass('sr-only');
    expect(peek.querySelector('.border-dashed')).toBeNull();
    // No sub line under the head while the summary says it all.
    expect(
      within(trigger('contact')).queryByText(/Not filled yet/),
    ).not.toBeInTheDocument();
  });

  it('reads "Not filled yet" on a step that holds nothing, with no summary under it', () => {
    render(<Steps />);

    expect(within(trigger('notes')).getByText('Not filled yet')).toBeInTheDocument();
    expect(screen.queryByTestId('pt-step-notes-peek')).not.toBeInTheDocument();
  });

  it('shows a multi-select as four pills then "+N"', () => {
    render(<Steps />);

    const peek = screen.getByTestId('pt-step-clinic-peek');
    expect(within(peek).getByRole('listitem')).toHaveAttribute('title', 'Interests');
    for (const pick of ['LHR', 'Peel', 'Botox', 'Fillers']) {
      expect(within(peek).getByText(pick)).toBeInTheDocument();
    }
    expect(within(peek).queryByText('HydraFacial')).not.toBeInTheDocument();
    expect(within(peek).getByText('+2')).toBeInTheDocument();
  });

  it('shows an items table as a row of chips: six names then "+N"', () => {
    render(<Steps />);

    const items = screen.getByTestId('pt-step-items-peek');
    expect(within(items).getByTitle('Medicine')).toBeInTheDocument();
    expect(within(items).getByText('F')).toBeInTheDocument();
    expect(within(items).queryByText('G')).not.toBeInTheDocument();
    expect(within(items).getByText('+2')).toBeInTheDocument();
  });

  it('shows six filled pairs, then "+N more"', () => {
    const many: DrawerStep[] = [
      { id: 'open', title: 'Open', content: <p>open body</p> },
      {
        id: 'many',
        title: 'Many',
        peek: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label) => ({
          kind: 'value' as const,
          label,
          value: `${label} value`,
        })),
        content: null,
      },
    ];
    render(
      <DrawerSteps steps={many} value="open" onValueChange={() => {}} testId="pt" />,
    );

    const peek = screen.getByTestId('pt-step-many-peek');
    expect(within(peek).getByText('F value')).toBeInTheDocument();
    expect(within(peek).queryByText('G value')).not.toBeInTheDocument();
    expect(within(peek).getByText('+2 more')).toBeInTheDocument();
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

  it('lets a closed card be opened anywhere — its head stretches over the summary — and lifts on hover', () => {
    render(<Steps />);

    expect(card('items')).toHaveClass(
      'relative',
      'data-[state=closed]:hover:border-border-strong',
    );
    expect(trigger('items')).toHaveClass(
      'data-[state=closed]:after:absolute',
      'data-[state=closed]:after:inset-0',
    );
  });

  it('collapses the open step: a reached step reads done, an untouched one stays later', async () => {
    const user = userEvent.setup();
    render(<Steps />);

    await user.click(trigger('contact'));

    expect(card('contact')).toHaveAttribute('data-state', 'closed');
    expect(card('contact')).toHaveAttribute('data-status', 'done');
    expect(card('notes')).toHaveAttribute('data-status', 'later');
  });

  it('fills the open step’s circle with the section tone’s ink, even when it is complete', () => {
    render(
      <DrawerSteps
        steps={[{ ...STEPS[0]!, complete: true }, STEPS[1]!]}
        value="contact"
        onValueChange={() => {}}
        tone="sky"
        testId="pt"
      />,
    );

    const circle = trigger('contact').querySelector('[data-slot="pill"]');
    expect(circle).toHaveClass('bg-tone-sky-foreground', 'text-background');
    expect(circle).toHaveTextContent('1');
  });

  it('reads a collapsed `complete` step without a peek as done', () => {
    render(
      <DrawerSteps
        steps={[
          { id: 'open', title: 'Open', content: <p>a</p> },
          {
            id: 'view',
            title: 'Report',
            complete: true,
            summary: 'Lab · 2 files',
            content: null,
          },
        ]}
        value="open"
        onValueChange={() => {}}
        testId="rv"
      />,
    );

    const view = screen.getByTestId('rv-step-view-trigger');
    expect(screen.getByTestId('rv-step-view')).toHaveAttribute('data-status', 'done');
    expect(view).toHaveTextContent('Lab · 2 files');
  });

  it('keeps a locked step shut: its hint, a grey lock, no chevron, the attempt instead of opening', async () => {
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
        collapsible={false}
        testId="nl"
      />,
    );

    const locked = screen.getByTestId('nl-step-details-trigger');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveTextContent('After contact');
    expect(locked).toHaveTextContent('Source, interest and who handles it');
    expect(locked).toHaveTextContent('Step 2 of 2 · Locked');
    expect(locked.querySelector('[data-slot="pill"]')).toHaveClass(
      'bg-border',
      'text-disabled',
    );
    expect(locked.querySelector('[data-slot="step-chevron"]')).toBeNull();
    // The open step that cannot fold away shows no chevron either.
    expect(
      screen
        .getByTestId('nl-step-contact-trigger')
        .querySelector('[data-slot="step-chevron"]'),
    ).toBeNull();
    // The open step before it offers no "Next" into a locked one.
    expect(screen.queryByTestId('nl-step-contact-next')).toBeNull();

    await user.click(locked);
    expect(attempts).toEqual(['details']);
    expect(screen.getByTestId('nl-step-details')).toHaveAttribute('data-state', 'closed');
  });

  it('reads out each step’s place and state, which the circle shows in colour', () => {
    render(<Steps />);

    expect(trigger('contact')).toHaveTextContent('Step 1 of 4 · In progress');
    expect(trigger('clinic')).toHaveTextContent('Step 2 of 4 · Not started');
    expect(trigger('items')).toHaveTextContent('Step 3 of 4 · Complete');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Steps />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
