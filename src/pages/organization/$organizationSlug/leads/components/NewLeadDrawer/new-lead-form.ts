import type { LeadInterest, LeadStatus } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LeadContactHit,
  LeadCreateInput,
  LeadRecordSource,
} from '@/shared/api/clinic/leads-contracts.ts';
import {
  type ContactEditorValue,
  contactFieldsOf,
  contactValueOf,
  emptyContactValue,
} from '@/shared/forms/ContactEditor/index.ts';
import { type AppIcon, House, InstagramMark, Phone } from '@/shared/icons/index.ts';

/**
 * Where New lead's contact came from: a patient or a lead picked in the search
 * (the card's avatar, the patient link, the editor's linked notice), or nowhere
 * — typed in "New contact", or prefilled by the contact card's "+ Lead".
 */
export type NewLeadOrigin = {
  kind: LeadContactHit['kind'];
  id: string;
  seq: number;
} | null;

/** The New lead form (`leads.md:75–90`): the contact, then the lead's own details. */
export interface NewLeadForm {
  /** The person: no contact yet while the name is empty. */
  contact: ContactEditorValue;
  origin: NewLeadOrigin;
  source: LeadRecordSource;
  /** New, unless a Quick start preset set another (H:6159). */
  status: LeadStatus;
  interests: LeadInterest[];
  customInterests: string[];
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
    origin: null,
    source: 'whatsapp',
    status: 'new',
    interests: [],
    customInterests: [],
    ownerId: viewerId,
    involvedIds: [],
  };
}

/** Whether the form has its contact — then the Contact step gives way to the card (`leads.md:251–258`). */
export function hasNewLeadContact(form: NewLeadForm): boolean {
  return form.contact.name.trim() !== '';
}

/** One Quick start chip (H:6159): it changes values, never the steps. */
export interface NewLeadPreset {
  id: 'walkIn' | 'phoneCall' | 'instagramDm';
  icon: AppIcon;
  source: LeadRecordSource;
  status: LeadStatus;
}

/** Walk-in → Walk-in, Clinic visited · Phone call → Phone call, Contacted · Instagram DM → Instagram, New. */
export const NEW_LEAD_PRESETS: readonly NewLeadPreset[] = [
  { id: 'walkIn', icon: House, source: 'walk_in', status: 'clinic_visited' },
  { id: 'phoneCall', icon: Phone, source: 'phone_call', status: 'contacted' },
  { id: 'instagramDm', icon: InstagramMark, source: 'instagram', status: 'new' },
];

/** A preset is pressed while the form holds both its values. */
export function presetPressed(form: NewLeadForm, preset: NewLeadPreset): boolean {
  return form.source === preset.source && form.status === preset.status;
}

/**
 * A search pick (`leads.md:252–253`): a patient's name and mobile with the
 * source Re-target, the new lead linked to them; a lead's or a chat's person
 * with their contact fields.
 */
export function withPickedContact(form: NewLeadForm, hit: LeadContactHit): NewLeadForm {
  if (hit.kind === 'patient') {
    return {
      ...form,
      contact: emptyContactValue(hit.name, hit.phone),
      origin: { kind: 'patient', id: hit.id, seq: hit.seq },
      source: 'retarget',
    };
  }
  return {
    ...form,
    contact: contactValueOf({ name: hit.name, phone: hit.phone, contact: hit.contact }),
    origin: { kind: 'lead', id: hit.id, seq: hit.seq },
  };
}

/** "Change" (`leads.md:257`): no contact, no link, the source back to WhatsApp. */
export function withoutContact(form: NewLeadForm): NewLeadForm {
  return { ...form, contact: emptyContactValue(), origin: null, source: 'whatsapp' };
}

/**
 * The linked notice's Undo: the person stays as typed, no longer tied to the
 * record they came from — a patient's Re-target source goes back to WhatsApp.
 */
export function withoutOrigin(form: NewLeadForm): NewLeadForm {
  return {
    ...form,
    origin: null,
    source:
      form.origin?.kind === 'patient' && form.source === 'retarget'
        ? 'whatsapp'
        : form.source,
  };
}

/**
 * What "Create lead" sends (`createLead`, `S:1593`) — `null` until the contact
 * has a name and a 10-digit mobile ("Add a name and a 10-digit mobile").
 * The plan's status, patient link and contact fields ride along (Appendix F).
 */
export function newLeadInputOf(form: NewLeadForm): LeadCreateInput | null {
  const { name, phone, contact } = contactFieldsOf(form.contact);
  if (!(name && phone)) return null;
  return {
    name,
    phone,
    contact,
    source: form.source,
    status: form.status,
    interests: form.interests,
    customInterests: form.customInterests,
    ownerId: form.ownerId,
    involvedIds: form.involvedIds.filter((id) => id !== form.ownerId),
    patientId: form.origin?.kind === 'patient' ? form.origin.id : null,
  };
}
