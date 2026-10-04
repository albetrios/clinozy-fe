import type { ContactChannel, LeadContact } from '@/shared/api/clinic/leads-contracts.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';

/** One number as the editor holds it: its digits as typed, and whether they are on WhatsApp on it. */
export interface ContactEditorPhone {
  /** At most ten digits (`98250 11241` is shown, `9825011241` kept). */
  digits: string;
  whatsapp: boolean;
}

/**
 * What the contact editor edits (`leads.md:92–107`; D32 — there is no Contact
 * entity, so these are the lead's or the patient's own fields, the plan's
 * contact fields among them, C16): the name, every number with the primary
 * first, the Instagram handles, the default channel and the preferences.
 */
export interface ContactEditorValue {
  name: string;
  /** Never empty: the primary first. */
  phones: ContactEditorPhone[];
  /** Handles as typed ("@rhea"); an empty row is one still being typed. */
  instagram: string[];
  defaultChannel: ContactChannel;
  /** As stored: a preset's English words ("No calls") or a custom one as typed. */
  preferences: string[];
}

/** The name's longest form (`leads.md:97`). */
export const CONTACT_NAME_MAX = 60;
/** A handle's longest form (`leads.md:99`). */
export const CONTACT_HANDLE_MAX = 30;
/** A custom preference's longest form (`leads.md:101`). */
export const CONTACT_PREFERENCE_MAX = 40;
/** The numbers, and the handles, one contact keeps (the plan's arrays). */
export const CONTACT_REACH_MAX = 5;

/**
 * The preference presets in the chips' order (`PREFS`, H:3368), as stored —
 * the chat composer reads "No calls" and "After 6 pm" back from the record.
 */
export const CONTACT_PREFERENCE_PRESETS = [
  'No calls',
  'Sundays only',
  'Weekdays only',
  'After 6 pm',
  'Mornings',
  'Evenings',
  'Weekends only',
  'Gujarati',
  'Hindi',
  'English',
  'Female doctor',
  'Text before calling',
] as const;

/** One preset preference, as stored. */
export type ContactPreferencePreset = (typeof CONTACT_PREFERENCE_PRESETS)[number];

/** Whether a stored preference is one of the presets (then it is shown translated). */
export function isPresetPreference(value: string): value is ContactPreferencePreset {
  return (CONTACT_PREFERENCE_PRESETS as readonly string[]).includes(value);
}

/** A stored E.164 mobile as the field's ten digits. */
function digitsOf(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

/** A blank contact — "New contact" in New lead; a prefilled name or mobile when known. */
export function emptyContactValue(
  name = '',
  phone: string | null = null,
): ContactEditorValue {
  return {
    name,
    phones: [{ digits: digitsOf(phone), whatsapp: true }],
    instagram: [],
    defaultChannel: 'whatsapp',
    preferences: [],
  };
}

/**
 * The editor's start from a record: its contact fields when someone has set
 * them, else its own mobile on WhatsApp, no handle, WhatsApp, no preferences.
 */
export function contactValueOf(record: {
  name: string;
  phone: string | null;
  contact?: LeadContact;
}): ContactEditorValue {
  const { contact } = record;
  if (!contact) return emptyContactValue(record.name, record.phone);
  return {
    name: record.name,
    phones: contact.phones.map((entry) => ({
      digits: digitsOf(entry.phone),
      whatsapp: entry.whatsapp,
    })),
    instagram: [...contact.instagram],
    defaultChannel: contact.defaultChannel,
    preferences: [...contact.preferences],
  };
}

/** The numbers with row `index` moved first — it becomes the primary. */
export function withPrimaryPhone(
  phones: readonly ContactEditorPhone[],
  index: number,
): ContactEditorPhone[] {
  const picked = phones[index];
  if (!picked || index === 0) return [...phones];
  return [picked, ...phones.filter((_, at) => at !== index)];
}

/**
 * The preferences after "+ Custom" (`leads.md:101`): the typed words trimmed
 * to 40 characters and added unless already there, case aside.
 */
export function withCustomPreference(
  preferences: readonly string[],
  typed: string,
): string[] {
  const value = typed.trim().slice(0, CONTACT_PREFERENCE_MAX).trim();
  const key = value.toLowerCase();
  if (!value || preferences.some((preference) => preference.toLowerCase() === key)) {
    return [...preferences];
  }
  return [...preferences, value];
}

/** The primary number as the contract stores it — `null` until it is a 10-digit mobile. */
export function primaryPhoneOf(value: ContactEditorValue): string | null {
  return toClinicPhone(value.phones[0]?.digits ?? '');
}

/** The numbers and handles beyond the primary — the contact card's " · +N more". */
export function extraReachCount(value: ContactEditorValue): number {
  const phones = value.phones.filter((entry) => entry.digits).length;
  const handles = value.instagram.filter((handle) => handle.trim()).length;
  return Math.max(0, phones - 1) + handles;
}

/**
 * What a record stores from the editor: the trimmed name, the primary mobile
 * (`null` while it is not ten digits) and the contact fields — complete numbers
 * only, the handles that were typed, the channel and the preferences.
 */
export function contactFieldsOf(value: ContactEditorValue): {
  name: string;
  phone: string | null;
  contact: LeadContact;
} {
  const phones = value.phones.flatMap((entry) => {
    const phone = toClinicPhone(entry.digits);
    return phone ? [{ phone, whatsapp: entry.whatsapp }] : [];
  });
  const primary = primaryPhoneOf(value);
  return {
    name: value.name.trim(),
    phone: primary,
    contact: {
      phones: phones.slice(0, CONTACT_REACH_MAX),
      instagram: value.instagram
        .map((handle) => handle.trim())
        .filter(Boolean)
        .slice(0, CONTACT_REACH_MAX),
      defaultChannel: value.defaultChannel,
      preferences: value.preferences.slice(0, 20),
    },
  };
}
