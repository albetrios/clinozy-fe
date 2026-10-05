import { createdFilterMatches, followUpFilterMatches } from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CursorPage,
  definedFields,
  recordFixtureChange,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import {
  type DeleteReason,
  LEAD_INTEREST_VALUES,
  LEAD_STATUS_VALUES,
  type LeadStatus,
} from './clinic-schema.ts';
import { addCivilDays, clinicInstant, clinicToday } from './clinic-time.ts';
import { isCommandSearchQuery, matchesCommandSearch } from './command-search-api.ts';
import {
  LEAD_DEFAULTS,
  type LeadContactHit,
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
  /** A lead's open tasks — the drawer's Info count. */
  openTasks: (id: string) => [...leadQueryKeys.all, 'open-tasks', id] as const,
  /** New lead's contact search, per query. */
  contactSearch: (query: string) =>
    [...leadQueryKeys.all, 'contact-search', query] as const,
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
 * How many of a lead's tasks are still open — the drawer's Info "Open tasks"
 * (a backend request: the contract's task list filters by lead, `S:1724`).
 */
export async function countOpenLeadTasks(id: string): Promise<number> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.tasks.snapshot(
    (task) => task.leadId === id && task.status !== 'done',
  ).length;
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

/** New lead's search returns at most this many people (`leads.md:79`). */
export const LEAD_CONTACT_SEARCH_LIMIT = 5;

/** The visits that count as "last visit": checked in or completed. */
const VISITED = new Set(['checked_in', 'completed']);

/**
 * New lead's contact search (KICKOFF §6.3, `leads.md:79`; the plan's "contact
 * search", REPLACE_WITH_API): from two characters, ⌘K's matching (a name, the
 * mobile's digits, the display id), at most five people — patients first, with
 * their last visit, then the people known only as a lead or a chat, once per
 * mobile and never when that mobile is already a patient's. Newest first.
 */
export async function searchLeadContacts(query: string): Promise<LeadContactHit[]> {
  if (!isCommandSearchQuery(query)) return [];
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const lastVisit = new Map<string, string>();
  for (const { patientId, status, date } of clinicFixtures.appointments.snapshot()) {
    if (patientId && VISITED.has(status) && date <= today) {
      const known = lastVisit.get(patientId);
      if (!known || date > known) lastVisit.set(patientId, date);
    }
  }
  const allPatients = clinicFixtures.patients.snapshot();
  const patients: LeadContactHit[] = allPatients
    .map((patient) => ({
      patient,
      name: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
    }))
    .filter(({ patient, name }) =>
      matchesCommandSearch(
        { names: [name], phone: patient.phone, seq: patient.seq },
        query,
      ),
    )
    .sort((a, b) => b.patient.seq - a.patient.seq)
    .map(({ patient, name }) => ({
      kind: 'patient',
      id: patient.id,
      seq: patient.seq,
      name,
      phone: patient.phone,
      lastVisit: lastVisit.get(patient.id) ?? null,
    }));
  const patientPhones = new Set(
    allPatients.flatMap((patient) => [patient.phone, patient.phone2]),
  );
  const seen = new Set<string>();
  const people: LeadContactHit[] = clinicFixtures.leads
    .snapshot(
      (lead) =>
        lead.patientId === null &&
        !patientPhones.has(lead.phone) &&
        matchesCommandSearch(
          { names: [lead.name], phone: lead.phone, seq: lead.seq },
          query,
        ),
    )
    .sort((a, b) => b.seq - a.seq)
    .filter((lead) => {
      if (seen.has(lead.phone)) return false;
      seen.add(lead.phone);
      return true;
    })
    .map((lead) => ({
      kind: 'lead',
      id: lead.id,
      seq: lead.seq,
      name: lead.name,
      phone: lead.phone,
      contactThread: lead.isContactThread,
      contact: lead.contact,
    }));
  return [...patients, ...people].slice(0, LEAD_CONTACT_SEARCH_LIMIT);
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
  return clinicFixtures.leads.update(id, await leadWriteOf(saved, patch, viewerId));
}

/**
 * The fields an update writes: the patch merged into the saved record and the
 * whole checked again (a 422 / 409 refuses it), the hold restarted on a
 * handover or the owner's own save (Q-L9).
 */
async function leadWriteOf(
  saved: LeadRecord,
  patch: LeadPatch,
  viewerId: string | null,
): Promise<LeadFields & Partial<Pick<LeadRecord, 'touchedAt' | 'releasedAt'>>> {
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
  await checkLead(fields, {
    exceptId: saved.id,
    phoneChanged: fields.phone !== saved.phone,
  });
  const touched = handover || (viewerId !== null && viewerId === fields.ownerId);
  return touched ? { ...fields, touchedAt: nowIso(), releasedAt: null } : fields;
}

/** What the lead drawer's save answers (KICKOFF §6.3 Save). */
export interface LeadSave {
  lead: LeadRecord;
  /** Undoes the save together with its status's side effects (`undoLeadChange`). */
  undoToken: string;
  /** The save moved the status — its toast names the move and offers Undo. */
  statusMoved: boolean;
  /** The status moved to Follow-up: a follow-up task is due tomorrow. */
  followUpTask: boolean;
}

/** The English status names a system line writes ("Status → Follow-up"). */
const STATUS_LINE_LABELS: Readonly<Record<LeadStatus, string>> = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow-up',
  clinic_visited: 'Clinic visited',
  no_response: 'No response',
  not_interested: 'Not interested',
  invalid: 'Invalid',
  lost: 'Lost',
};

/** Where a follow-up lands: tomorrow at 11:00, clinic time (H:5634). */
const FOLLOW_UP_TIME = '11:00';

/** The Call back task's title — one open per lead (H:5633). */
const CALL_BACK_TITLE = 'Call back';

/** What one Undo reverses. */
interface LeadUndo {
  reverse(): Promise<void>;
}

const leadUndoLog = new Map<string, LeadUndo>();
let leadUndoLogHooked = false;

/** The open saves' undo records — emptied with the fixture world. */
async function leadUndoRecords(): Promise<Map<string, LeadUndo>> {
  const { onClinicFixturesReset } = await fixtureWorld();
  if (!leadUndoLogHooked) {
    onClinicFixturesReset(() => leadUndoLog.clear());
    leadUndoLogHooked = true;
  }
  return leadUndoLog;
}

/**
 * The lead drawer's save (`updateLead`, `S:1594`; REPLACE_WITH_API) with the
 * status's server rules (Q-T3; `leads.md:275–283`, H:5633–5634), recorded so
 * one Undo reverses them all (§7.3 — the prototype reverts only the status):
 * a moved status writes "Status → <status>" into the chat; Follow-up opens a
 * "Follow-up" task due tomorrow for the member saving and sets `followUpAt`
 * to it — the "follow" rule's task for that day, opened ahead of the job, so
 * the day brings no second one, and none while one for that day is open; No
 * response opens a "Call back" task due tomorrow unless one is open (both
 * task kind `follow_up`, A-L5).
 */
export async function saveLead(
  id: string,
  patch: LeadPatch,
  viewerId: string | null = null,
): Promise<LeadSave> {
  const [{ clinicFixtures }, { createTaskIn }, { systemLine }, { taskRuleKeys }] =
    await Promise.all([
      fixtureWorld(),
      import('./fixtures/tasks-server.fixtures.ts'),
      import('./fixtures/messages.fixtures.ts'),
      import('./fixtures/task-rules.fixtures.ts'),
    ]);
  const saved = await clinicFixtures.leads.get(id);
  const change = recordFixtureChange();
  let lead = await change.update(
    clinicFixtures.leads,
    id,
    await leadWriteOf(saved, patch, viewerId),
  );
  const moved = lead.status !== null && lead.status !== saved.status;
  const now = new Date();
  const due = clinicInstant(addCivilDays(clinicToday(now), 1), FOLLOW_UP_TIME);
  if (moved && lead.status) {
    await change.create(
      clinicFixtures.leadMessages,
      systemLine(id, `Status → ${STATUS_LINE_LABELS[lead.status]}`, null, now),
    );
  }
  const followUpTask = moved && lead.status === 'follow_up';
  if (followUpTask) {
    const ruleKey = taskRuleKeys.follow(id, clinicToday(new Date(due)));
    const followUpOpen =
      clinicFixtures.tasks.snapshot(
        (task) => task.ruleKey === ruleKey && task.status !== 'done',
      ).length > 0;
    if (!followUpOpen) {
      await createTaskIn(
        change,
        {
          title: 'Follow-up',
          why: 'Follow up',
          ownerId: viewerId ?? lead.ownerId,
          leadId: id,
          dueAt: due,
          kind: 'follow_up',
        },
        { ruleKey },
      );
    }
    lead = await change.update(clinicFixtures.leads, id, { followUpAt: due });
  }
  const callBackOpen =
    clinicFixtures.tasks.snapshot(
      (task) =>
        task.leadId === id && task.status !== 'done' && task.title === CALL_BACK_TITLE,
    ).length > 0;
  if (moved && lead.status === 'no_response' && !callBackOpen) {
    await createTaskIn(change, {
      title: CALL_BACK_TITLE,
      why: 'Status moved to No response. Follow up with the lead.',
      ownerId: lead.ownerId ?? viewerId,
      leadId: id,
      dueAt: due,
      kind: 'follow_up',
    });
  }
  const undoToken = crypto.randomUUID();
  (await leadUndoRecords()).set(undoToken, change);
  return { lead, undoToken, statusMoved: moved, followUpTask };
}

/**
 * Undo a drawer save (`saveLead`): the fields it wrote, its system line and
 * the task it opened. A 409 once the token is gone (already undone, or the
 * world reset).
 */
export async function undoLeadChange(undoToken: string): Promise<void> {
  const log = await leadUndoRecords();
  const change = log.get(undoToken);
  if (!change) {
    const message = 'This change can no longer be undone';
    throw clinicHttpError(409, 'conflict', message, { undoToken: [message] });
  }
  log.delete(undoToken);
  await change.reverse();
}

/** What "Convert to patient" answers. */
export interface LeadConversion {
  lead: LeadRecord;
  patientId: string;
  /** Undoes the conversion: the patient removed, the lead as it was (`undoLeadChange`). */
  undoToken: string;
}

/**
 * "Convert to patient" (KICKOFF §6.3 Status side effects; REPLACE_WITH_API —
 * `createPatient` takes no lead, `S:1623`, so the link is a backend request):
 * a patient from the lead's name and mobile, linked both ways; the lead moves
 * to Clinic visited and its chat reads "Converted to patient". One Undo takes
 * the patient and the lead's move back.
 */
export async function convertLead(id: string): Promise<LeadConversion> {
  const [{ clinicFixtures }, { createPatient, deletePatient }, { systemLine }] =
    await Promise.all([
      fixtureWorld(),
      import('./patients-api.ts'),
      import('./fixtures/messages.fixtures.ts'),
    ]);
  const lead = await pipelineLead(id);
  if (lead.patientId !== null) {
    const message = 'This lead is already a patient';
    throw clinicHttpError(409, 'conflict', message, { patientId: [message] });
  }
  const [firstName = lead.name, ...rest] = lead.name.trim().split(/\s+/);
  const { patient } = await createPatient({
    firstName,
    lastName: rest.join(' ') || null,
    phone: lead.phone,
    leadId: id,
  });
  const change = recordFixtureChange();
  const converted = await change.update(clinicFixtures.leads, id, {
    patientId: patient.id,
    status: 'clinic_visited',
  });
  await change.create(
    clinicFixtures.leadMessages,
    systemLine(id, 'Converted to patient', null, new Date()),
  );
  const undoToken = crypto.randomUUID();
  (await leadUndoRecords()).set(undoToken, {
    reverse: async () => {
      await change.reverse();
      await deletePatient(patient.id, 'mistake', null);
    },
  });
  return { lead: converted, patientId: patient.id, undoToken };
}

/** The system line an assignment leaves (`leads.md:196`, H:5705); a lead nobody owned names no one. */
const assignedLine = (owner: string, previous: string | null) =>
  previous ? `Assigned to ${owner} · ${previous} stays involved` : `Assigned to ${owner}`;

/**
 * Assign a lead (`updateLead({ ownerId })`): the previous owner stays
 * involved, and the chat says so — "Assigned to <name> · <previous> stays
 * involved", the team's short names (KICKOFF §6.3 people events). The toast's
 * Undo puts the team back and keeps the line, as the prototype does (H:5705).
 */
export async function assignLead(id: string, ownerId: string): Promise<LeadRecord> {
  const [{ clinicFixtures }, { systemLine }, { staffShortName }] = await Promise.all([
    fixtureWorld(),
    import('./fixtures/messages.fixtures.ts'),
    import('./fixtures/task-rules.fixtures.ts'),
  ]);
  const before = await clinicFixtures.leads.get(id);
  const lead = await updateLead(id, { ownerId });
  const nameOf = (staffId: string | null) => {
    const user = staffId
      ? clinicFixtures.staff.snapshot((row) => row.id === staffId)[0]
      : undefined;
    return user ? staffShortName(user) : null;
  };
  const owner = lead.ownerId === before.ownerId ? null : nameOf(lead.ownerId);
  if (owner) {
    await clinicFixtures.leadMessages.create(
      systemLine(id, assignedLine(owner, nameOf(before.ownerId)), null, new Date()),
    );
  }
  return lead;
}

/**
 * Set who is involved on a lead — the people popover's toggle (`leads.md:196`,
 * H:5707). The chat says who joined or left, one system line per person in
 * the team's short names: "Added <name> as involved" / "Removed <name> from
 * involved" — the line is the toggle's feedback, as in the prototype (no toast).
 */
export async function setLeadInvolved(
  id: string,
  involvedIds: readonly string[],
): Promise<LeadRecord> {
  const [{ clinicFixtures }, { systemLine }, { staffShortName }] = await Promise.all([
    fixtureWorld(),
    import('./fixtures/messages.fixtures.ts'),
    import('./fixtures/task-rules.fixtures.ts'),
  ]);
  const before = await clinicFixtures.leads.get(id);
  const lead = await updateLead(id, { involvedIds: [...involvedIds] });
  const staff = clinicFixtures.staff.snapshot();
  const nameOf = (staffId: string) => {
    const user = staff.find((row) => row.id === staffId);
    return user ? staffShortName(user) : null;
  };
  const lines = [
    ...lead.involvedIds
      .filter((staffId) => !before.involvedIds.includes(staffId))
      .map((staffId) => ({ name: nameOf(staffId), line: 'Added {} as involved' })),
    ...before.involvedIds
      .filter((staffId) => !lead.involvedIds.includes(staffId))
      .map((staffId) => ({ name: nameOf(staffId), line: 'Removed {} from involved' })),
  ];
  const now = new Date();
  for (const { name, line } of lines) {
    if (name) {
      await clinicFixtures.leadMessages.create(
        systemLine(id, line.replace('{}', name), null, now),
      );
    }
  }
  return lead;
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
