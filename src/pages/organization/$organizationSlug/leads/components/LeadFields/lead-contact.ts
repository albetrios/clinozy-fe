import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LeadRecord,
  LeadRecordSource,
} from '@/shared/api/clinic/leads-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import type {
  ContactCardData,
  ContactReach,
  ContactTeamMember,
} from '@/shared/components/PersonCard/index.ts';

import { staffFullName } from './lead-people.ts';

/** What the contact card's words need from the room's vocabulary. */
export interface LeadContactLabels {
  role: (role: Role) => string;
  source: (source: LeadRecordSource) => string;
}

/**
 * How to reach a lead's person (KICKOFF §6.0 Contact card › Reach): every
 * number — the primary first, WhatsApp unless it is marked off — then every
 * Instagram handle. Without the plan's contact fields, the lead's own mobile
 * on WhatsApp.
 */
export function leadReach(lead: Pick<LeadRecord, 'phone' | 'contact'>): ContactReach[] {
  const phones = lead.contact?.phones ?? [{ phone: lead.phone, whatsapp: true }];
  return [
    ...phones.map((entry): ContactReach => ({
      channel: entry.whatsapp ? 'whatsapp' : 'phone',
      phone: entry.phone,
    })),
    ...(lead.contact?.instagram ?? []).map((handle): ContactReach => ({
      channel: 'instagram',
      handle,
    })),
  ];
}

/**
 * The contact card for a lead's person (the schema's `contactCard`, `S:1566`;
 * D32 — the lead is the record it reads): a patient's card once the lead is
 * linked to one, else a lead's — "Lead since <created>"; its reach; the owner
 * and the involved people; and "Came via <source>".
 */
export function leadContactCardData(
  lead: LeadRecord,
  staffById: ReadonlyMap<string, StaffProfile>,
  labels: LeadContactLabels,
): ContactCardData {
  const isPatient = lead.patientId !== null;
  const team = [lead.ownerId, ...lead.involvedIds].flatMap((id): ContactTeamMember[] => {
    const profile = id ? staffById.get(id) : undefined;
    if (!profile) return [];
    const [role] = profile.roles;
    return [
      {
        id: profile.id,
        name: staffFullName(profile),
        initials: profile.initials,
        tone: profile.tone,
        role: role ? labels.role(role) : '',
      },
    ];
  });
  return {
    kind: isPatient ? 'patient' : 'lead',
    name: lead.name,
    since: isPatient ? null : lead.createdAt,
    reach: leadReach(lead),
    team,
    about: { source: lead.source ? labels.source(lead.source) : null },
  };
}
