import type { Gender, Tone } from '@/shared/api/app/app-schema.ts';

/** What the card reads (D32 — there is no Contact entity): a Patient, a Lead or a MedicalContact. */
export type ContactKind = 'patient' | 'lead' | 'contact';

/** One way to reach the person. Phones are stored E.164; the first phone is the primary. */
export type ContactReach =
  | { channel: 'whatsapp' | 'phone'; phone: string }
  | { channel: 'instagram'; handle: string };

/** A team member already on this person (28px chips). */
export interface ContactTeamMember {
  id: string;
  name: string;
  initials?: string;
  tone: Tone;
  /** The member's role, as shown ("Doctor", "Front desk"). */
  role: string;
}

/** The latest of the person's reviews and how many there are. */
export interface ContactReviews {
  count: number;
  latestRating: number;
  latestSource: string;
  /** ISO instant of the latest review. */
  latestAt: string;
}

/** The About rows — each is shown only when known. */
export interface ContactAbout {
  gender?: Gender | null;
  age?: number | null;
  language?: string | null;
  area?: string | null;
  household?: string | null;
  /** The lead source, as shown ("Instagram", "Walk-in"). */
  source?: string | null;
  /** Open credits in integer paise: what the clinic owes them, what they owe the clinic. */
  owedToThem?: number;
  owedByThem?: number;
  reviews?: ContactReviews | null;
  /** The three consent chips (the schema keeps one `consentGiven`; Appendix F). */
  consent?: { data: boolean; photos: boolean; marketing: boolean } | null;
}

/** Everything the contact card shows (the schema's `contactCard` read, S:1566). */
export interface ContactCardData {
  kind: ContactKind;
  name: string;
  /** Defaults to the name's initials. */
  initials?: string;
  /** The patient's display id ("#3508"), shown in the tone ink. */
  displayId?: string | null;
  /** ISO instant: when they became a patient or contact — for a lead, when the lead came in. */
  since?: string | null;
  /** The record's tags — the card shows the first two. */
  tags?: readonly string[];
  reach: readonly ContactReach[];
  team?: readonly ContactTeamMember[];
  about?: ContactAbout;
}

/** Actions the card offers; each shows only when its handler is given (permission-limited rooms omit them). */
export interface ContactCardActions {
  /** The name links to the patient file ("↗"), for a patient. */
  onOpenPatientFile?: () => void;
  /** "Edit contact" — edits the Patient, Lead or MedicalContact the card read. */
  onEditContact?: () => void;
  /** "Change contact" — inside forms only. */
  onChangeContact?: () => void;
  /** "Open · Claim" — when an open lead with this person can be claimed. */
  onClaim?: () => void;
  /** "+ Lead" → `/leads/create?name=&phone=`. */
  onNewLead?: () => void;
  /** "+ Appointment" → `/appointments/create?who=`. */
  onNewAppointment?: () => void;
  /** "+ Patient" — offered only when the person is not a patient yet. */
  onNewPatient?: () => void;
}

/** Each kind's tone: patients sage, leads lav, medical contacts mint (H:5692). */
export const KIND_TONE: Readonly<Record<ContactKind, Tone>> = {
  patient: 'sage',
  lead: 'lav',
  contact: 'mint',
};

/** The header tint: a patient's sage tint, a lead's lav tint, else the canvas (KICKOFF §6.0). */
export const KIND_TINT: Readonly<Record<ContactKind, string>> = {
  patient: 'bg-tone-sage-tint',
  lead: 'bg-tone-lav-tint',
  contact: 'bg-canvas',
};

/** A 28px ghost icon button, as the card header and the reach rows draw them. */
export const ICON_ACTION =
  'text-muted-foreground hover:bg-muted hover:text-foreground size-7 rounded-lg';
