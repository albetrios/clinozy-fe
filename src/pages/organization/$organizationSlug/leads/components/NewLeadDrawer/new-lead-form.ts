import type {
  LeadInterest,
  LeadSource,
  LeadStatus,
} from '@/shared/api/app/app-schema.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import type { LeadPersonInput } from '@/shared/api/app/leads-api.ts';
import type { LeadFields } from '@/shared/api/app/leads-contracts.ts';
import {
  type ContactEditorValue,
  contactFieldsOf,
  emptyContactValue,
} from '@/shared/forms/ContactEditor/index.ts';
import { type AppIcon, House, InstagramMark } from '@/shared/icons/index.ts';

/**
 * The person New lead's search picked (`GET /app/contacts?q=`): the lead is created for them
 * (`contact_id`), their own fields untouched — the lead drawer edits them afterwards.
 */
export type NewLeadPicked = Pick<
  ContactSummary,
  | 'id'
  | 'contactNumber'
  | 'name'
  | 'primaryPhone'
  | 'instagramHandles'
  | 'patientId'
  | 'openLeadId'
>;

/** The New lead form (`leads.md:75–90`): the person, then the lead's own details. */
export interface NewLeadForm {
  /** A new person, as typed: no contact yet while the first name is empty. */
  contact: ContactEditorValue;
  /** Someone already known, picked in the search — then `contact` is not sent. */
  picked: NewLeadPicked | null;
  source: LeadSource;
  /** New, unless a Quick start preset set another (H:6159). */
  status: LeadStatus;
  interests: LeadInterest[];
  ownerId: string | null;
  involvedIds: string[];
}

/** What opens New lead: the URL's prefill (⌘K, the contact card's "+ Lead"). */
export interface NewLeadPrefill {
  name?: string;
  /** E.164. */
  phone?: string;
}

/** The form an opening starts from: WhatsApp, New, the signed-in member as the owner. */
export function newLeadForm(
  prefill: NewLeadPrefill,
  viewerId: string | null,
): NewLeadForm {
  return {
    contact: emptyContactValue(prefill.name?.trim() ?? '', prefill.phone ?? null),
    picked: null,
    source: 'whatsapp',
    status: 'new',
    interests: [],
    ownerId: viewerId,
    involvedIds: [],
  };
}

/** Whether the form has its person — then the Contact step gives way to the card (`leads.md:251–258`). */
export function hasNewLeadContact(form: NewLeadForm): boolean {
  return form.picked !== null || form.contact.firstName.trim() !== '';
}

/** One Quick start chip (H:6159): it changes values, never the steps. */
export interface NewLeadPreset {
  id: 'walkIn' | 'instagramDm';
  icon: AppIcon;
  source: LeadSource;
}

/**
 * Walk-in → source Walk-in · Instagram DM → source Instagram. The design's Walk-in also set
 * Clinic visited, which only a check-in sets (L8), and its "Phone call" preset had no source in
 * the API (route map §4): both went.
 */
export const NEW_LEAD_PRESETS: readonly NewLeadPreset[] = [
  { id: 'walkIn', icon: House, source: 'walk_in' },
  { id: 'instagramDm', icon: InstagramMark, source: 'instagram' },
];

/** A preset is pressed while the form holds its source. */
export function presetPressed(form: NewLeadForm, preset: NewLeadPreset): boolean {
  return form.source === preset.source;
}

/**
 * A search pick (`leads.md:252–253`): the lead goes to that person; someone with a patient
 * file comes back as a re-target.
 */
export function withPickedContact(form: NewLeadForm, hit: NewLeadPicked): NewLeadForm {
  return {
    ...form,
    contact: emptyContactValue(),
    picked: hit,
    source: hit.patientId ? 'retarget' : form.source,
  };
}

/** "Change" (`leads.md:257`): no person, the source back to WhatsApp. */
export function withoutContact(form: NewLeadForm): NewLeadForm {
  return { ...form, contact: emptyContactValue(), picked: null, source: 'whatsapp' };
}

/** What "Create lead" sends: who it is for, and the lead's fields. */
export interface NewLeadInput {
  person: LeadPersonInput;
  fields: LeadFields;
}

/**
 * What "Create lead" sends (`POST /app/leads`) — the picked person's `contact_id`, or the new
 * person's fields; `null` until a new person has a first name and a 10-digit mobile ("Add a
 * name and a 10-digit mobile").
 */
export function newLeadInputOf(form: NewLeadForm): NewLeadInput | null {
  let person: LeadPersonInput;
  if (form.picked) {
    person = { contactId: form.picked.id };
  } else {
    const contact = contactFieldsOf(form.contact);
    if (!(contact.firstName && contact.phones.length > 0)) return null;
    person = { contact };
  }
  return {
    person,
    fields: {
      status: form.status,
      source: form.source,
      interests: form.interests,
      ownerId: form.ownerId,
      involvedIds: form.involvedIds.filter((id) => id !== form.ownerId),
      followUpAt: null,
      branchId: null,
      notes: null,
    },
  };
}
