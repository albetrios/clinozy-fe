import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

import { ASHA, NIDHI, RIYA } from '../../__tests__/integration/leads-test-data.ts';
import {
  LeadCard,
  LeadContactStrip,
  LeadInterestsField,
  LeadPeopleField,
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
    // `text-body-lg` is no step of this theme: it rendered at the inherited 16px.
    expect(title).toHaveClass('text-field', 'font-semibold');
    expect(title).not.toHaveClass('text-body-lg');
  });
});

describe('LeadSourceField', () => {
  it('offers the sources in the design’s order, Phone call last, one picked', async () => {
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
      'Phone call',
    ]);
    expect(within(group).getByRole('button', { name: 'WhatsApp' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent
      .setup()
      .click(within(group).getByRole('button', { name: 'Phone call' }));
    expect(onChange).toHaveBeenCalledWith('phone_call');
  });
});

describe('LeadInterestsField', () => {
  it('toggles the five chips and keeps the typed ones, adding on Enter, never twice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <LeadInterestsField
        value={{ interests: ['clinical'], customInterests: ['Acne scars'] }}
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('group', { name: 'Interested in' });
    expect(within(group).queryByRole('button', { name: 'Others' })).toBeNull();
    await user.click(within(group).getByRole('button', { name: 'Peel' }));
    expect(onChange).toHaveBeenLastCalledWith({
      interests: ['clinical', 'peel'],
      customInterests: ['Acne scars'],
    });
    rerender(
      <LeadInterestsField
        value={{ interests: ['clinical'], customInterests: ['Acne scars'] }}
        onChange={onChange}
      />,
    );
    const add = screen.getByRole('textbox', { name: 'Add interest' });
    await user.type(add, 'acne SCARS{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.type(add, 'Under-eye{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({
      interests: ['clinical'],
      customInterests: ['Acne scars', 'Under-eye'],
    });
    await user.type(add, 'lhr');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith({
      interests: ['clinical', 'lhr'],
      customInterests: ['Acne scars'],
    });
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
      'title',
      'Contacted · current step',
    );
    await user.click(screen.getByRole('button', { name: /Clinic visited/ }));
    expect(onChange).toHaveBeenLastCalledWith('clinic_visited');
    await user.click(screen.getByRole('button', { name: 'Lost' }));
    expect(onChange).toHaveBeenLastCalledWith('lost');
  });
});

describe('LeadPeopleField', () => {
  it('assigns by the rules and toggles who is involved', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    const onToggleInvolved = vi.fn();
    const onRelease = vi.fn();
    const { container } = render(
      <TooltipProvider>
        <LeadPeopleField
          ownerId={RIYA.id}
          involvedIds={[NIDHI.id]}
          staff={[RIYA, NIDHI, ASHA]}
          viewer={RIYA}
          onAssign={onAssign}
          onToggleInvolved={onToggleInvolved}
          onRelease={onRelease}
        />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Release' }));
    expect(onRelease).toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Assigned and involved people' }),
    );
    const popover = await screen.findByRole('dialog');
    // Asha has left: never offered.
    expect(within(popover).queryByText('Asha Mehta')).toBeNull();
    const rows = within(popover).getAllByRole('button', { name: /Assign/ });
    expect(rows[0]).toHaveTextContent('Assigned');
    await user.click(within(popover).getByRole('button', { name: 'Assign' }));
    expect(onAssign).toHaveBeenCalledWith(NIDHI);
    const involved = within(popover).getAllByRole('button', {
      name: 'Involved · worked on this lead',
    });
    await user.click(involved[1] as HTMLElement);
    expect(onToggleInvolved).toHaveBeenCalledWith(NIDHI, false);
    const search = within(popover).getByRole('textbox', { name: 'Search team' });
    // The picker's search input is 13.5px (`_patterns.md:84`).
    expect(search).toHaveClass('text-field');
    await user.type(search, 'zzz');
    expect(within(popover).getByText('No match')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LeadPeopleField in New lead', () => {
  it('lets anyone be assigned there, where the rules would stop it', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    const field = (anyoneAssignable: boolean) => (
      <TooltipProvider>
        <LeadPeopleField
          ownerId={RIYA.id}
          involvedIds={[]}
          staff={[RIYA, NIDHI]}
          viewer={NIDHI}
          anyoneAssignable={anyoneAssignable}
          onAssign={onAssign}
          onToggleInvolved={() => {}}
        />
      </TooltipProvider>
    );
    const { rerender } = render(field(false));
    await user.click(
      screen.getByRole('button', { name: 'Assigned and involved people' }),
    );
    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByRole('button', { name: 'Assign' })).toBeDisabled();

    rerender(field(true));
    await user.click(within(popover).getByRole('button', { name: 'Assign' }));
    expect(onAssign).toHaveBeenCalledWith(NIDHI);
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
    // The mobile always reads left to right inside its line; " · +2 more"
    // keeps the page's direction after it.
    const phone = screen.getByText('+91 82006 03212');
    expect(phone).toHaveAttribute('dir', 'ltr');
    expect(phone.parentElement).toHaveTextContent('+91 82006 03212 · +2 more');
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    // A patient's avatar carries the "P" badge.
    expect(screen.getByText('DG')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('keeps a Latin name whole on a right-to-left page, aligned as the strip', () => {
    render(
      <TooltipProvider>
        <div dir="rtl">
          <LeadContactStrip
            card={{ kind: 'lead', name: 'Riya S.', reach: [] }}
            name="Riya S."
            phone="+919825044120"
          />
        </div>
      </TooltipProvider>,
    );
    const name = screen.getByText('Riya S.');
    expect(name).toHaveAttribute('dir', 'auto');
    expect(name).toHaveClass('[text-align:match-parent]');
    expect(name.parentElement).toHaveTextContent('Riya S.+91 98250 44120');
  });
});
