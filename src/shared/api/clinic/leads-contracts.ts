import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import type { CreatedFilter, FollowUpFilter } from './clinic-list-filters.ts';
import {
  type LeadInterest,
  leadInterestSchema,
  type LeadSource,
  leadSourceSchema,
  type LeadStatus,
  leadStatusSchema,
} from './clinic-schema.ts';
import {
  CONTACT_CHANNELS,
  type ContactChannel,
  contactNameOf,
} from './contacts-contracts.ts';

/*
 * The Leads domain on clinozy-be (KICKOFF §6.3; api-integration §5.2): a lead points at its
 * contact (`contact_id`, the list row's `contact` summary), carries its status, source,
 * interests, owner, involved team, hold (`held_until`), follow-up, branch and notes, and reads
 * the contact's activity time and reply state. The design's custom interests, "Phone call"
 * source, per-member unread counts, contact threads and Convert went with the backend (route
 * map §4 #4–#6, G2).
 */

// ── Records ──

/** A lead's kind: a new enquiry, or a re-target of someone already known. */
const LEAD_KINDS = ['enquiry', 'retarget'] as const;
/** One lead kind. */
type LeadKind = (typeof LEAD_KINDS)[number];

/** The lead's person, as its row carries them. */
interface LeadPerson {
  contactNumber: number;
  firstName: string;
  lastName: string | null;
  /** "Riya Shah". */
  name: string;
  primaryPhone: string;
  defaultChannel: ContactChannel;
}

/** A lead as every Leads view reads it. */
export interface LeadRecord {
  /** The lead's id. */
  id: string;
  /** "#2371". */
  leadNumber: number;
  contactId: string;
  /** The person — null only if the contact is gone. */
  person: LeadPerson | null;
  /** The person's name — "" if the contact is gone. */
  name: string;
  /** Their primary number, E.164. */
  phone: string | null;
  /** The patient file a check-in opened for them. */
  patientId: string | null;
  status: LeadStatus;
  source: LeadSource | null;
  interests: LeadInterest[];
  kind: LeadKind;
  retargetReason: string | null;
  /** The owner's membership id. */
  ownerId: string | null;
  involvedIds: string[];
  /** Until when the owner holds it; past it, anyone may claim it. */
  heldUntil: string | null;
  followUpAt: string | null;
  branchId: string | null;
  notes: string | null;
  /** The person's latest activity on any record. */
  lastActivityAt: string | null;
  /** Their last message is newer than ours — the name shows bold. */
  isAwaitingReply: boolean;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/**
 * The statuses that close a lead (H:3869): a closed lead is not claimed or held. No response
 * stays open; Clinic visited is set only by a check-in.
 */
export const LEAD_CLOSED_STATUSES = [
  'clinic_visited',
  'not_interested',
  'invalid',
  'lost',
] as const satisfies readonly LeadStatus[];

// ── The wire ──

type ApiLeadRow = NonNullable<ApiData<'/app/leads', 'get'>>[number];
type ApiLead = NonNullable<ApiData<'/app/leads/{lead_id}', 'get'>>;
/** A new lead as `POST /app/leads` takes it. */
export type ApiLeadCreate = NonNullable<ApiBody<'/app/leads', 'post'>>;
/** A lead change as `PATCH /app/leads/:lead_id` takes it. */
export type ApiLeadChange = NonNullable<ApiBody<'/app/leads/{lead_id}', 'patch'>>;

const leadFieldsWire = {
  id: z.string(),
  lead_number: z.number().int(),
  contact_id: z.string(),
  contact: z
    .object({
      contact_number: z.number().int(),
      first_name: z.string(),
      last_name: z.string().nullable(),
      primary_phone: z.string(),
      default_channel: z.enum(CONTACT_CHANNELS),
    })
    .nullable(),
  patient_id: z.string().nullable(),
  status: leadStatusSchema,
  source: leadSourceSchema.nullable(),
  interests: z.array(leadInterestSchema),
  kind: z.enum(LEAD_KINDS),
  retarget_reason: z.string().nullable(),
  owner_membership_id: z.string().nullable(),
  involved_membership_ids: z.array(z.string()),
  held_until: z.string().nullable(),
  follow_up_at: z.string().nullable(),
  branch_id: z.string().nullable(),
  notes: z.string().nullable(),
  last_activity_at: z.string().nullable(),
  is_awaiting_reply: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** A lead list row (`GET /app/leads`). */
export const leadRowWire = wireSchema<ApiLeadRow>()(z.object(leadFieldsWire));

/** One lead (`GET /app/leads/:lead_id`, and every write's answer). */
export const leadWire = wireSchema<ApiLead>()(z.object(leadFieldsWire));

/** A lead as the API sends it. */
export type LeadWire = z.output<typeof leadRowWire>;

/** A lead as the rooms read it. */
export function toLeadRecord(row: LeadWire): LeadRecord {
  const person = row.contact
    ? {
        contactNumber: row.contact.contact_number,
        firstName: row.contact.first_name,
        lastName: row.contact.last_name,
        name: contactNameOf(row.contact),
        primaryPhone: row.contact.primary_phone,
        defaultChannel: row.contact.default_channel,
      }
    : null;
  return {
    id: row.id,
    leadNumber: row.lead_number,
    contactId: row.contact_id,
    person,
    name: person?.name ?? '',
    phone: person?.primaryPhone ?? null,
    patientId: row.patient_id,
    status: row.status,
    source: row.source,
    interests: row.interests,
    kind: row.kind,
    retargetReason: row.retarget_reason,
    ownerId: row.owner_membership_id,
    involvedIds: row.involved_membership_ids,
    heldUntil: row.held_until,
    followUpAt: row.follow_up_at,
    branchId: row.branch_id,
    notes: row.notes,
    lastActivityAt: row.last_activity_at,
    isAwaitingReply: row.is_awaiting_reply,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Writes ──

/** The lead's own fields a member edits (the person's are the contact's). */
export interface LeadFields {
  status: LeadStatus;
  source: LeadSource | null;
  interests: LeadInterest[];
  ownerId: string | null;
  involvedIds: string[];
  followUpAt: string | null;
  branchId: string | null;
  notes: string | null;
}

/** The fields as the API names them. */
export function leadBodyOf(fields: Partial<LeadFields>): ApiLeadChange {
  const body: ApiLeadChange = {};
  if (fields.status !== undefined) body.status = fields.status;
  if (fields.source !== undefined) body.source = fields.source;
  if (fields.interests !== undefined) body.interests = fields.interests;
  if (fields.ownerId !== undefined) body.owner_membership_id = fields.ownerId;
  if (fields.involvedIds !== undefined) body.involved_membership_ids = fields.involvedIds;
  if (fields.followUpAt !== undefined) body.follow_up_at = fields.followUpAt;
  if (fields.branchId !== undefined) body.branch_id = fields.branchId;
  if (fields.notes !== undefined) body.notes = fields.notes;
  return body;
}

// ── List reads ──

/** The list's views: mine, mine awaiting my reply ("Unreplied"), everyone's. */
export const LEAD_VIEW_VALUES = ['mine', 'unreplied', 'all'] as const;
/** One list view. */
export type LeadView = (typeof LEAD_VIEW_VALUES)[number];

/** The Ownership filter: open to claim, releasing to the team today, held. "Any" is no filter. */
export const LEAD_HOLD_FILTER_VALUES = ['open', 'soon', 'held'] as const;
/** One Ownership filter value. */
export type LeadHoldFilter = (typeof LEAD_HOLD_FILTER_VALUES)[number];

/**
 * The sortable columns: Lead (A–Z), Status, Source and Last activity — the design's "Updated"
 * sorts by the person's latest activity (G2). Without one the list runs newest first.
 */
export const LEAD_SORT_KEYS = ['name', 'status', 'source', 'activity'] as const;
/** One sortable column. */
export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];

/** The leads list read's params, as the URL and the viewer give them. */
export interface LeadListParams {
  view: LeadView;
  /** The viewer's membership id, for Mine and Unreplied. */
  viewerId: string | null;
  q?: string;
  status?: LeadStatus;
  source?: LeadSource[];
  hold?: LeadHoldFilter;
  /** Team: one member, matched as owner or involved (the API takes one, M14). */
  member?: string;
  created?: CreatedFilter;
  followUp?: FollowUpFilter;
  sort?: LeadSortKey;
  order?: 'asc' | 'desc';
}
