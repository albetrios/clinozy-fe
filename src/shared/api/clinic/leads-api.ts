import { createdFilterMatches, followUpFilterMatches } from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CursorPage,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import {
  type DeleteReason,
  LEAD_INTEREST_VALUES,
  LEAD_STATUS_VALUES,
} from './clinic-schema.ts';
import { clinicToday } from './clinic-time.ts';
import {
  LEAD_DEFAULTS,
  type LeadCreateInput,
  type LeadFields,
  leadFieldsSchema,
  leadInputSchema,
  type LeadListParams,
  type LeadPatch,
  type LeadRecord,
  type LeadSortKey,
  type LeadTeam,
} from './leads-contracts.ts';
import {
  holdFilterMatches,
  isLeadClosed,
  LEAD_HOLD_DAYS,
  type LeadHold,
  leadHold,
} from './leads-hold.ts';
import { fetchMyStaffProfile } from './users-api.ts';
import type { StaffProfile } from './users-contracts.ts';

/*
 * The Leads domain's reads and writes (`S:1584–1597`), on the fixture world
 * until clinozy-be serves them — every call is REPLACE_WITH_API (D6). The world
 * is imported on demand, so its seed data never lands in a route chunk.
 * Contact threads (`kind = contact_thread`) are leads in the contract but never
 * in the pipeline: no list, count, claim or drawer shows one (`S:261`). Their
 * messages are the chat column's reads.
 */

/** TanStack Query keys for the leads. */
export const leadQueryKeys = {
  all: ['clinic', 'leads'] as const,
  /** The signed-in member as the Leads room reads them, by sign-in email. */
  viewer: (email: string | null) => [...leadQueryKeys.all, 'viewer', email] as const,
  /** Every list variant — a write invalidates them all. */
  lists: () => [...leadQueryKeys.all, 'list'] as const,
  list: (params: LeadListParams) => [...leadQueryKeys.lists(), params] as const,
  detail: (id: string) => [...leadQueryKeys.all, 'detail', id] as const,
  /** Every viewer's Unreplied count — a read receipt refreshes them. */
  unrepliedCounts: () => [...leadQueryKeys.all, 'unreplied'] as const,
  /** The Unreplied tab's count chip. */
  unreplied: (viewerId: string | null) =>
    [...leadQueryKeys.unrepliedCounts(), viewerId] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

const NOT_FOUND = 'Lead not found';
const NOT_ON_TEAM = 'Pick someone on the team';

const nowIso = () => new Date().toISOString();

/** A live lead of the pipeline — a 404 for a contact thread, which is no lead. */
async function pipelineLead(id: string): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const lead = await clinicFixtures.leads.get(id);
  if (lead.isContactThread) throw clinicHttpError(404, 'not_found', NOT_FOUND);
  return lead;
}

/** Whose leads have no one holding them: owners who have left the clinic, or none. */
async function ownerGoneTest(): Promise<(ownerId: string | null) => boolean> {
  const { clinicFixtures } = await fixtureWorld();
  const active = new Set(
    clinicFixtures.staff.snapshot((staff) => staff.active).map((staff) => staff.id),
  );
  return (ownerId) => ownerId === null || !active.has(ownerId);
}

// ── Search and order (the fixture server's) ──

const squeeze = (text: string) => text.toLowerCase().replace(/[\s#]/g, '');

/** Whether a lead matches a search: its name, mobile or "#2363", spaces and "#" ignored (H:5630, Q-A12). */
function leadMatchesSearch(lead: LeadRecord, query: string): boolean {
  const needle = squeeze(query);
  if (!needle) return true;
  return [lead.name, lead.phone, String(lead.seq)].some((field) =>
    squeeze(field).includes(needle),
  );
}

const pipelineRank = (lead: LeadRecord) =>
  lead.status === null
    ? LEAD_STATUS_VALUES.length
    : LEAD_STATUS_VALUES.indexOf(lead.status);

/** The sortable columns, and creation (the contract's default order). */
const LEAD_ORDER = {
  name: (a, b) => a.name.localeCompare(b.name),
  status: (a, b) => pipelineRank(a) - pipelineRank(b),
  source: (a, b) => compareText(a.source ?? '', b.source ?? ''),
  updated: (a, b) => compareText(a.updatedAt, b.updatedAt),
  created: (a, b) => compareText(a.createdAt, b.createdAt),
} satisfies Record<LeadSortKey | 'created', (a: LeadRecord, b: LeadRecord) => number>;

/** The views: mine, mine with unread messages, everyone's — "mine" needs a viewer. */
function inView(lead: LeadRecord, params: LeadListParams): boolean {
  if (!params.view || params.view === 'all') return true;
  if (!params.viewerId || lead.ownerId !== params.viewerId) return false;
  return params.view === 'mine' || lead.unreadCount > 0;
}

/** No filter, or the lead's value is one of those picked. */
const pickedOrAny = <T extends string>(
  picked: readonly T[] | undefined,
  value: T | null,
) => !picked?.length || (value !== null && picked.includes(value));

/** Team: no filter, or the owner or one of the involved people is any of `owners` (H:5636). */
const onTeam = (lead: LeadRecord, owners: readonly string[] | undefined) =>
  !owners?.length ||
  owners.some((id) => lead.ownerId === id || lead.involvedIds.includes(id));

/** What the filters read beyond the lead: the clinic's today and each lead's hold. */
interface FilterContext {
  today: string;
  holdOf: (lead: LeadRecord) => LeadHold;
}

/** Whether a lead passes the status, source, team, ownership, created and follow-up filters. */
function passesFilters(lead: LeadRecord, params: LeadListParams, context: FilterContext) {
  const { hold, created, followUp } = params;
  return (
    pickedOrAny(params.status, lead.status) &&
    pickedOrAny(params.source, lead.source) &&
    onTeam(lead, params.owner) &&
    (!hold || holdFilterMatches(context.holdOf(lead), hold)) &&
    (!created || createdFilterMatches(lead.createdAt, created, context.today)) &&
    (!followUp || followUpFilterMatches(lead.followUpAt, followUp, context.today))
  );
}

/** The order a read asks for: a column, ascending unless `order` says so; else newest first. */
function listOrder(params: LeadListParams): (a: LeadRecord, b: LeadRecord) => number {
  const key = params.sort ?? 'created';
  const defaultOrder = params.sort ? 'asc' : 'desc';
  const direction = (params.order ?? defaultOrder) === 'desc' ? -1 : 1;
  return (a, b) => direction * LEAD_ORDER[key](a, b) || b.seq - a.seq;
}

// ── Reads ──

/**
 * One cursor page of the pipeline (`listLeads`, `S:1588`; REPLACE_WITH_API):
 * the view, then status, source, ownership, team, created and follow-up
 * filters and `q`; newest first unless a column sort is asked for (ascending
 * unless `order` says so). Contact threads never appear.
 */
export async function listLeads(
  params: LeadListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<LeadRecord>> {
  const { clinicFixtures } = await fixtureWorld();
  const now = new Date();
  const ownerGone = await ownerGoneTest();
  const context: FilterContext = {
    today: clinicToday(now),
    holdOf: (lead) =>
      leadHold({ ...lead, ownerGone: ownerGone(lead.ownerId) }, LEAD_HOLD_DAYS, now),
  };
  return clinicFixtures.leads.list({
    where: (lead) =>
      !lead.isContactThread &&
      inView(lead, params) &&
      passesFilters(lead, params, context) &&
      leadMatchesSearch(lead, params.q ?? ''),
    sort: listOrder(params),
    cursor,
  });
}

/**
 * One lead (`getLead`, `S:1589`; REPLACE_WITH_API) — a 404 when it is unknown,
 * deleted, or a contact thread. Its messages are the chat column's read.
 */
export function fetchLead(id: string): Promise<LeadRecord> {
  return pipelineLead(id);
}

/**
 * The signed-in member as the Leads room reads them — whose leads "Mine" and
 * "Unreplied" list, who claims, releases and assigns (REPLACE_WITH_API: the
 * server knows the member from the token). Their staff profile by sign-in
 * email (`fetchMyStaffProfile`); else the fixture server's own member, so the
 * room and the fixture server — which sends, claims and moves leads as that
 * member — agree on "me". Null only when the clinic has neither.
 */
export async function fetchLeadViewer(
  email: string | null,
): Promise<StaffProfile | null> {
  const mine = await fetchMyStaffProfile(email);
  if (mine) return mine;
  const [{ clinicFixtures }, { FIXTURE_VIEWER_ID }] = await Promise.all([
    fixtureWorld(),
    import('./fixtures/staff.fixtures.ts'),
  ]);
  return (
    clinicFixtures.staff.snapshot((profile) => profile.id === FIXTURE_VIEWER_ID)[0] ??
    null
  );
}

/**
 * The Unreplied tab's count chip: the viewer's leads with unread messages (a
 * backend request — the contract has no totals, C31).
 */
export async function countUnrepliedLeads(viewerId: string | null): Promise<number> {
  if (!viewerId) return 0;
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.leads.snapshot(
    (lead) => !lead.isContactThread && lead.ownerId === viewerId && lead.unreadCount > 0,
  ).length;
}

/**
 * The lead still in the pipeline for a mobile — what a create's 409 points
 * "Open" at (`S:1593`, Q-P7). A closed lead for the same person does not
 * count: a patient can come back as a new lead.
 */
export async function findOpenLeadByPhone(
  phone: string,
  exceptId: string | null = null,
): Promise<LeadRecord | null> {
  const { clinicFixtures } = await fixtureWorld();
  const [match] = clinicFixtures.leads.snapshot(
    (lead) =>
      lead.id !== exceptId &&
      !lead.isContactThread &&
      lead.phone === phone &&
      !isLeadClosed({ status: lead.status, patientId: null }),
  );
  return match ?? null;
}

// ── Writes ──

const INTEREST_VALUES = new Set<string>(LEAD_INTEREST_VALUES);

/**
 * The lead's mobile and its contact's first number are one number: a contact
 * that comes in (`patched`) sets the mobile; a mobile that comes in alone
 * moves the contact's first number with it.
 */
function primaryPhoneAgreed<T extends LeadFields>(
  fields: T,
  patched: { contact?: unknown },
): T {
  const { contact } = fields;
  const [first, ...rest] = contact?.phones ?? [];
  if (!(contact && first)) return fields;
  if (patched.contact !== undefined) return { ...fields, phone: first.phone };
  return {
    ...fields,
    contact: { ...contact, phones: [{ ...first, phone: fields.phone }, ...rest] },
  };
}

/**
 * The plan's save rules: interests once each; custom interests trimmed and
 * once each ignoring case, never one of the six chips again (`leads.md:64`);
 * the owner never also involved; blank notes as none; the mobile and the
 * contact's first number one number ({@link primaryPhoneAgreed}).
 */
function leadDraft<T extends LeadFields>(draft: T, patched: { contact?: unknown }): T {
  const fields = primaryPhoneAgreed(draft, patched);
  const seen = new Set<string>();
  const customInterests = fields.customInterests
    .map((interest) => interest.trim())
    .filter((interest) => {
      const key = interest.toLowerCase();
      if (!key || INTEREST_VALUES.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    ...fields,
    interests: [...new Set(fields.interests)],
    customInterests,
    involvedIds: [...new Set(fields.involvedIds)].filter((id) => id !== fields.ownerId),
    notes: fields.notes?.trim() || null,
  };
}

/** `involvedIds` once `ownerId` takes over from `previousOwnerId`, who stays involved. */
function involvedAfterHandover(
  involvedIds: readonly string[],
  previousOwnerId: string | null,
  ownerId: string | null,
): string[] {
  const kept = involvedIds.filter((id) => id !== ownerId);
  return previousOwnerId && previousOwnerId !== ownerId && !kept.includes(previousOwnerId)
    ? [...kept, previousOwnerId]
    : kept;
}

/**
 * Refuse what the contract's server refuses: a mobile already on an open lead
 * (409, `S:1593`) and people, branches or patients the clinic doesn't have
 * (422).
 */
async function checkLead(
  fields: LeadFields,
  { exceptId, phoneChanged }: { exceptId: string | null; phoneChanged: boolean },
) {
  const { clinicFixtures } = await fixtureWorld();
  if (phoneChanged && (await findOpenLeadByPhone(fields.phone, exceptId))) {
    const message = 'This number is already a lead';
    throw clinicHttpError(409, 'conflict', message, { phone: [message] });
  }
  const staff = clinicFixtures.staff.snapshot();
  refuseUnknownIds('ownerId', fields.ownerId ? [fields.ownerId] : [], staff, NOT_ON_TEAM);
  refuseUnknownIds('involvedIds', fields.involvedIds, staff, NOT_ON_TEAM);
  refuseUnknownIds(
    'branchId',
    fields.branchId ? [fields.branchId] : [],
    clinicFixtures.branches.snapshot(),
    'Pick a branch the clinic has',
  );
  refuseUnknownIds(
    'patientId',
    fields.patientId ? [fields.patientId] : [],
    clinicFixtures.patients.snapshot(),
    'Pick a patient the clinic has',
  );
}

/**
 * Create a lead (`createLead`, `S:1593`; REPLACE_WITH_API) from a name and a
 * mobile plus whatever else is set — the rest from {@link LEAD_DEFAULTS}. The
 * plan adds `status` (the New lead presets) and `patientId` (an existing
 * patient picked, Appendix F). A 422 names a broken rule, a 409 a mobile
 * already on an open lead ({@link findOpenLeadByPhone} finds it).
 */
export async function createLead(input: LeadCreateInput): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(
    leadInputSchema,
    leadDraft(
      {
        ...LEAD_DEFAULTS,
        name: input.name,
        phone: input.phone,
        ...definedFields(input),
      },
      input,
    ),
  );
  await checkLead(fields, { exceptId: null, phoneChanged: true });
  return clinicFixtures.leads.create({
    ...fields,
    isContactThread: false,
    kind: 'enquiry',
    retargetReason: null,
    touchedAt: nowIso(),
    releasedAt: null,
    unreadCount: 0,
  });
}

/**
 * Update a lead (`updateLead`, `S:1594`; REPLACE_WITH_API): the patch merged
 * into the saved record and the whole checked again. Any status may follow any
 * (Q-L4); the status's side effects are the lead drawer's (L-34b). A new owner
 * takes over with the previous one staying involved and a fresh hold; a save
 * by the owner (`viewerId`) counts as their activity (Q-L9). A contact
 * thread's contact can be edited too (no status or source). A 404 when it is
 * gone.
 */
export async function updateLead(
  id: string,
  patch: LeadPatch,
  viewerId: string | null = null,
): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.leads.get(id);
  const patched = definedFields(patch);
  const merged = { ...saved, ...patched };
  const handover = merged.ownerId !== saved.ownerId;
  const fields = validateClinicInput(
    saved.isContactThread ? leadFieldsSchema : leadInputSchema,
    leadDraft(
      {
        ...merged,
        involvedIds: handover
          ? involvedAfterHandover(merged.involvedIds, saved.ownerId, merged.ownerId)
          : merged.involvedIds,
      },
      patched,
    ),
  );
  await checkLead(fields, { exceptId: id, phoneChanged: fields.phone !== saved.phone });
  const touched = handover || (viewerId !== null && viewerId === fields.ownerId);
  return clinicFixtures.leads.update(
    id,
    touched ? { ...fields, touchedAt: nowIso(), releasedAt: null } : fields,
  );
}

/** Assign a lead (`updateLead({ ownerId })`): the previous owner stays involved. */
export function assignLead(id: string, ownerId: string): Promise<LeadRecord> {
  return updateLead(id, { ownerId });
}

/**
 * Claim a lead (plan, Appendix F): the viewer becomes its owner, the previous
 * owner stays involved, and the hold starts again. Open, held ("Take over")
 * or its owner gone ("Join · take") alike; a closed lead stays with its owner
 * (409). Already the viewer's — unchanged.
 */
export async function claimLead(id: string, viewerId: string): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const lead = await pipelineLead(id);
  if (isLeadClosed(lead)) {
    throw clinicHttpError(
      409,
      'conflict',
      'This lead is closed · it stays with its owner',
    );
  }
  if (lead.ownerId === viewerId) return lead;
  refuseUnknownIds('ownerId', [viewerId], clinicFixtures.staff.snapshot(), NOT_ON_TEAM);
  return clinicFixtures.leads.update(id, {
    ownerId: viewerId,
    involvedIds: involvedAfterHandover(lead.involvedIds, lead.ownerId, viewerId),
    touchedAt: nowIso(),
    releasedAt: null,
  });
}

/**
 * Release a lead (plan): its owner lets anyone on the team take it — open at
 * once. Only the owner may (403, `S:1544`); a closed lead can't be (409).
 */
export async function releaseLead(id: string, viewerId: string): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const lead = await pipelineLead(id);
  if (lead.ownerId !== viewerId) {
    throw clinicHttpError(403, 'permission', "You don't have access to do this");
  }
  if (isLeadClosed(lead)) {
    throw clinicHttpError(
      409,
      'conflict',
      'This lead is closed · it stays with its owner',
    );
  }
  return clinicFixtures.leads.update(id, { releasedAt: nowIso() });
}

/**
 * Put a lead's team back as it was before a claim or an assignment — their
 * toasts' Undo. REPLACE_WITH_API: the server's undo of that write.
 */
export async function restoreLeadTeam(id: string, team: LeadTeam): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  await pipelineLead(id);
  return clinicFixtures.leads.update(id, team);
}

/**
 * Mark a lead read — opening it from the list (a backend request: per-viewer
 * unread). A read receipt is no edit: "Updated" stays.
 */
export async function markLeadRead(id: string): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const lead = await pipelineLead(id);
  if (lead.unreadCount === 0) return lead;
  return clinicFixtures.leads.update(id, { unreadCount: 0 }, { stamp: false });
}

/**
 * Soft-delete a lead with the Reason confirm's choice (`S:1546`;
 * REPLACE_WITH_API) — "Other" needs a note (422). Its chat history is kept.
 */
export async function deleteLead(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  await pipelineLead(id);
  return clinicFixtures.leads.remove(id, reason, note);
}

/** Restore a deleted lead — the Undo of its "removed" toast (`POST …/restore`, D32). */
export async function restoreLead(id: string): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.leads.restore(id);
}
