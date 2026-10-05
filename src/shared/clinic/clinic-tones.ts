import type { InvoiceStatus } from '@/shared/api/clinic/clinic-money.ts';
import type {
  AppointmentStatus,
  CheckinFeel,
  CheckinFollowed,
  CreditDirection,
  CreditStatus,
  ExpenseCategory,
  Gender,
  ImageAlbum,
  InvoiceType,
  LeadInterest,
  LeadStatus,
  OfferingCategory,
  OfferKind,
  PatientConversion,
  PatientStatus,
  PatientType,
  PaymentKind,
  PaymentMode,
  ReviewSource,
  Role,
  Section,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { LeadRecordSource } from '@/shared/api/clinic/leads-contracts.ts';
import type { OfferState } from '@/shared/api/clinic/offerings-contracts.ts';

/** Each clinic section's tone — one per section, never shared (`shell.md:42`). */
export const SECTION_TONES: Readonly<Record<Section, Tone>> = {
  today: 'butter',
  leads: 'lav',
  appointments: 'sky',
  patients: 'sage',
  medical: 'blush',
  stock: 'mint',
  payments: 'peach',
  tasks: 'plum',
  offerings: 'lime',
  users: 'slate',
};

/**
 * Each clinic role's tone — the prototype's seven (H:3565) plus the two the
 * plan adds: Owner slate and Marketing plum (no tone in the design; AMBER).
 */
export const ROLE_TONES: Readonly<Record<Role, Tone>> = {
  admin: 'lav',
  doctor: 'sky',
  therapist: 'butter',
  front_desk: 'mint',
  counsellor: 'sage',
  pharmacist: 'blush',
  accountant: 'peach',
  owner: 'slate',
  marketing: 'plum',
};

/**
 * Each appointment status's tone (`AP_ST`, H:3420): Scheduled butter, Confirmed
 * sky, Checked in lav, Completed sage, Cancelled stone, No show blush.
 */
export const APPOINTMENT_STATUS_TONES: Readonly<Record<AppointmentStatus, Tone>> = {
  scheduled: 'butter',
  confirmed: 'sky',
  checked_in: 'lav',
  completed: 'sage',
  cancelled: 'stone',
  no_show: 'blush',
};

/** Each photo album's tone (H:4526): General stone, Private lav, LHR blush. */
export const IMAGE_ALBUM_TONES: Readonly<Record<ImageAlbum, Tone>> = {
  general: 'stone',
  private: 'lav',
  lhr: 'blush',
};

/**
 * Each patient type's tone (`PT_TYPES`, H:3655; `patients.md:28`): Aesthetic
 * lav, Clinical sky, LHR blush, Dental mint, Physio sage, Gynac butter.
 */
export const PATIENT_TYPE_TONES: Readonly<Record<PatientType, Tone>> = {
  aesthetic: 'lav',
  clinical: 'sky',
  lhr: 'blush',
  dental: 'mint',
  physio: 'sage',
  gynac: 'butter',
};

/** Each patient status's tone (`PT_STAT`): New sky, Regular lav, VIP butter, Inactive stone. */
export const PATIENT_STATUS_TONES: Readonly<Record<PatientStatus, Tone>> = {
  new: 'sky',
  regular: 'lav',
  vip: 'butter',
  inactive: 'stone',
};

/** Each conversion's tone (`PT_CONV`): "T-Converted" sage, "T-Not converted" stone. */
export const PATIENT_CONVERSION_TONES: Readonly<Record<PatientConversion, Tone>> = {
  converted: 'sage',
  not_converted: 'stone',
};

/**
 * Each gender's tone: Female blush, Male sky, Other stone — the list's badge and
 * the drawer's chips alike (the quick-add's lav "Other" loses, §6.5).
 */
export const GENDER_TONES: Readonly<Record<Gender, Tone>> = {
  female: 'blush',
  male: 'sky',
  other: 'stone',
};

/**
 * Each lead status's tone (`LSTAT`, H:3346): New sky, Contacted lav, Follow-up
 * butter, Clinic visited sage, No response and Invalid stone, Not interested
 * and Lost blush — the status pills, the row's 3px edge and the progress
 * track. A re-target lead still New ("Re-targeted") keeps New's sky.
 */
export const LEAD_STATUS_TONES: Readonly<Record<LeadStatus, Tone>> = {
  new: 'sky',
  contacted: 'lav',
  follow_up: 'butter',
  clinic_visited: 'sage',
  no_response: 'stone',
  not_interested: 'blush',
  invalid: 'stone',
  lost: 'blush',
};

/**
 * Each lead source's tone (`LSRC` / `SRC_SK`, H:3348, H:3360) and the plan's
 * "Phone call", sky like its `Phone` icon (Q-L6, AMBER A-L4).
 */
export const LEAD_SOURCE_TONES: Readonly<Record<LeadRecordSource, Tone>> = {
  instagram: 'blush',
  google: 'butter',
  whatsapp: 'sage',
  facebook: 'sky',
  walk_in: 'lav',
  referral: 'mint',
  retarget: 'mint',
  phone_call: 'sky',
};

/**
 * Each interest's tone (`INTK`, H:3358). An interest typed into "Add
 * interest" takes {@link toneForLabel}.
 */
export const LEAD_INTEREST_TONES: Readonly<Record<LeadInterest, Tone>> = {
  others: 'stone',
  clinical: 'sky',
  peel: 'butter',
  lhr: 'lav',
  hydrafacial: 'mint',
  prp: 'blush',
};

/**
 * Each offering category's tone (`OF_CATS`, H:3546): Consultation sky,
 * Treatment sage, Package lav, LHR blush, Product butter — the Offerings
 * table's pill, the drawers' chips and the invoice line picker's groups.
 */
export const OFFERING_CATEGORY_TONES: Readonly<Record<OfferingCategory, Tone>> = {
  consultation: 'sky',
  treatment: 'sage',
  package: 'lav',
  lhr: 'blush',
  product: 'butter',
};

/**
 * Each offer kind's tone (`OFX_KINDS`, H:3580): "% off" lav, "₹ off" sky,
 * "Fixed price" butter, "Extra sessions" sage — the Offer drawer's Type chips.
 */
export const OFFER_KIND_TONES: Readonly<Record<OfferKind, Tone>> = {
  percent: 'lav',
  amount: 'sky',
  fixed: 'butter',
  extra: 'sage',
};

/**
 * Each derived offer state's tone (`ST_T`, H:5474): Running sage, Scheduled
 * sky, Paused butter, Ended stone.
 */
export const OFFER_STATE_TONES: Readonly<Record<OfferState, Tone>> = {
  live: 'sage',
  scheduled: 'sky',
  paused: 'butter',
  ended: 'stone',
};

/**
 * Each payment mode's tone (`PY_MODES`, H:3612): Cash butter, UPI sage, Card
 * sky — and Credit, a credit used on a bill, lav (the credit's "Adjusted"; no
 * mode tone in the design, AMBER).
 */
export const PAYMENT_MODE_TONES: Readonly<Record<PaymentMode, Tone>> = {
  cash: 'butter',
  upi: 'sage',
  card: 'sky',
  credit: 'lav',
};

/**
 * Each ledger entry's What pill (`payments.md:29`, H:5097): a receipt is
 * "Received" sage, a refund "Paid" blush, an expense or a supplier bill "Paid"
 * butter, money back "Received" stone; an Undo (not in launch, Q-G10) stone.
 */
export const PAYMENT_KIND_TONES: Readonly<Record<PaymentKind, Tone>> = {
  receipt: 'sage',
  refund: 'blush',
  expense: 'butter',
  supplier_bill: 'butter',
  money_back: 'stone',
  reversal: 'stone',
};

/**
 * Each expense category's tone (`EX_CATS`, H:3691; `payments.md:118`):
 * Medicines blush, Consumables mint, Salary lav, Rent sky, Marketing blush,
 * Utilities butter, Maintenance sage, Misc stone.
 */
export const EXPENSE_CATEGORY_TONES: Readonly<Record<ExpenseCategory, Tone>> = {
  medicines: 'blush',
  consumables: 'mint',
  salary: 'lav',
  rent: 'sky',
  marketing: 'blush',
  utilities: 'butter',
  maintenance: 'sage',
  misc: 'stone',
};

/** Each invoice type's tone (`PY_TYPES`; `payments.md:136`): Clinic sky, Medical sage, Consultation lav. */
export const INVOICE_TYPE_TONES: Readonly<Record<InvoiceType, Tone>> = {
  clinic: 'sky',
  medical: 'sage',
  consultation: 'lav',
};

/** An invoice status's pill (`pyStatus`, H:3633): Paid sage, Partly paid butter, Due blush. */
export const INVOICE_STATUS_TONES: Readonly<Record<InvoiceStatus, Tone>> = {
  paid: 'sage',
  partial: 'butter',
  unpaid: 'blush',
};

/** Which way a credit goes (`payments.md:45`): Give blush, Take sky. */
export const CREDIT_DIRECTION_TONES: Readonly<Record<CreditDirection, Tone>> = {
  give: 'blush',
  take: 'sky',
};

/**
 * Each credit state's pill (`payments.md:45`): Open sky, Returned and Received
 * sage, Adjusted lav — the stored `credit_status` shown with the design's
 * labels (D22).
 */
export const CREDIT_STATUS_TONES: Readonly<Record<CreditStatus, Tone>> = {
  open: 'sky',
  given_back: 'sage',
  got_back: 'sage',
  used: 'lav',
};

/**
 * How a check-in compares with the last visit (`CK_FEEL`, H:3680; `patient-file.md:175`):
 * Much better sage, Better mint, Same stone, Worse blush.
 */
export const CHECKIN_FEEL_TONES: Readonly<Record<CheckinFeel, Tone>> = {
  much_better: 'sage',
  better: 'mint',
  same: 'stone',
  worse: 'blush',
};

/** Whether the advice was followed (`CK_FOL`, H:3680): Fully sage, Mostly mint, Partly butter, Not at all blush. */
export const CHECKIN_FOLLOWED_TONES: Readonly<Record<CheckinFollowed, Tone>> = {
  fully: 'sage',
  mostly: 'mint',
  partly: 'butter',
  not_at_all: 'blush',
};

/**
 * Where a review was left (`RV_SRC`, H:3684; the Feedback card's type chips):
 * Google butter, Video lav, Instagram blush, Feedback form sky, WhatsApp sage.
 */
export const REVIEW_SOURCE_TONES: Readonly<Record<ReviewSource, Tone>> = {
  google: 'butter',
  video: 'lav',
  instagram: 'blush',
  internal_form: 'sky',
  whatsapp: 'sage',
};

/** The utility classes one tone paints with. */
export interface ToneClasses {
  /** The tone background. */
  bg: string;
  /** Text in the tone's ink. */
  ink: string;
  /** Background and ink together — a tinted surface. */
  surface: string;
  /** Selected: an ink fill with `background` text. */
  fill: string;
  /** The tone's line colour. */
  border: string;
  /** The dot colour (the same in both modes). */
  dot: string;
  /** A status dot's 3px halo. */
  halo: string;
  /** A selected chip's 1px ring in ink. */
  ring: string;
  /** The tab-tint hover: the tone at 45% and an inset 1px ink ring at 16%. */
  hover: string;
  /** A list row while it is the active (keyboard / pointer) row: the tone at 55%. */
  active: string;
  /** A picked list row: the tone at 70%. */
  picked: string;
  /**
   * A row's 3px inline-start status edge in the tone's ink (`border-s-3` on the
   * row): the preset's rule — "transparent unless a screen gives it a tone ink"
   * (`preset.md:192`) — and every room table's `bar` (H:4700, H:5108, H:5254,
   * H:5334, H:5464) and the calendar blocks' (H:5929).
   */
  edge: string;
  /**
   * The same edge in the tone's dot colour — the rows that the design paints
   * with the dot: Leads (H:5643), the Agenda (H:5913) and Tasks (H:4274).
   */
  edgeDot: string;
}

/**
 * Tone → classes, as full literals so Tailwind can see every one (a class built
 * as `bg-tone-${tone}` is never generated). Tone rules: KICKOFF §3.1.
 */
export const TONE_CLASSES: Readonly<Record<Tone, ToneClasses>> = {
  butter: {
    bg: 'bg-tone-butter',
    ink: 'text-tone-butter-foreground',
    surface: 'bg-tone-butter text-tone-butter-foreground',
    fill: 'bg-tone-butter-foreground text-background',
    border: 'border-tone-butter-border',
    dot: 'bg-tone-butter-dot',
    halo: 'ring-3 ring-tone-butter-dot/18',
    ring: 'ring-1 ring-tone-butter-foreground',
    hover:
      'hover:bg-tone-butter/45 hover:inset-ring hover:inset-ring-tone-butter-foreground/16',
    active: 'data-[selected=true]:bg-tone-butter/55',
    picked: 'bg-tone-butter/70',

    edge: 'border-s-tone-butter-foreground',
    edgeDot: 'border-s-tone-butter-dot',
  },
  lav: {
    bg: 'bg-tone-lav',
    ink: 'text-tone-lav-foreground',
    surface: 'bg-tone-lav text-tone-lav-foreground',
    fill: 'bg-tone-lav-foreground text-background',
    border: 'border-tone-lav-border',
    dot: 'bg-tone-lav-dot',
    halo: 'ring-3 ring-tone-lav-dot/18',
    ring: 'ring-1 ring-tone-lav-foreground',
    hover:
      'hover:bg-tone-lav/45 hover:inset-ring hover:inset-ring-tone-lav-foreground/16',
    active: 'data-[selected=true]:bg-tone-lav/55',
    picked: 'bg-tone-lav/70',

    edge: 'border-s-tone-lav-foreground',
    edgeDot: 'border-s-tone-lav-dot',
  },
  sky: {
    bg: 'bg-tone-sky',
    ink: 'text-tone-sky-foreground',
    surface: 'bg-tone-sky text-tone-sky-foreground',
    fill: 'bg-tone-sky-foreground text-background',
    border: 'border-tone-sky-border',
    dot: 'bg-tone-sky-dot',
    halo: 'ring-3 ring-tone-sky-dot/18',
    ring: 'ring-1 ring-tone-sky-foreground',
    hover:
      'hover:bg-tone-sky/45 hover:inset-ring hover:inset-ring-tone-sky-foreground/16',
    active: 'data-[selected=true]:bg-tone-sky/55',
    picked: 'bg-tone-sky/70',

    edge: 'border-s-tone-sky-foreground',
    edgeDot: 'border-s-tone-sky-dot',
  },
  sage: {
    bg: 'bg-tone-sage',
    ink: 'text-tone-sage-foreground',
    surface: 'bg-tone-sage text-tone-sage-foreground',
    fill: 'bg-tone-sage-foreground text-background',
    border: 'border-tone-sage-border',
    dot: 'bg-tone-sage-dot',
    halo: 'ring-3 ring-tone-sage-dot/18',
    ring: 'ring-1 ring-tone-sage-foreground',
    hover:
      'hover:bg-tone-sage/45 hover:inset-ring hover:inset-ring-tone-sage-foreground/16',
    active: 'data-[selected=true]:bg-tone-sage/55',
    picked: 'bg-tone-sage/70',

    edge: 'border-s-tone-sage-foreground',
    edgeDot: 'border-s-tone-sage-dot',
  },
  blush: {
    bg: 'bg-tone-blush',
    ink: 'text-tone-blush-foreground',
    surface: 'bg-tone-blush text-tone-blush-foreground',
    fill: 'bg-tone-blush-foreground text-background',
    border: 'border-tone-blush-border',
    dot: 'bg-tone-blush-dot',
    halo: 'ring-3 ring-tone-blush-dot/18',
    ring: 'ring-1 ring-tone-blush-foreground',
    hover:
      'hover:bg-tone-blush/45 hover:inset-ring hover:inset-ring-tone-blush-foreground/16',
    active: 'data-[selected=true]:bg-tone-blush/55',
    picked: 'bg-tone-blush/70',

    edge: 'border-s-tone-blush-foreground',
    edgeDot: 'border-s-tone-blush-dot',
  },
  mint: {
    bg: 'bg-tone-mint',
    ink: 'text-tone-mint-foreground',
    surface: 'bg-tone-mint text-tone-mint-foreground',
    fill: 'bg-tone-mint-foreground text-background',
    border: 'border-tone-mint-border',
    dot: 'bg-tone-mint-dot',
    halo: 'ring-3 ring-tone-mint-dot/18',
    ring: 'ring-1 ring-tone-mint-foreground',
    hover:
      'hover:bg-tone-mint/45 hover:inset-ring hover:inset-ring-tone-mint-foreground/16',
    active: 'data-[selected=true]:bg-tone-mint/55',
    picked: 'bg-tone-mint/70',

    edge: 'border-s-tone-mint-foreground',
    edgeDot: 'border-s-tone-mint-dot',
  },
  peach: {
    bg: 'bg-tone-peach',
    ink: 'text-tone-peach-foreground',
    surface: 'bg-tone-peach text-tone-peach-foreground',
    fill: 'bg-tone-peach-foreground text-background',
    border: 'border-tone-peach-border',
    dot: 'bg-tone-peach-dot',
    halo: 'ring-3 ring-tone-peach-dot/18',
    ring: 'ring-1 ring-tone-peach-foreground',
    hover:
      'hover:bg-tone-peach/45 hover:inset-ring hover:inset-ring-tone-peach-foreground/16',
    active: 'data-[selected=true]:bg-tone-peach/55',
    picked: 'bg-tone-peach/70',

    edge: 'border-s-tone-peach-foreground',
    edgeDot: 'border-s-tone-peach-dot',
  },
  plum: {
    bg: 'bg-tone-plum',
    ink: 'text-tone-plum-foreground',
    surface: 'bg-tone-plum text-tone-plum-foreground',
    fill: 'bg-tone-plum-foreground text-background',
    border: 'border-tone-plum-border',
    dot: 'bg-tone-plum-dot',
    halo: 'ring-3 ring-tone-plum-dot/18',
    ring: 'ring-1 ring-tone-plum-foreground',
    hover:
      'hover:bg-tone-plum/45 hover:inset-ring hover:inset-ring-tone-plum-foreground/16',
    active: 'data-[selected=true]:bg-tone-plum/55',
    picked: 'bg-tone-plum/70',

    edge: 'border-s-tone-plum-foreground',
    edgeDot: 'border-s-tone-plum-dot',
  },
  lime: {
    bg: 'bg-tone-lime',
    ink: 'text-tone-lime-foreground',
    surface: 'bg-tone-lime text-tone-lime-foreground',
    fill: 'bg-tone-lime-foreground text-background',
    border: 'border-tone-lime-border',
    dot: 'bg-tone-lime-dot',
    halo: 'ring-3 ring-tone-lime-dot/18',
    ring: 'ring-1 ring-tone-lime-foreground',
    hover:
      'hover:bg-tone-lime/45 hover:inset-ring hover:inset-ring-tone-lime-foreground/16',
    active: 'data-[selected=true]:bg-tone-lime/55',
    picked: 'bg-tone-lime/70',

    edge: 'border-s-tone-lime-foreground',
    edgeDot: 'border-s-tone-lime-dot',
  },
  slate: {
    bg: 'bg-tone-slate',
    ink: 'text-tone-slate-foreground',
    surface: 'bg-tone-slate text-tone-slate-foreground',
    fill: 'bg-tone-slate-foreground text-background',
    border: 'border-tone-slate-border',
    dot: 'bg-tone-slate-dot',
    halo: 'ring-3 ring-tone-slate-dot/18',
    ring: 'ring-1 ring-tone-slate-foreground',
    hover:
      'hover:bg-tone-slate/45 hover:inset-ring hover:inset-ring-tone-slate-foreground/16',
    active: 'data-[selected=true]:bg-tone-slate/55',
    picked: 'bg-tone-slate/70',

    edge: 'border-s-tone-slate-foreground',
    edgeDot: 'border-s-tone-slate-dot',
  },
  stone: {
    bg: 'bg-tone-stone',
    ink: 'text-tone-stone-foreground',
    surface: 'bg-tone-stone text-tone-stone-foreground',
    fill: 'bg-tone-stone-foreground text-background',
    border: 'border-tone-stone-border',
    dot: 'bg-tone-stone-dot',
    halo: 'ring-3 ring-tone-stone-dot/18',
    ring: 'ring-1 ring-tone-stone-foreground',
    hover:
      'hover:bg-tone-stone/45 hover:inset-ring hover:inset-ring-tone-stone-foreground/16',
    active: 'data-[selected=true]:bg-tone-stone/55',
    picked: 'bg-tone-stone/70',

    edge: 'border-s-tone-stone-foreground',
    edgeDot: 'border-s-tone-stone-dot',
  },
};

/** The six tones an untoned label hashes onto, in the design's order (H:3875). */
const HASHED_TONES: readonly Tone[] = ['sky', 'sage', 'lav', 'butter', 'blush', 'mint'];

/**
 * The tone of a label without one of its own: the design's string hash
 * (`x * 31 + code`, unsigned 32-bit) of the trimmed, lower-cased label, onto
 * sky · sage · lav · butter · blush · mint (H:3875). Stable, so a label keeps
 * its colour everywhere it appears.
 */
export function toneForLabel(label: string): Tone {
  let hash = 0;
  for (const char of label.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return HASHED_TONES[hash % HASHED_TONES.length] ?? 'stone';
}
