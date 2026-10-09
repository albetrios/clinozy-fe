import type { LeadSource } from '@/shared/api/clinic/clinic-schema.ts';
import type { Contact } from '@/shared/api/clinic/contacts-contracts.ts';
import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type {
  ContactCardData,
  ContactReach,
  ContactTeamMember,
} from '@/shared/components/PersonCard/index.ts';

/** What the contact card's words need from the room's vocabulary. */
export interface LeadContactLabels {
  source: (source: LeadSource) => string;
}

/**
 * How to reach a lead's person (KICKOFF §6.0 Contact card › Reach). With the contact read
 * (`GET /app/contacts/:contact_id` — the drawer): every number, the primary first, WhatsApp
 * where they are on it, then every Instagram handle. From the list row alone: the primary
 * number — the row carries no other (route map §4).
 */
export function leadReach(
  lead: Pick<LeadRecord, 'phone'>,
  contact?: Pick<Contact, 'phones' | 'instagramHandles'>,
): ContactReach[] {
  if (!contact) return lead.phone ? [{ channel: 'phone', phone: lead.phone }] : [];
  const primaryFirst = [...contact.phones].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
  );
  return [
    ...primaryFirst.map((entry): ContactReach => ({
      channel: entry.isOnWhatsapp ? 'whatsapp' : 'phone',
      phone: entry.phone,
    })),
    ...contact.instagramHandles.map((handle): ContactReach => ({
      channel: 'instagram',
      handle,
    })),
  ];
}

/**
 * The contact card for a lead's person (the schema's `contactCard`, `S:1566`; D32): a patient's
 * card once a check-in opened their file, else a lead's — "Lead since <created>"; their reach;
 * the owner and the involved people; and "Came via <source>".
 */
export function leadContactCardData(
  lead: LeadRecord,
  team: ReadonlyMap<string, DirectoryMember>,
  labels: LeadContactLabels,
  contact?: Pick<Contact, 'phones' | 'instagramHandles'>,
): ContactCardData {
  const isPatient = lead.patientId !== null;
  const people = [lead.ownerId, ...lead.involvedIds].flatMap(
    (id): ContactTeamMember[] => {
      const member = id ? team.get(id) : undefined;
      return member
        ? [
            {
              id: member.id,
              name: member.name,
              initials: member.initials,
              tone: member.tone,
              role: '',
            },
          ]
        : [];
    },
  );
  return {
    kind: isPatient ? 'patient' : 'lead',
    name: lead.name,
    since: isPatient ? null : lead.createdAt,
    reach: leadReach(lead, contact),
    team: people,
    about: { source: lead.source ? labels.source(lead.source) : null },
  };
}
