import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { LEAD_SOURCE_VALUES, LEAD_STATUS_VALUES } from '@/shared/api/app/app-schema.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

import {
  contactRecord,
  leadRecord,
  NIDHI,
  RIYA,
  TEAM_BY_ID,
} from '../../__tests__/integration/leads-test-data.ts';
import { leadContactCardData, leadReach } from './lead-contact.ts';
import {
  LEAD_INTEREST_CHIPS,
  LEAD_SOURCE_ICONS,
  LEAD_SOURCE_ORDER,
  LEAD_STATUS_ORDER,
  leadInterestViews,
} from './lead-display.ts';
import { memberPerson, teamCardDataOf } from './lead-people.ts';
import { LeadInterestPills, LeadSourcePill, LeadStatusPill } from './LeadFields.tsx';

const labels = { source: (source: string) => `via ${source}` };

describe('lead display', () => {
  it('gives each of the seven sources an icon and orders the chips as the design, no Phone call', () => {
    for (const source of LEAD_SOURCE_VALUES)
      expect(LEAD_SOURCE_ICONS[source]).toBeDefined();
    expect(Object.keys(LEAD_SOURCE_ICONS)).toHaveLength(7);
    expect(LEAD_SOURCE_ORDER).toEqual([
      'instagram',
      'google',
      'whatsapp',
      'facebook',
      'walk_in',
      'referral',
      'retarget',
    ]);
    expect(LEAD_SOURCE_ORDER).not.toContain('phone_call');
  });

  it('orders every status as the pipeline runs — the track, then the closing ones', () => {
    expect(LEAD_STATUS_ORDER).toEqual([
      'new',
      'contacted',
      'follow_up',
      'appointment_scheduled',
      'clinic_visited',
      'no_response',
      'not_interested',
      'invalid',
      'lost',
    ]);
    expect([...LEAD_STATUS_ORDER].sort()).toEqual([...LEAD_STATUS_VALUES].sort());
  });

  it('offers six interest chips with "Others" last', () => {
    expect(LEAD_INTEREST_CHIPS).toEqual([
      'clinical',
      'peel',
      'lhr',
      'hydrafacial',
      'prp',
      'others',
    ]);
  });

  it('shows a lead’s interests in their order, each labelled in its tone', () => {
    expect(
      leadInterestViews(['lhr', 'others', 'clinical'], (interest) =>
        interest.toUpperCase(),
      ),
    ).toEqual([
      { key: 'lhr', label: 'LHR', tone: 'lav' },
      { key: 'others', label: 'OTHERS', tone: 'stone' },
      { key: 'clinical', label: 'CLINICAL', tone: 'sky' },
    ]);
    expect(leadInterestViews([], String)).toEqual([]);
  });
});

describe('lead people', () => {
  it('shows a member as an avatar pill with no presence', () => {
    const person = memberPerson(RIYA);
    expect(person).toEqual({
      id: RIYA.id,
      name: 'Riya Shah',
      initials: 'RS',
      tone: 'blush',
    });
    expect(person).not.toHaveProperty('presence');
  });

  it('builds the team card from the name alone — no role, presence or phone', () => {
    const card = teamCardDataOf(NIDHI, '2026-10-03T04:30:00.000Z');
    expect(card).toEqual({
      name: 'Nidhi Kapoor',
      initials: 'NK',
      tone: 'sage',
      role: '',
      updatedAt: '2026-10-03T04:30:00.000Z',
    });
    expect(card).not.toHaveProperty('online');
    expect(card).not.toHaveProperty('phone');
    expect(teamCardDataOf(NIDHI).updatedAt).toBeNull();
  });
});

describe('lead contact', () => {
  it('reaches a list row’s person on their primary number only', () => {
    expect(leadReach(leadRecord())).toEqual([
      { channel: 'phone', phone: '+919879521034' },
    ]);
    expect(leadReach(leadRecord({ phone: null }))).toEqual([]);
  });

  it('reaches a read contact on every number, primary first, WhatsApp where they are on it, then every handle', () => {
    const contact = contactRecord({
      phones: [
        { phone: '+919099055120', isPrimary: false, isOnWhatsapp: false },
        { phone: '+919825011241', isPrimary: true, isOnWhatsapp: true },
      ],
      instagramHandles: ['@anaya', '@anaya.skin'],
    });
    expect(leadReach(leadRecord(), contact)).toEqual([
      { channel: 'whatsapp', phone: '+919825011241' },
      { channel: 'phone', phone: '+919099055120' },
      { channel: 'instagram', handle: '@anaya' },
      { channel: 'instagram', handle: '@anaya.skin' },
    ]);
  });

  it('reads a lead as a lead’s card with its owner and involved members, and the source', () => {
    const lead = leadRecord({ involvedIds: [RIYA.id, 'mem_gone0000000000000000'] });
    expect(leadContactCardData(lead, TEAM_BY_ID, labels)).toEqual({
      kind: 'lead',
      name: 'Anaya Desai',
      since: lead.createdAt,
      reach: [{ channel: 'phone', phone: '+919879521034' }],
      team: [
        { id: NIDHI.id, name: 'Nidhi Kapoor', initials: 'NK', tone: 'sage', role: '' },
        { id: RIYA.id, name: 'Riya Shah', initials: 'RS', tone: 'blush', role: '' },
      ],
      about: { source: 'via whatsapp' },
    });
  });

  it('reads a linked lead as a patient’s card, and uses the read contact’s reach', () => {
    const card = leadContactCardData(
      leadRecord({ patientId: 'pat_anaya0000000000000000', ownerId: null, source: null }),
      TEAM_BY_ID,
      labels,
      contactRecord({ instagramHandles: ['@anaya'] }),
    );
    expect(card).toMatchObject({
      kind: 'patient',
      since: null,
      team: [],
      about: { source: null },
      reach: [
        { channel: 'whatsapp', phone: '+919879521034' },
        { channel: 'instagram', handle: '@anaya' },
      ],
    });
  });
});

describe('the lead pills', () => {
  it('shows the status in its tone, "Re-targeted" for a re-target lead still New', () => {
    const { rerender } = render(
      <LeadStatusPill lead={{ status: 'follow_up', kind: 'enquiry' }} />,
    );
    expect(screen.getByText('Follow-up').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'butter',
    );
    rerender(<LeadStatusPill lead={{ status: 'new', kind: 'retarget' }} />);
    expect(screen.getByText('Re-targeted')).toBeInTheDocument();
    rerender(<LeadStatusPill lead={{ status: 'contacted', kind: 'retarget' }} />);
    expect(screen.getByText('Contacted')).toBeInTheDocument();
  });

  it('shows the source with its icon in its tone, and nothing without one', () => {
    const { container, rerender } = render(<LeadSourcePill source="walk_in" />);
    const pill = screen.getByText('Walk-in').closest('[data-tone]');
    expect(pill).toHaveAttribute('data-tone', 'lav');
    expect(pill?.querySelector('svg')).not.toBeNull();
    rerender(<LeadSourcePill source={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the first interest and a "+N" naming them all', async () => {
    const { container } = render(
      <TooltipProvider>
        <LeadInterestPills interests={['peel', 'prp', 'others']} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Peel')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('2 more: Peel, PRP, Others')).toHaveClass('sr-only');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows one interest without a "+N", and nothing for none', () => {
    const { container, rerender } = render(
      <TooltipProvider>
        <LeadInterestPills interests={['lhr']} />
      </TooltipProvider>,
    );
    expect(screen.getByText('LHR')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).toBeNull();
    rerender(
      <TooltipProvider>
        <LeadInterestPills interests={[]} />
      </TooltipProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
