import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

import { NIDHI, RIYA, TEAM } from '../../__tests__/integration/leads-test-data.ts';
import {
  LeadCard,
  LeadContactStrip,
  LeadInterestsField,
  LeadPeopleField,
  type LeadPeopleFieldProps,
  LeadProgressField,
  LeadSourceField,
} from './index.ts';

describe('LeadCard', () => {
  it('titles the card at the design’s 13.5px/600 — a defined text step (H:1768)', () => {
    render(
      <LeadCard label="Lead details" number={1}>
        <p>fields</p>
      </LeadCard>,
    );
    const title = screen.getByRole('heading', { name: 'Lead details' });
    expect(title).toHaveClass('text-field', 'font-semibold');
    expect(title).not.toHaveClass('text-body-lg');
    expect(screen.getByRole('region', { name: 'Lead details' })).toHaveTextContent(
      '1Lead detailsfields',
    );
  });
});

describe('LeadSourceField', () => {
  it('offers the seven sources in the design’s order — no Phone call — one picked', async () => {
    const onChange = vi.fn();
    render(<LeadSourceField value="whatsapp" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Source' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Instagram',
      'Google',
      'WhatsApp',
      'Facebook',
      'Walk-in',
      'Referral',
      'Re-target',
    ]);
    expect(within(group).getByRole('button', { name: 'WhatsApp' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const user = userEvent.setup();
    await user.click(within(group).getByRole('button', { name: 'Walk-in' }));
    expect(onChange).toHaveBeenCalledWith('walk_in');
    onChange.mockClear();
    await user.click(within(group).getByRole('button', { name: 'WhatsApp' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('LeadInterestsField', () => {
  it('toggles the six chips, "Others" last, with no typed interest', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LeadInterestsField value={['clinical', 'others']} onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Interested in' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Clinical', 'Peel', 'LHR', 'Hydrafacial', 'PRP', 'Others']);
    expect(within(group).getByRole('button', { name: 'Others' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(within(group).getByRole('button', { name: 'Peel' }));
    expect(onChange).toHaveBeenLastCalledWith(['clinical', 'peel', 'others']);
    await user.click(within(group).getByRole('button', { name: 'Clinical' }));
    expect(onChange).toHaveBeenLastCalledWith(['others']);
  });
});

describe('LeadProgressField', () => {
  it('marks done, current and next on the track, and closes as any closing status', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LeadProgressField status="contacted" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /New/ })).toHaveAttribute(
      'title',
      'New · completed',
    );
    expect(screen.getByRole('button', { name: /Contacted/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Contacted/ })).toHaveAttribute(
      'title',
      'Contacted · current step',
    );
    const followUp = screen.getByRole('button', { name: /Follow-up/ });
    expect(followUp).toHaveAttribute('title', 'Move to Follow-up');
    await user.click(followUp);
    expect(onChange).toHaveBeenLastCalledWith('follow_up');
    await user.click(screen.getByRole('button', { name: /New/ }));
    expect(onChange).toHaveBeenLastCalledWith('new');
    await user.click(screen.getByRole('button', { name: 'Lost' }));
    expect(onChange).toHaveBeenLastCalledWith('lost');
  });

  it('never picks Clinic visited — a check-in sets it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LeadProgressField status="follow_up" onChange={onChange} />);
    const visited = screen.getByRole('button', { name: /Clinic visited/ });
    expect(visited).toBeDisabled();
    expect(visited).toHaveAttribute('title', 'Clinic visited · set when they check in');
    await user.click(visited);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a closed lead’s status picked under "Close as", the track still open', () => {
    render(<LeadProgressField status="not_interested" onChange={() => {}} />);
    const closeAs = screen.getByRole('group', { name: 'Close as' });
    expect(
      within(closeAs).getByRole('button', { name: 'Not interested' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /New/ })).toBeEnabled();
  });

  it('only shows a visited lead’s track and "Close as"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LeadProgressField status="clinic_visited" onChange={onChange} />);
    const progress = screen.getByRole('region', { name: 'Lead progress' });
    for (const button of within(progress).getAllByRole('button'))
      expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: /Clinic visited/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /Contacted/ }));
    await user.click(screen.getByRole('button', { name: 'Lost' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('LeadPeopleField', () => {
  const field = (props: Partial<LeadPeopleFieldProps> = {}) => (
    <TooltipProvider>
      <LeadPeopleField
        ownerId={RIYA.id}
        involvedIds={[NIDHI.id]}
        members={TEAM}
        onAssign={() => {}}
        onToggleInvolved={() => {}}
        {...props}
      />
    </TooltipProvider>
  );

  const openPeople = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
      screen.getByRole('button', { name: 'Assigned and involved people' }),
    );
    return screen.findByRole('dialog');
  };

  it('shows the owner’s chip and the involved, and lets anyone be assigned', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    const { container } = render(field({ onAssign }));
    const trigger = screen.getByRole('button', { name: 'Assigned and involved people' });
    expect(trigger).toHaveTextContent('Riya S.');
    expect(within(trigger).getByTitle('Nidhi Kapoor')).toBeInTheDocument();
    const popover = await openPeople(user);
    const assigned = within(popover).getByRole('button', { name: 'Assigned' });
    expect(assigned).toHaveAttribute('aria-pressed', 'true');
    expect(assigned).toHaveAttribute('title', 'Currently assigned');
    await user.click(assigned);
    expect(onAssign).not.toHaveBeenCalled();
    const assign = within(popover).getByRole('button', { name: 'Assign' });
    expect(assign).toHaveAttribute('title', 'Assign to Nidhi Kapoor');
    await user.click(assign);
    expect(onAssign).toHaveBeenCalledWith(NIDHI);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('toggles who is involved — never the owner — and searches the team', async () => {
    const user = userEvent.setup();
    const onToggleInvolved = vi.fn();
    render(field({ onToggleInvolved }));
    const popover = await openPeople(user);
    const [ownerToggle, nidhiToggle] = within(popover).getAllByRole('button', {
      name: 'Involved · worked on this lead',
    });
    expect(ownerToggle).toBeDisabled();
    expect(nidhiToggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(nidhiToggle as HTMLElement);
    expect(onToggleInvolved).toHaveBeenCalledWith(NIDHI, false);
    const search = within(popover).getByRole('textbox', { name: 'Search team' });
    expect(search).toHaveClass('text-field');
    await user.type(search, 'nid');
    expect(within(popover).queryByText('Riya Shah')).toBeNull();
    expect(within(popover).getByText('Nidhi Kapoor')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(within(popover).getByText('No match')).toBeInTheDocument();
  });

  it('offers "+ Add involved" with no one involved, and adds them', async () => {
    const user = userEvent.setup();
    const onToggleInvolved = vi.fn();
    render(field({ ownerId: null, involvedIds: [], onToggleInvolved }));
    expect(
      screen.getByRole('button', { name: 'Assigned and involved people' }),
    ).toHaveTextContent('+ Add involved');
    const popover = await openPeople(user);
    expect(within(popover).getAllByRole('button', { name: 'Assign' })).toHaveLength(2);
    const [riyaToggle] = within(popover).getAllByRole('button', {
      name: 'Involved · worked on this lead',
    });
    await user.click(riyaToggle as HTMLElement);
    expect(onToggleInvolved).toHaveBeenCalledWith(RIYA, true);
  });

  it('shows "Claim" and "Release" beside the label when offered', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    const onRelease = vi.fn();
    const { rerender } = render(field({ onClaim }));
    expect(screen.queryByRole('button', { name: 'Release' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Claim' }));
    expect(onClaim).toHaveBeenCalledTimes(1);
    rerender(field({ onRelease }));
    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Release' }));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('only shows the people without Edit', () => {
    render(field({ readOnly: true }));
    const trigger = screen.getByRole('button', { name: 'Assigned and involved people' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('Riya S.');
  });
});

describe('LeadContactStrip', () => {
  it('shows the person — a patient’s badge, the mobile, the extra reach — and its aside', () => {
    render(
      <TooltipProvider>
        <LeadContactStrip
          card={{ kind: 'patient', name: 'Dharti Galani', reach: [] }}
          name="Dharti Galani"
          phone="+918200603212"
          more=" · +2 more"
          aside={<button type="button">Change</button>}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText('Dharti Galani')).toBeInTheDocument();
    const phone = screen.getByText('+91 82006 03212');
    expect(phone).toHaveAttribute('dir', 'ltr');
    expect(phone.parentElement).toHaveTextContent('+91 82006 03212 · +2 more');
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByText('DG')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('shows a lead without a badge or a number yet, its name whole on a right-to-left page', () => {
    render(
      <TooltipProvider>
        <div dir="rtl">
          <LeadContactStrip
            card={{ kind: 'lead', name: 'Riya S.', reach: [] }}
            name="Riya S."
            phone={null}
          />
        </div>
      </TooltipProvider>,
    );
    const name = screen.getByText('Riya S.');
    expect(name).toHaveAttribute('dir', 'auto');
    expect(name).toHaveClass('[text-align:match-parent]');
    expect(name.parentElement).toHaveTextContent(/^Riya S\.$/);
    expect(screen.queryByText('P')).toBeNull();
  });
});
