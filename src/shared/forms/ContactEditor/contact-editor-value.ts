import {
  type Contact,
  CONTACT_PREFERENCE_TAG_PATTERN,
  CONTACT_PREFERENCE_TAGS,
  CONTACT_PREFERENCE_TAGS_MAX,
  CONTACT_REACH_MAX,
  type ContactChannel,
  type ContactFields,
  type ContactPreferenceTag,
} from '@/shared/api/app/contacts-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';

/** One number as the editor holds it: its digits as typed, and whether they are on WhatsApp on it. */
export interface ContactEditorPhone {
  /** At most ten digits (`98250 11241` is shown, `9825011241` kept). */
  digits: string;
  whatsapp: boolean;
}

/**
 * What the contact editor edits (`leads.md:92–107`) — the contact's own fields on clinozy-be:
 * the first and last name (Q17), every number with the primary first, the Instagram handles,
 * the default channel and the preference tags.
 */
export interface ContactEditorValue {
  firstName: string;
  /** Empty when they gave none. */
  lastName: string;
  /** Never empty: the primary first. */
  phones: ContactEditorPhone[];
  /** Handles as typed ("@rhea"); an empty row is one still being typed. */
  instagram: string[];
  defaultChannel: ContactChannel;
  /** Preference tags — a preset's (`no_calls`) or a custom one (`prefers_saturdays`). */
  preferences: string[];
}

/** A name's longest form — first or last (the API's 60). */
export const CONTACT_NAME_MAX = 60;

/** A handle's longest form (`leads.md:99`). */
export const CONTACT_HANDLE_MAX = 30;

/** A custom preference's longest form, typed (`leads.md:101`; the tag keeps 40). */
export const CONTACT_PREFERENCE_MAX = 40;

export { CONTACT_REACH_MAX };

/** The preset preferences in the chips' order, as the API stores them. */
export const CONTACT_PREFERENCE_PRESETS = CONTACT_PREFERENCE_TAGS;

/** One preset preference. */
export type ContactPreferencePreset = ContactPreferenceTag;

/** Whether a tag is one of the presets (then it is shown translated). */
export function isPresetPreference(value: string): value is ContactPreferencePreset {
  return (CONTACT_PREFERENCE_PRESETS as readonly string[]).includes(value);
}

/** A custom tag as the chip shows it: `prefers_saturdays` → "prefers saturdays". */
export function customPreferenceLabel(tag: string): string {
  return tag.replaceAll('_', ' ');
}

/** A stored E.164 mobile as the field's ten digits. */
function digitsOf(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

/** A typed full name as first and last: the first word, then the rest. */
function splitPersonName(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/** A blank contact — "New contact" in New lead; a prefilled name or mobile when known. */
export function emptyContactValue(
  name = '',
  phone: string | null = null,
): ContactEditorValue {
  return {
    ...splitPersonName(name),
    phones: [{ digits: digitsOf(phone), whatsapp: true }],
    instagram: [],
    defaultChannel: 'whatsapp',
    preferences: [],
  };
}

/** The editor's start from a contact read with every number. */
export function contactValueOf(contact: Contact): ContactEditorValue {
  const primaryFirst = [...contact.phones].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
  );
  return {
    firstName: contact.firstName,
    lastName: contact.lastName ?? '',
    phones: primaryFirst.map((entry) => ({
      digits: digitsOf(entry.phone),
      whatsapp: entry.isOnWhatsapp,
    })),
    instagram: [...contact.instagramHandles],
    defaultChannel: contact.defaultChannel,
    preferences: [...contact.preferenceTags],
  };
}

/** The name the band and the toasts show: "Riya Shah". */
export function contactValueName(value: ContactEditorValue): string {
  return [value.firstName.trim(), value.lastName.trim()].filter(Boolean).join(' ');
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
 * The preferences after "+ Custom" (`leads.md:101`): the typed words as a tag — lowercase, `_`
 * between words, a letter first — added unless already there or the twelve are taken.
 */
export function withCustomPreference(
  preferences: readonly string[],
  typed: string,
): string[] {
  const tag = typed
    .trim()
    .slice(0, CONTACT_PREFERENCE_MAX)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_')
    .replace(/^[^a-z]+/, '');
  if (
    !CONTACT_PREFERENCE_TAG_PATTERN.test(tag) ||
    preferences.includes(tag) ||
    preferences.length >= CONTACT_PREFERENCE_TAGS_MAX
  ) {
    return [...preferences];
  }
  return [...preferences, tag];
}

/** The primary number as the API stores it — `null` until it is a 10-digit mobile. */
export function primaryPhoneOf(value: ContactEditorValue): string | null {
  return toAppPhone(value.phones[0]?.digits ?? '');
}

/** The numbers and handles beyond the primary — the contact card's " · +N more". */
export function extraReachCount(value: ContactEditorValue): number {
  const phones = value.phones.filter((entry) => entry.digits).length;
  const handles = value.instagram.filter((handle) => handle.trim()).length;
  return Math.max(0, phones - 1) + handles;
}

/**
 * What the editor writes: the trimmed names, the complete numbers (the primary first), the
 * handles that were typed, the channel and the tags.
 */
export function contactFieldsOf(value: ContactEditorValue): ContactFields {
  const phones = value.phones.flatMap((entry) => {
    const phone = toAppPhone(entry.digits);
    return phone ? [{ phone, isOnWhatsapp: entry.whatsapp }] : [];
  });
  const lastName = value.lastName.trim();
  return {
    firstName: value.firstName.trim(),
    lastName: lastName === '' ? null : lastName,
    phones: phones.slice(0, CONTACT_REACH_MAX),
    instagramHandles: value.instagram
      .map((handle) => handle.trim())
      .filter(Boolean)
      .slice(0, CONTACT_REACH_MAX),
    defaultChannel: value.defaultChannel,
    preferenceTags: value.preferences.slice(0, CONTACT_PREFERENCE_TAGS_MAX),
  };
}
