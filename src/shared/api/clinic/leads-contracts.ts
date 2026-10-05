import { z } from 'zod';

import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from './clinic-list-filters.ts';
import {
  civilDateSchema,
  isoDateTimeSchema,
  LEAD_SOURCE_VALUES,
  leadInterestSchema,
  leadSchema,
  leadStatusSchema,
  phoneSchema,
} from './clinic-schema.ts';

/*
 * The Leads domain beyond the generated contract (KICKOFF §6.3, §3.6, D22): the
 * plan-only fields the screens show — each a fixture field until clinozy-be
 * serves it (Appendix F › Leads and contact threads, REPLACE_WITH_API) — what a
 * client sends to create or update a lead, and the list read's params. Read by
 * the Leads room, the appointment form (connected leads), the contact card and
 * ⌘K. Messages (`LeadMessage`) belong to the chat column's reads.
 */

// ── Records ──

/**
 * The sources a lead may carry: the contract's seven and "Phone call", which
 * the New lead preset sets but the contract lacks (H:6159; Q-L6, AMBER A-L4).
 */
export const LEAD_RECORD_SOURCE_VALUES = [...LEAD_SOURCE_VALUES, 'phone_call'] as const;

/** Zod enum of a lead record's source. */
export const leadRecordSourceSchema = z.enum(LEAD_RECORD_SOURCE_VALUES);

/** One lead record source. */
export type LeadRecordSource = z.infer<typeof leadRecordSourceSchema>;

/** An interest typed into "Add interest" — at most 30 characters (`leads.md:64`). */
const customInterestSchema = z.string().trim().min(1).max(30);

/** One of the person's numbers: E.164, and whether they are on WhatsApp on it. */
const leadContactPhoneSchema = z.object({
  phone: phoneSchema,
  whatsapp: z.boolean(),
});

/** The channels a contact may prefer (`CHS`, H:3362): WhatsApp · Call · SMS · Instagram. */
export const CONTACT_CHANNEL_VALUES = ['whatsapp', 'call', 'sms', 'instagram'] as const;

/** One default channel. */
export type ContactChannel = (typeof CONTACT_CHANNEL_VALUES)[number];

/**
 * The contact editor's fields (`leads.md:92–107`) — not in the contract (C16;
 * Appendix F, REPLACE_WITH_API): every number, the primary first (it is the
 * lead's `phone`), each on WhatsApp or not; the Instagram handles; the
 * default channel; the contact preferences ("No calls", a custom one ≤ 40).
 * Absent on a record nobody has edited — then the lead's own mobile on
 * WhatsApp, no handle, WhatsApp, none.
 */
const leadContactSchema = z.object({
  phones: z.array(leadContactPhoneSchema).min(1).max(5),
  instagram: z.array(z.string().trim().min(1).max(30)).max(5),
  defaultChannel: z.enum(CONTACT_CHANNEL_VALUES),
  preferences: z.array(z.string().trim().min(1).max(40)).max(20),
});

/** A person's contact fields. */
export type LeadContact = z.infer<typeof leadContactSchema>;

/**
 * A lead as the rooms read it: the contract's `Lead` (`S:242–266`) plus the
 * plan's fields (Appendix F, REPLACE_WITH_API).
 */
export const leadRecordSchema = leadSchema.extend({
  source: leadRecordSourceSchema.nullable(),
  /** Interests beyond the contract's six, as typed ("Add interest"; custom interests ≤ 30). */
  customInterests: z.array(customInterestSchema),
  /**
   * The owner's last activity on the lead — created, claimed, assigned, saved
   * by its owner. The hold counts idle days from here (Q-L9; "last touch").
   */
  touchedAt: isoDateTimeSchema,
  /** When the owner let it go ("Release"); a later touch or a claim holds it again. */
  releasedAt: isoDateTimeSchema.nullable(),
  /**
   * Messages the viewer has not read — per viewer on the server ("mark-read
   * and per-viewer unread"); the fixture keeps one viewer's count.
   */
  unreadCount: z.number().int().nonnegative(),
  /** The person's contact fields, once someone has edited them (C16). */
  contact: leadContactSchema.optional(),
});

/** A lead record — the contract's fields and the plan's. */
export type LeadRecord = z.infer<typeof leadRecordSchema>;

/**
 * Who holds a lead and since when — what a claim or an assignment changes,
 * and what its Undo puts back.
 */
export type LeadTeam = Pick<
  LeadRecord,
  'ownerId' | 'involvedIds' | 'touchedAt' | 'releasedAt'
>;

/**
 * The statuses that close a lead (H:3869): with a linked patient, a closed
 * lead never releases to the team and can't be claimed. No response stays
 * open.
 */
export const LEAD_CLOSED_STATUSES = [
  'clinic_visited',
  'not_interested',
  'invalid',
  'lost',
] as const satisfies readonly LeadRecord['status'][];

// ── Writes ──

const PHONE_MESSAGE = 'Add a 10-digit mobile';

/**
 * Every field a client sends for a lead (`createLead` / `updateLead`, `S:1593–1594`)
 * with the contract's ranges, plus the plan's `status` and `patientId` on
 * create and the custom interests (Appendix F). Status and source may be
 * empty only on a contact thread, whose contact edits go through the same
 * write.
 */
export const leadFieldsSchema = leadRecordSchema
  .pick({
    email: true,
    status: true,
    source: true,
    ownerId: true,
    followUpAt: true,
    branchId: true,
    patientId: true,
    contact: true,
  })
  .extend({
    name: z.string().trim().min(1, 'Add a name').max(120),
    phone: z
      .string()
      .refine((value) => phoneSchema.safeParse(value).success, PHONE_MESSAGE),
    email: z.email('Check the email').max(120).nullable(),
    interests: z.array(leadInterestSchema).max(6),
    customInterests: z.array(customInterestSchema).max(6),
    involvedIds: z.array(z.uuid()).max(10),
    notes: z.string().trim().max(2000).nullable(),
  });

/** A lead's or a contact thread's full input — what a create stores and an update re-checks once merged. */
export type LeadFields = z.infer<typeof leadFieldsSchema>;

/** {@link leadFieldsSchema} for a lead of the pipeline: a status and a source always set. */
export const leadInputSchema = leadFieldsSchema.extend({
  status: leadStatusSchema,
  source: leadRecordSourceSchema,
});

/** A lead's full input. */
export type LeadInput = z.infer<typeof leadInputSchema>;

/**
 * A new lead's starting values: New, from WhatsApp (the New lead form's
 * default, `leads.md:82`), no interests, nobody assigned until the form says
 * so (it defaults the owner to the signed-in member), no follow-up.
 */
export const LEAD_DEFAULTS: Readonly<Omit<LeadInput, 'name' | 'phone'>> = {
  email: null,
  status: 'new',
  source: 'whatsapp',
  interests: [],
  customInterests: [],
  ownerId: null,
  involvedIds: [],
  followUpAt: null,
  branchId: null,
  patientId: null,
  notes: null,
};

/** A create: the name and mobile are enough to start; the rest falls back to {@link LEAD_DEFAULTS}. */
export type LeadCreateInput = Pick<LeadInput, 'name' | 'phone'> & Partial<LeadInput>;

/** An update: any of the fields; the server re-checks the merged record. */
export type LeadPatch = Partial<LeadFields>;

// ── New lead's contact search ──

/**
 * One hit of New lead's contact search (KICKOFF §6.3, the plan's "contact
 * search" — Appendix F, REPLACE_WITH_API): a patient ("Patient #3508 · last
 * visit 24 Sep", "Re-create lead") or a person known only as a lead or a chat
 * ("Lead #2365 · +91 98250 11241", "Use contact") with their contact fields.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const leadContactHitSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('patient'),
    id: z.uuid(),
    seq: z.number().int().nonnegative(),
    name: z.string(),
    phone: phoneSchema,
    /** The last completed or checked-in visit; null before the first. */
    lastVisit: civilDateSchema.nullable(),
  }),
  z.object({
    kind: z.literal('lead'),
    id: z.uuid(),
    seq: z.number().int().nonnegative(),
    name: z.string(),
    phone: phoneSchema,
    /** A chat-only person (`kind = contact_thread`), not a lead of the pipeline. */
    contactThread: z.boolean(),
    contact: leadContactSchema.optional(),
  }),
]);

/** One contact search hit. */
export type LeadContactHit = z.infer<typeof leadContactHitSchema>;

// ── List reads ──

/** The list's views (`view`; the plan's, a backend request): mine, mine with unread messages, everyone's. */
export const LEAD_VIEW_VALUES = ['mine', 'unread', 'all'] as const;

/** One list view. */
export type LeadView = (typeof LEAD_VIEW_VALUES)[number];

/**
 * The Ownership filter (`hold`): open to claim, releasing to the team today,
 * still held by its owner (releasing today included). "Any" is no filter.
 */
export const LEAD_HOLD_FILTER_VALUES = ['open', 'soon', 'held'] as const;

/** One Ownership filter value. */
export type LeadHoldFilter = (typeof LEAD_HOLD_FILTER_VALUES)[number];

/**
 * The sortable columns: Lead (A–Z), Status (pipeline order), Source and
 * Updated (`leads.md:34`). Without one the list runs newest first.
 */
export const LEAD_SORT_KEYS = ['name', 'status', 'source', 'updated'] as const;

/** One sortable column. */
export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];

/**
 * `listLeads`' params (`S:1588`) and the plan's (`view`, `hold`, owner as
 * assigned **or** involved, the `updated` sort — backend requests). The
 * contract takes several statuses; the design filters on one. Contact threads
 * never appear (`S:261`).
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const leadListParamsSchema = z.object({
  view: z.enum(LEAD_VIEW_VALUES).optional(),
  /**
   * The viewer's staff id for the views that mean "me". REPLACE_WITH_API: the
   * server reads the session instead.
   */
  viewerId: z.uuid().nullable().optional(),
  q: z.string().max(80).optional(),
  status: z.array(leadStatusSchema).optional(),
  source: z.array(leadRecordSourceSchema).optional(),
  hold: z.enum(LEAD_HOLD_FILTER_VALUES).optional(),
  /** Team: the lead's owner or one of its involved people is any of these. */
  owner: z.array(z.uuid()).optional(),
  created: z
    .custom<CreatedFilter>((value) => readCreatedFilter(value) !== undefined)
    .optional(),
  followUp: z
    .custom<FollowUpFilter>((value) => readFollowUpFilter(value) !== undefined)
    .optional(),
  sort: z.enum(LEAD_SORT_KEYS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/** Params of the leads list read. */
export type LeadListParams = z.infer<typeof leadListParamsSchema>;
