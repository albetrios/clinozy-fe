import {
  clinicHttpError,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import { LEAD_INTEREST_VALUES } from './clinic-schema.ts';
import { clinicToday } from './clinic-time.ts';
import { isCommandSearchQuery, matchesCommandSearch } from './command-search-api.ts';
import {
  type LeadContactHit,
  type LeadFields,
  leadFieldsSchema,
  leadInputSchema,
  type LeadPatch,
  type LeadRecord,
} from './leads-fixture-contracts.ts';
import { isLeadClosed } from './leads-fixture-hold.ts';
import { fetchMyStaffProfile } from './users-api.ts';
import type { StaffProfile } from './users-contracts.ts';

/*
 * The fixture world's leads, for the rooms still on fixtures (D149): the appointment form's
 * person search and contact edit, New task's person, the task drawer's lead and the fixture
 * viewer. The Leads room itself reads clinozy-be (`leads-api.ts`); this module goes with the last
 * fixture room that reads a lead. The world is imported on demand, so its seed data never lands
 * in a route chunk.
 */

/** TanStack Query keys for the fixture leads — under the Leads room's, so its writes refresh them. */
export const fixtureLeadQueryKeys = {
  all: ['clinic', 'leads', 'fixture'] as const,
  /** The signed-in member as the fixture rooms read them, by sign-in email. */
  viewer: (email: string | null) =>
    [...fixtureLeadQueryKeys.all, 'viewer', email] as const,
  detail: (id: string) => [...fixtureLeadQueryKeys.all, 'detail', id] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

const NOT_FOUND = 'Lead not found';
const NOT_ON_TEAM = 'Pick someone on the team';

const nowIso = () => new Date().toISOString();

/**
 * One fixture lead — a 404 when it is unknown, deleted, or a contact thread (no lead of the
 * pipeline).
 */
export async function fetchFixtureLead(id: string): Promise<LeadRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const lead = await clinicFixtures.leads.get(id);
  if (lead.isContactThread) throw clinicHttpError(404, 'not_found', NOT_FOUND);
  return lead;
}

/**
 * The signed-in member as the Leads room reads them — whose leads "Mine" and
 * "Unreplied" list, who claims, releases and assigns (REPLACE_WITH_API: the
 * server knows the member from the token). Their staff profile by sign-in
 * email (`fetchMyStaffProfile`); else the fixture server's own member, so the
 * room and the fixture server — which sends, claims and moves leads as that
 * member — agree on "me". Null only when the clinic has neither.
 */
export async function fetchFixtureLeadViewer(
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
 * The lead still in the pipeline for a mobile — what a create's 409 points
 * "Open" at (`S:1593`, Q-P7). A closed lead for the same person does not
 * count: a patient can come back as a new lead.
 */
async function findOpenLeadByPhone(
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
const LEAD_CONTACT_SEARCH_LIMIT = 5;

/** The visits that count as "last visit": checked in or completed. */
const VISITED = new Set(['checked_in', 'completed']);

/**
 * New lead's contact search (KICKOFF §6.3, `leads.md:79`; the plan's "contact
 * search", REPLACE_WITH_API): from two characters, ⌘K's matching (a name, the
 * mobile's digits, the display id), at most five people — patients first, with
 * their last visit, then the people known only as a lead or a chat, once per
 * mobile and never when that mobile is already a patient's. Newest first.
 */
export async function searchFixtureLeadContacts(
  query: string,
): Promise<LeadContactHit[]> {
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
    notes: (fields.notes?.trim() ?? '') || null,
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
 * Update a lead (`updateLead`, `S:1594`; REPLACE_WITH_API): the patch merged
 * into the saved record and the whole checked again. Any status may follow any
 * (Q-L4); the status's side effects are the lead drawer's (L-34b). A new owner
 * takes over with the previous one staying involved and a fresh hold; a save
 * by the owner (`viewerId`) counts as their activity (Q-L9). A contact
 * thread's contact can be edited too (no status or source). A 404 when it is
 * gone.
 */
export async function updateFixtureLead(
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
