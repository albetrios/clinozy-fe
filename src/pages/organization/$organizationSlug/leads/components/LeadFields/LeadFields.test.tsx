import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { LEAD_RECORD_SOURCE_VALUES } from '@/shared/api/clinic/leads-contracts.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

import { leadRecord, NIDHI, RIYA } from '../../__tests__/integration/leads-test-data.ts';
import { leadContactCardData, leadReach } from './lead-contact.ts';
import {
  LEAD_SOURCE_ICONS,
  LEAD_SOURCE_ORDER,
  leadInterestViews,
} from './lead-display.ts';
import { staffPerson, teamCardDataOf } from './lead-people.ts';
import { LeadInterestPills, LeadSourcePill, LeadStatusPill } from './LeadFields.tsx';

describe('lead display', () => {
  it('gives every source an icon and orders the chips as the design, Phone call last', () => {
    for (const source of LEAD_RECORD_SOURCE_VALUES)
      expect(LEAD_SOURCE_ICONS[source]).toBeDefined();
    expect(LEAD_SOURCE_ORDER).toEqual([
      'instagram',
      'google',
      'whatsapp',
      'facebook',
      'walk_in',
      'referral',
      'retarget',
      'phone_call',
    ]);
  });

  it('lists the contract interests, then the typed ones in their hash tone', () => {
    const views = leadInterestViews(
      { interests: ['lhr', 'others'], customInterests: ['Acne scars'] },
      (interest) => interest.toUpperCase(),
    );
    expect(views).toEqual([
      { key: 'lhr', label: 'LHR', tone: 'lav', custom: false },
      { key: 'others', label: 'OTHERS', tone: 'stone', custom: false },
      expect.objectContaining({ key: 'Acne scars', label: 'Acne scars', custom: true }),
    ]);
  });
});

describe('lead people and contact', () => {
  it('names staff and builds their team card', () => {
    expect(personFullName(RIYA)).toBe('Riya Shah');
    expect(staffPerson(RIYA, { presence: true })).toMatchObject({
      name: 'Riya Shah',
      initials: 'RS',
      tone: 'blush',
      presence: 'online',
    });
    expect(staffPerson(NIDHI)).not.toHaveProperty('presence');
    expect(
      teamCardDataOf(RIYA, (role) => role, '2026-10-03T04:30:00.000Z'),
    ).toMatchObject({
      name: 'Riya Shah',
      role: 'front_desk',
      online: true,
      hours: { from: '10:00', to: '19:00' },
      updatedAt: '2026-10-03T04:30:00.000Z',
    });
  });

  it('reaches the person on every number and handle, WhatsApp unless marked off', () => {
    expect(leadReach(leadRecord())).toEqual([
      { channel: 'whatsapp', phone: '+919879521034' },
    ]);
    expect(
      leadReach(
        leadRecord({
          contact: {
            phones: [
              { phone: '+919825011241', whatsapp: true },
              { phone: '+919099055120', whatsapp: false },
            ],
            instagram: ['@rhea'],
            defaultChannel: 'whatsapp',
            preferences: [],
          },
        }),
      ),
    ).toEqual([
      { channel: 'whatsapp', phone: '+919825011241' },
      { channel: 'phone', phone: '+919099055120' },
      { channel: 'instagram', handle: '@rhea' },
    ]);
  });

  it('reads a lead as a lead’s card — or a patient’s once linked', () => {
    const staff = new Map([RIYA, NIDHI].map((profile) => [profile.id, profile]));
    const labels = { role: (role: string) => role, source: (source: string) => source };
    const lead = leadRecord({ involvedIds: [RIYA.id] });
    expect(leadContactCardData(lead, staff, labels)).toMatchObject({
      kind: 'lead',
      name: 'Anaya Desai',
      since: lead.createdAt,
      team: [
        { name: 'Nidhi Kapoor', role: 'counsellor' },
        { name: 'Riya Shah', role: 'front_desk' },
      ],
      about: { source: 'whatsapp' },
    });
    expect(
      leadContactCardData(leadRecord({ patientId: 'patient' }), staff, labels),
    ).toMatchObject({ kind: 'patient', since: null });
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
    rerender(<LeadStatusPill lead={{ status: null, kind: 'contact_thread' }} />);
    expect(screen.queryByText('Re-targeted')).toBeNull();
  });

  it('shows the source with its icon in its tone, "Phone call" included', () => {
    render(<LeadSourcePill source="phone_call" />);
    const pill = screen.getByText('Phone call').closest('[data-tone]');
    expect(pill).toHaveAttribute('data-tone', 'sky');
    expect(pill?.querySelector('svg')).not.toBeNull();
  });

  it('shows the first interest and a "+N" naming them all', async () => {
    const { container } = render(
      <TooltipProvider>
        <LeadInterestPills lead={{ interests: ['peel', 'prp'], customInterests: [] }} />
      </TooltipProvider>,
    );
    expect(screen.getByText('Peel')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('1 more: Peel, PRP')).toHaveClass('sr-only');
    expect(await axe(container)).toHaveNoViolations();
  });
});
