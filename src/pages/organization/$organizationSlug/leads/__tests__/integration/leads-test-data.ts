import { vi } from 'vitest';

import { appInstant } from '@/shared/api/app/app-time.ts';
import type { Contact, ContactFields } from '@/shared/api/app/contacts-contracts.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type {
  LeadFields,
  LeadListParams,
  LeadRecord,
} from '@/shared/api/app/leads-contracts.ts';
import { leadHold } from '@/shared/api/app/leads-hold.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { EMPTY_CONTACT_PROFILE } from '@/tests/utils/contact-doubles.ts';

/** 10:00 on 3 Oct 2026, clinic time — every Leads test's "now". */
export const NOW = new Date(appInstant('2026-10-03', '10:00'));

/** An instant `days` before {@link NOW}. */
export const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

/** An instant `days` after {@link NOW}. */
export const daysAhead = (days: number) => daysAgo(-days);

/** A member of the team as `GET /app/memberships` answers — Riya Shah unless told otherwise. */
export function teamMember(overrides: Partial<DirectoryMember> = {}): DirectoryMember {
  return {
    id: 'mem_riya00000000000000000',
    userId: 'usr_riya00000000000000000',
    name: 'Riya Shah',
    initials: 'RS',
    tone: 'blush',
    roleIds: [],
    branchIds: [],
    ...overrides,
  };
}

/** Riya Shah — "me" in the Leads tests. */
export const RIYA = teamMember();

/** Nidhi Kapoor. */
export const NIDHI = teamMember({
  id: 'mem_nidhi0000000000000000',
  userId: 'usr_nidhi0000000000000000',
  name: 'Nidhi Kapoor',
  initials: 'NK',
  tone: 'sage',
});

/** The team the Leads tests read. */
export const TEAM: readonly DirectoryMember[] = [RIYA, NIDHI];

/** The team by membership id. */
export const TEAM_BY_ID: ReadonlyMap<string, DirectoryMember> = new Map(
  TEAM.map((entry) => [entry.id, entry]),
);

/** A pipeline lead: New, WhatsApp, Clinical, Nidhi's and held for two more days. */
export function leadRecord(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead_anaya0000000000000000',
    leadNumber: 2363,
    contactId: 'con_anaya0000000000000000',
    person: {
      contactNumber: 10234,
      firstName: 'Anaya',
      lastName: 'Desai',
      name: 'Anaya Desai',
      primaryPhone: '+919879521034',
      defaultChannel: 'whatsapp',
    },
    name: 'Anaya Desai',
    phone: '+919879521034',
    patientId: null,
    status: 'new',
    source: 'whatsapp',
    interests: ['clinical'],
    kind: 'enquiry',
    retargetReason: null,
    ownerId: NIDHI.id,
    involvedIds: [],
    heldUntil: daysAhead(2),
    followUpAt: null,
    branchId: null,
    notes: null,
    lastActivityAt: daysAgo(1),
    isAwaitingReply: false,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

/** The lead's person as `GET /app/contacts/:contact_id` answers. */
export function contactRecord(overrides: Partial<Contact> = {}): Contact {
  return {
    ...EMPTY_CONTACT_PROFILE,
    id: 'con_anaya0000000000000000',
    contactNumber: 10234,
    firstName: 'Anaya',
    lastName: 'Desai',
    name: 'Anaya Desai',
    primaryPhone: '+919879521034',
    email: null,
    instagramHandles: [],
    defaultChannel: 'whatsapp',
    preferenceTags: [],
    patientId: null,
    openLeadId: 'lead_anaya0000000000000000',
    lastActivityAt: daysAgo(1),
    lastReceivedAt: null,
    isAwaitingReply: false,
    updatedAt: daysAgo(1),
    phones: [{ phone: '+919879521034', isPrimary: true, isOnWhatsapp: true }],
    ...overrides,
  };
}

/** Kabir Mehta — a second lead: Contacted, Instagram, Riya's, awaiting her reply. */
export const KABIR = leadRecord({
  id: 'lead_kabir0000000000000000',
  leadNumber: 2364,
  contactId: 'con_kabir0000000000000000',
  person: {
    contactNumber: 10235,
    firstName: 'Kabir',
    lastName: 'Mehta',
    name: 'Kabir Mehta',
    primaryPhone: '+919825044120',
    defaultChannel: 'instagram',
  },
  name: 'Kabir Mehta',
  phone: '+919825044120',
  status: 'contacted',
  source: 'instagram',
  interests: ['peel'],
  ownerId: RIYA.id,
  isAwaitingReply: true,
  lastActivityAt: daysAgo(2),
  createdAt: daysAgo(5),
  updatedAt: daysAgo(2),
});

/**
 * The clinozy-be a Leads test runs against: the leads `GET /app/leads` lists (newest first),
 * the ones removed, the viewer's membership and the lead's open tasks. Hoist it
 * (`vi.hoisted`) and hand it to the doubles below.
 */
export interface LeadsWorld {
  leads: LeadRecord[];
  removed: LeadRecord[];
  /** The viewer's membership id — `null` for a caller off the team. */
  viewerId: string | null;
  openTasks: number;
}

/** A fresh world: Anaya (Nidhi's) and Kabir (Riya's), Riya viewing. */
export function seededLeadsWorld(): LeadsWorld {
  return {
    leads: [leadRecord(), KABIR],
    removed: [],
    viewerId: RIYA.id,
    openTasks: 1,
  };
}

/** Whether a lead is in the view: the viewer's own for Mine, and awaiting a reply for Unreplied. */
function inView(lead: LeadRecord, params: LeadListParams): boolean {
  if (params.view === 'all') return true;
  if (lead.ownerId !== params.viewerId) return false;
  return params.view === 'mine' || lead.isAwaitingReply;
}

/** Whether a lead passes the search and the Status, Source and Team filters. */
function inFilters(lead: LeadRecord, params: LeadListParams): boolean {
  const q = params.q?.toLowerCase();
  const { member, source, status } = params;
  const matchesQuery = !q || lead.name.toLowerCase().includes(q);
  const matchesStatus = !status || lead.status === status;
  const matchesSource =
    !source?.length || (lead.source !== null && source.includes(lead.source));
  const matchesMember =
    !member || lead.ownerId === member || lead.involvedIds.includes(member);
  return matchesQuery && matchesStatus && matchesSource && matchesMember;
}

/** Whether a lead's hold matches the Ownership filter at `now`. */
function inHold(lead: LeadRecord, params: LeadListParams, now: Date): boolean {
  const hold = leadHold(lead, now);
  if (params.hold === 'open') return hold.open;
  if (params.hold === 'soon') return hold.releasesToday;
  if (params.hold === 'held') return hold.releasesAt !== null;
  return true;
}

/** Whether a lead is in the list read for `params` — the server's own filters, as far as the tests need. */
function listed(lead: LeadRecord, params: LeadListParams, now: Date): boolean {
  return inView(lead, params) && inFilters(lead, params) && inHold(lead, params, now);
}

/** The list's order for a sort: by name or by the person's last activity; else as stored. */
function sorted(rows: LeadRecord[], params: LeadListParams): LeadRecord[] {
  const direction = params.order === 'desc' ? -1 : 1;
  if (params.sort === 'name') {
    return [...rows].sort((a, b) => direction * a.name.localeCompare(b.name));
  }
  if (params.sort === 'activity') {
    return [...rows].sort(
      (a, b) =>
        direction * (a.lastActivityAt ?? '').localeCompare(b.lastActivityAt ?? ''),
    );
  }
  return rows;
}

/**
 * `@/shared/api/app/leads-api.ts` over a {@link LeadsWorld} — every read answers from it and
 * every write changes it, so a later read shows the write. An unknown id is a 404.
 */
export function leadsApiDouble(world: LeadsWorld) {
  const find = (leadId: string) => {
    const lead = world.leads.find((entry) => entry.id === leadId);
    if (!lead) throw new HttpError('Not found', 404, `/app/leads/${leadId}`, 'GET');
    return lead;
  };
  const change = (leadId: string, patch: Partial<LeadRecord>): LeadRecord => {
    const next = { ...find(leadId), ...patch, updatedAt: new Date().toISOString() };
    world.leads = world.leads.map((entry) => (entry.id === leadId ? next : entry));
    return structuredClone(next);
  };
  return {
    listLeads: vi.fn(async (params: LeadListParams, _after?: string) => {
      const rows = sorted(
        world.leads.filter((lead) => listed(lead, params, new Date())),
        params,
      );
      return { rows: structuredClone(rows), next: null, total: rows.length };
    }),
    fetchLead: vi.fn(async (leadId: string) => structuredClone(find(leadId))),
    countUnrepliedLeads: vi.fn(
      async (viewerId: string | null) =>
        world.leads.filter((lead) => lead.ownerId === viewerId && lead.isAwaitingReply)
          .length,
    ),
    countOpenLeadTasks: vi.fn(async (_leadId: string) => world.openTasks),
    updateLead: vi.fn(
      async ({
        leadId,
        fields,
      }: {
        leadId: string;
        fields: Partial<LeadFields>;
        expectedUpdatedAt?: string;
        idempotencyKey: string;
      }) => change(leadId, fields),
    ),
    claimLead: vi.fn(async (leadId: string, _idempotencyKey: string) => {
      const lead = find(leadId);
      return change(leadId, {
        ownerId: world.viewerId,
        involvedIds: lead.ownerId
          ? [...lead.involvedIds, lead.ownerId]
          : lead.involvedIds,
        heldUntil: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      });
    }),
    releaseLead: vi.fn(async (leadId: string, _idempotencyKey: string) =>
      change(leadId, { heldUntil: null }),
    ),
    deleteLead: vi.fn(
      async ({ leadId }: { leadId: string; reason: string; note: string | null }) => {
        world.removed.push(find(leadId));
        world.leads = world.leads.filter((entry) => entry.id !== leadId);
      },
    ),
    restoreLead: vi.fn(async (leadId: string, _idempotencyKey: string) => {
      const lead = world.removed.find((entry) => entry.id === leadId);
      if (!lead) throw new HttpError('Not found', 404, `/app/leads/${leadId}`, 'POST');
      world.removed = world.removed.filter((entry) => entry.id !== leadId);
      world.leads = [lead, ...world.leads];
      return structuredClone(lead);
    }),
  };
}

/** `@/shared/api/app/directory-api.ts`'s team reads over {@link TEAM}. */
export function directoryApiDouble() {
  return {
    fetchTeamDirectory: vi.fn(async () => structuredClone([...TEAM])),
    fetchMemberNames: vi.fn(
      async (ids: readonly string[]): Promise<ReadonlyMap<string, string>> =>
        new Map(
          ids.flatMap((id) => {
            const entry = TEAM_BY_ID.get(id);
            return entry ? [[id, entry.name] as const] : [];
          }),
        ),
    ),
  };
}

/** The people `GET /app/contacts/:contact_id` answers for — Anaya unless a test adds more. */
export interface ContactsWorld {
  contacts: Contact[];
}

/** `@/shared/api/app/contacts-api.ts` over a {@link ContactsWorld}: a save changes the person. */
export function contactsApiDouble(world: ContactsWorld) {
  const find = (contactId: string) => {
    const contact = world.contacts.find((entry) => entry.id === contactId);
    if (!contact) {
      throw new HttpError('Not found', 404, `/app/contacts/${contactId}`, 'GET');
    }
    return contact;
  };
  return {
    fetchContact: vi.fn(async (contactId: string) => structuredClone(find(contactId))),
    searchContacts: vi.fn(async (_typed: string) => []),
    updateContact: vi.fn(
      async ({
        contactId,
        fields,
      }: {
        contactId: string;
        fields: ContactFields;
        expectedUpdatedAt: string;
        idempotencyKey: string;
      }) => {
        const [primary] = fields.phones;
        const next: Contact = {
          ...find(contactId),
          firstName: fields.firstName,
          lastName: fields.lastName,
          name: [fields.firstName, fields.lastName].filter(Boolean).join(' '),
          primaryPhone: primary?.phone ?? '',
          phones: fields.phones.map((entry, index) => ({
            ...entry,
            isPrimary: index === 0,
          })),
          instagramHandles: fields.instagramHandles,
          defaultChannel: fields.defaultChannel,
          preferenceTags: fields.preferenceTags,
          updatedAt: new Date().toISOString(),
        };
        world.contacts = world.contacts.map((entry) =>
          entry.id === contactId ? next : entry,
        );
        return structuredClone(next);
      },
    ),
  };
}

/** `@/shared/api/app/contact-activities-api.ts` — the lead drawer's chat: a quiet stream. */
export function contactActivitiesApiDouble() {
  return {
    fetchContactThread: vi.fn(async (_contactId: string) => ({
      thread: null,
      messages: [],
      authors: {},
    })),
    sendContactActivity: vi.fn(),
    resendContactActivity: vi.fn(),
    fetchContactMessagingStatus: vi.fn(async () => ({
      whatsappDown: false,
      isConnected: false,
    })),
    fetchContactTemplateValues: vi.fn(async () => ({
      clinicName: 'Cresence',
      address: '',
      mapsLink: '',
      reviewLink: '',
      freeSlots: [],
    })),
  };
}
