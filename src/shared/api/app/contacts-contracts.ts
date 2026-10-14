import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  type Gender,
  genderSchema,
  type ReferralSource,
  referralSourceSchema,
} from './app-schema.ts';

/*
 * The person (api-integration §3): one contact holds the name, the numbers, the handles, the
 * channel and the preferences; a lead, a patient file, a booking and a bill point at it with
 * `contact_id`. These are its shapes on clinozy-be (`/app/contacts`) and as the rooms read them.
 */

/** The channels a contact may prefer — WhatsApp · Call · Instagram (no SMS, route map §4 #8). */
export const CONTACT_CHANNELS = ['whatsapp', 'call', 'instagram'] as const;
/** One default channel. */
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

/**
 * The known preference tags, in the chips' order — the design's twelve presets as clinozy-be
 * stores them; any other tag is a custom one (`^[a-z][a-z0-9_]{1,39}$`).
 */
export const CONTACT_PREFERENCE_TAGS = [
  'no_calls',
  'sundays_only',
  'weekdays_only',
  'after_six_pm',
  'mornings',
  'evenings',
  'weekends_only',
  'gujarati',
  'hindi',
  'english',
  'female_doctor',
  'text_before_calling',
] as const;
/** A known preference tag. */
export type ContactPreferenceTag = (typeof CONTACT_PREFERENCE_TAGS)[number];

/** Most preference tags a contact keeps. */
export const CONTACT_PREFERENCE_TAGS_MAX = 12;

/** The numbers, and the Instagram handles, a contact keeps. */
export const CONTACT_REACH_MAX = 5;

/** A tag's shape: lowercase, digits and `_`, 2–40 characters, a letter first. */
export const CONTACT_PREFERENCE_TAG_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

// ── The wire ──

type ApiContact = NonNullable<ApiData<'/app/contacts/{contact_id}', 'get'>>;
type ApiContactRow = NonNullable<ApiData<'/app/contacts', 'get'>>[number];
/** A contact change as `PATCH /app/contacts/:contact_id` takes it. */
export type ApiContactChange = NonNullable<
  ApiBody<'/app/contacts/{contact_id}', 'patch'>
>;
/** A new contact as `POST /app/contacts` (and a lead's inline `contact`) takes it. */
export type ApiContactCreate = NonNullable<ApiBody<'/app/contacts', 'post'>>;

const contactPhoneWire = z.object({
  phone: z.string(),
  is_primary: z.boolean(),
  is_on_whatsapp: z.boolean(),
});

const contactFieldsWire = {
  id: z.string(),
  contact_number: z.number().int(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  primary_phone: z.string(),
  email: z.string().nullable(),
  instagram_handles: z.array(z.string()),
  default_channel: z.enum(CONTACT_CHANNELS),
  preference_tags: z.array(z.string()),
  patient_id: z.string().nullable(),
  open_lead_id: z.string().nullable(),
  last_activity_at: z.string().nullable(),
  last_received_at: z.string().nullable(),
  is_awaiting_reply: z.boolean(),
  updated_at: z.string(),
  gender: genderSchema.nullable(),
  date_of_birth: z.string().nullable(),
  address: z.string().nullable(),
  referral_source: referralSourceSchema.nullable(),
  referred_by_contact_id: z.string().nullable(),
  referred_by_name: z.string().nullable(),
  has_marketing_consent: z.boolean(),
  patient_number: z.number().int().nullable(),
};

/** One contact (`GET /app/contacts/:contact_id`) — with every number. */
export const contactWire = wireSchema<ApiContact>()(
  z.object({ ...contactFieldsWire, phones: z.array(contactPhoneWire) }),
);

/** A contact list row (`GET /app/contacts`) — the primary number only. */
export const contactRowWire = wireSchema<ApiContactRow>()(z.object(contactFieldsWire));

// ── The rooms' shapes ──

/** One of a contact's numbers. */
interface ContactPhone {
  /** E.164. */
  phone: string;
  isPrimary: boolean;
  isOnWhatsapp: boolean;
}

/** A person as a list or a search shows them. */
export interface ContactSummary {
  /** The contact's id. */
  id: string;
  /** "C-12345" is this number. */
  contactNumber: number;
  firstName: string;
  lastName: string | null;
  /** "Riya Shah". */
  name: string;
  primaryPhone: string;
  email: string | null;
  instagramHandles: string[];
  defaultChannel: ContactChannel;
  preferenceTags: string[];
  /** Their patient file, once a check-in opened it. */
  patientId: string | null;
  /** Their open lead, if any. */
  openLeadId: string | null;
  lastActivityAt: string | null;
  /** When they last wrote in. */
  lastReceivedAt: string | null;
  /** Their last message is newer than ours. */
  isAwaitingReply: boolean;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** What a person's record holds beyond their reach — the patient file's About and Edit patient. */
export interface ContactProfile {
  gender: Gender | null;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  address: string | null;
  referralSource: ReferralSource | null;
  /** The contact who referred them, when it was someone the clinic knows. */
  referredByContactId: string | null;
  /** Who referred them, as typed. */
  referredByName: string | null;
  hasMarketingConsent: boolean;
  /** Their patient file's number ("#3508"), once they have one. */
  patientNumber: number | null;
}

/**
 * A people-search row (the contact pickers' search and Recent): the summary, with the patient
 * file's number ("#3441") for a patient — left out by the doubles that predate it.
 */
export type ContactHit = ContactSummary & Partial<Pick<ContactProfile, 'patientNumber'>>;

/** A person with every number — the contact editor's record. */
export interface Contact extends ContactSummary, ContactProfile {
  phones: ContactPhone[];
}

/** A contact's full name. */
export function contactNameOf(contact: {
  first_name: string;
  last_name: string | null;
}): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
}

/** A list row as the rooms read it. */
export function toContactSummary(row: z.output<typeof contactRowWire>): ContactSummary {
  return {
    id: row.id,
    contactNumber: row.contact_number,
    firstName: row.first_name,
    lastName: row.last_name,
    name: contactNameOf(row),
    primaryPhone: row.primary_phone,
    email: row.email,
    instagramHandles: row.instagram_handles,
    defaultChannel: row.default_channel,
    preferenceTags: row.preference_tags,
    patientId: row.patient_id,
    openLeadId: row.open_lead_id,
    lastActivityAt: row.last_activity_at,
    lastReceivedAt: row.last_received_at,
    isAwaitingReply: row.is_awaiting_reply,
    updatedAt: row.updated_at,
  };
}

/** A contact row's profile — the fields beyond the name and the reach. */
export function toContactProfile(row: z.output<typeof contactRowWire>): ContactProfile {
  return {
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    address: row.address,
    referralSource: row.referral_source,
    referredByContactId: row.referred_by_contact_id,
    referredByName: row.referred_by_name,
    hasMarketingConsent: row.has_marketing_consent,
    patientNumber: row.patient_number,
  };
}

/** One contact as the rooms read it. */
export function toContact(row: z.output<typeof contactWire>): Contact {
  return {
    ...toContactSummary(row),
    ...toContactProfile(row),
    phones: row.phones.map((entry) => ({
      phone: entry.phone,
      isPrimary: entry.is_primary,
      isOnWhatsapp: entry.is_on_whatsapp,
    })),
  };
}

/** What the contact editor writes: the name, the numbers (the primary first), the reach. */
export interface ContactFields {
  firstName: string;
  lastName: string | null;
  /** 1–5, the primary first. */
  phones: { phone: string; isOnWhatsapp: boolean }[];
  instagramHandles: string[];
  defaultChannel: ContactChannel;
  preferenceTags: string[];
}

/** The editor's fields as the API takes them — the first number is the primary. */
export function contactBodyOf(
  fields: ContactFields,
): ApiContactCreate & ApiContactChange {
  return {
    first_name: fields.firstName,
    last_name: fields.lastName,
    phones: fields.phones.map((entry, index) => ({
      phone: entry.phone,
      is_primary: index === 0,
      is_on_whatsapp: entry.isOnWhatsapp,
    })),
    instagram_handles: fields.instagramHandles,
    default_channel: fields.defaultChannel,
    preference_tags: fields.preferenceTags,
  };
}
