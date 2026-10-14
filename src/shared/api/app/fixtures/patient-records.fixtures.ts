import { PROTOTYPE_SEED_DAY, seedCommon } from '@/shared/api/app/app-fixture-seed.ts';
import type {
  AftercareCall,
  BodyPart,
  CheckIn,
  CheckinFeel,
  CheckinFollowed,
  FeedbackAction,
  ImageAlbum,
  PatientImage,
  PatientNote,
  PatientPackage,
  PatientReport,
  Prescription,
  PrescriptionItem,
  ReportType,
  Review,
  ReviewSource,
  RxMeal,
  RxTiming,
  Treatment,
} from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';

import { offeringBySeq } from './offerings.fixtures.ts';
import { patientRef } from './patients.fixtures.ts';
import { must, ref, seedAt, seedDay } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

/** Where seeded files live: a reserved test host, never fetched for real. */
const FILES = 'https://files.clinozy.test';

// ── Prescriptions ──

/** `RX_WHEN` (H:3689) — a meal or a timing. */
const WHEN: Record<string, { meal: RxMeal | null; timing: RxTiming | null }> = {
  '': { meal: null, timing: null },
  'After meal': { meal: 'after', timing: null },
  'Before meal': { meal: 'before', timing: null },
  Morning: { meal: null, timing: 'morning' },
  Night: { meal: null, timing: 'night' },
  'Morning & night': { meal: null, timing: 'morning_night' },
  'Thrice a week': { meal: null, timing: 'thrice_week' },
};
const BODY_PARTS: Record<string, BodyPart> = {
  Face: 'face',
  Scalp: 'scalp',
  Chest: 'chest',
  Underarm: 'underarm',
  Legs: 'legs',
};

interface RxLine {
  name: string;
  /** "1-0-1" (morning-afternoon-night), blank, or "SOS". */
  dose: string;
  when: string;
  where: string;
  qty: number;
  remarks: string;
}

interface RxRow {
  seq: number;
  patient: string;
  date: string;
  doctor: StaffKey;
  advice: string;
  procedure: string;
  lines: readonly RxLine[];
  /** The visit it was written at. */
  visit: number | null;
  saved: string;
  by: StaffKey;
}

/**
 * `PT_RX` (H:3670–3671), verbatim, and Harsh Trivedi's Rx from Today's
 * pharmacy card ("3 medicines prescribed · Rx approved 10:05", H:3458) with the
 * medicines and directions the prototype gives it (`RXL` / `LAST_RX`
 * H:3328, H:3494). None of these names is in the store's catalogue, so
 * `medicineId` stays empty ("typed text not yet matched").
 */
const RX_ROWS: readonly RxRow[] = [
  {
    seq: 500,
    patient: 'Arpita Kachhadiya',
    date: '17 Sep 2026',
    doctor: 'DD',
    advice: '',
    procedure: '',
    lines: [
      {
        name: 'Flubolt 400',
        dose: '0-0-1',
        when: 'After meal',
        where: '',
        qty: 8,
        remarks: '1 sun, 1 thu',
      },
      {
        name: 'Clonix-B Lotion',
        dose: '',
        when: 'Morning & night',
        where: 'Scalp',
        qty: 1,
        remarks: '',
      },
      {
        name: 'Densyl-AD Shampoo',
        dose: '',
        when: 'Thrice a week',
        where: '',
        qty: 1,
        remarks: '',
      },
    ],
    visit: null,
    saved: 'Sep 17 · 11:38',
    by: 'DN',
  },
  {
    seq: 497,
    patient: 'Dharti Galani',
    date: '24 Sep 2026',
    doctor: 'DD',
    advice: 'Avoid sun 48h',
    procedure: 'Chemical peel',
    lines: [
      {
        name: 'Sunscreen SPF 50',
        dose: '1-1-0',
        when: 'Morning',
        where: 'Face',
        qty: 1,
        remarks: '',
      },
    ],
    visit: 2790,
    saved: 'Sep 24 · 15:10',
    by: 'RS',
  },
  {
    seq: 501,
    patient: 'Harsh Trivedi',
    date: 'Today',
    doctor: 'DN',
    advice: '',
    procedure: '',
    lines: [
      {
        name: 'Tretinoin 0.025% cream 20 g',
        dose: '0-0-1',
        when: 'Night',
        where: '',
        qty: 1,
        remarks: 'Thin layer at night · 8 weeks',
      },
      {
        name: 'Sunscreen SPF 50 gel 50 g',
        dose: '1-0-0',
        when: 'Morning',
        where: '',
        qty: 2,
        remarks: 'Reapply every 3 h outdoors · ongoing',
      },
      {
        name: 'Azelaic acid 15% gel 30 g',
        dose: '1-0-0',
        when: 'Morning',
        where: '',
        qty: 1,
        remarks: 'Morning on patches · 8 weeks',
      },
    ],
    visit: 2863,
    saved: 'Today · 10:05',
    by: 'DN',
  },
];

function rxItem(line: RxLine): PrescriptionItem {
  const sos = line.dose === 'SOS';
  const [morning = 0, afternoon = 0, night = 0] =
    line.dose && !sos ? line.dose.split('-').map(Number) : [];
  const when = must(WHEN[line.when], `Rx timing ${line.when}`);
  return {
    medicineId: null,
    medicineName: line.name,
    doseMorning: morning,
    doseAfternoon: afternoon,
    doseNight: night,
    sos,
    meal: when.meal,
    timing: when.timing,
    timingText: null,
    bodyPart: line.where ? must(BODY_PARTS[line.where], `body part ${line.where}`) : null,
    bodyPartText: null,
    qty: line.qty,
    remarks: line.remarks || null,
  };
}

export function prescriptionSeed(today: string = appToday()): Prescription[] {
  return RX_ROWS.map((row) => ({
    ...seedCommon(seedAt(row.saved, '12:00', today), staffRef(row.by)),
    id: ref.prescription(row.seq),
    seq: row.seq,
    patientId: patientRef(row.patient),
    appointmentId: row.visit === null ? null : ref.appointment(row.visit),
    doctorId: staffRef(row.doctor),
    date: seedDay(row.date, today),
    items: row.lines.map(rxItem),
    advice: row.advice || null,
    labReport: null,
    procedureToday: row.procedure || null,
    followUpDate: null,
  }));
}

// ── Treatments ──

/** `cb`: the aftercare call, in days after the session. */
const AFTERCARE: Record<number, AftercareCall> = {
  0: 'none',
  1: 'next_day',
  2: 'in_2_days',
};

interface TreatmentRow {
  key: number;
  patient: string;
  at: string;
  doctor: StaffKey;
  therapist: StaffKey;
  name: string;
  parts: readonly string[];
  session: number;
  callAfterDays: number;
  /** `p`, renamed to the contract's parameter keys; blanks dropped. */
  params: Record<string, string>;
  remark: string;
  offering: number | null;
  packageKey: number | null;
  visit: number | null;
}

/**
 * `PT_TR` (H:3672–3674), verbatim, and Dhruv's last laser session before today's.
 * Dharti's LHR session uses her LHR package.
 */
const TREATMENT_ROWS: readonly TreatmentRow[] = [
  {
    key: 505,
    patient: 'Varun Bhimani',
    at: '27 Sep 2026 · 12:30',
    doctor: 'DD',
    therapist: 'KP',
    name: 'Chemical peel · session 1',
    parts: ['Face'],
    session: 1,
    callAfterDays: 1,
    params: { type: 'Peel', skinType: 'Type IV', power: 'Glycolic 35% · 3 min' },
    remark: 'Mild tingling, settled in 10 min',
    offering: null,
    packageKey: null,
    visit: null,
  },
  {
    key: 502,
    patient: 'Varun Bhimani',
    at: '19 Aug 2026 · 10:40',
    doctor: 'DD',
    therapist: 'KP',
    name: 'Mole Removal Medium',
    parts: ['Chest'],
    session: 1,
    callAfterDays: 0,
    params: {
      type: 'Laser',
      skinType: 'Type III',
      machine: 'Mole laser',
      power: 'incision = power 1',
    },
    remark: '',
    offering: null,
    packageKey: null,
    visit: null,
  },
  {
    key: 498,
    patient: 'Dharti Galani',
    at: '24 Sep 2026 · 15:00',
    doctor: 'DD',
    therapist: 'KP',
    name: 'LHR Full Face',
    parts: ['Face'],
    session: 1,
    callAfterDays: 2,
    params: {
      type: 'Laser',
      skinType: 'Type IV',
      machine: 'Soprano Ice',
      power: '10 J · 3 Hz',
      wavelength: '810',
    },
    remark: 'Mild redness',
    offering: 268,
    packageKey: 1,
    visit: 2790,
  },
  // Today's treatment card is Dhruv's laser session (`CARDS` c9, H:3455): the
  // visit flow's "Repeat" takes his last session's settings
  // (`today.md:99–101`), from his LHR package (`PACKAGE_ROWS` key 4).
  {
    key: 506,
    patient: 'Dhruv Patel',
    at: '12 Sep 2026 · 10:20',
    doctor: 'DN',
    therapist: 'KP',
    name: 'Laser hair reduction',
    parts: ['Legs'],
    session: 3,
    // Its day-2 call was made at the time; no aftercare task is left open.
    callAfterDays: 0,
    params: {
      type: 'Laser',
      skinType: 'Type IV',
      machine: 'GentleMax',
      power: '18 J/cm²',
      wavelength: '755',
    },
    remark: 'Mild redness, settled in 1 day',
    offering: 267,
    packageKey: 4,
    visit: null,
  },
];

export function treatmentSeed(today: string = appToday()): Treatment[] {
  return TREATMENT_ROWS.map((row) => {
    const performedAt = seedAt(row.at, '12:00', today);
    return {
      ...seedCommon(performedAt, staffRef(row.therapist)),
      id: ref.treatment(row.key),
      patientId: patientRef(row.patient),
      appointmentId: row.visit === null ? null : ref.appointment(row.visit),
      offeringId: row.offering === null ? null : ref.offering(row.offering),
      name: row.name,
      template: 'skin',
      performedAt,
      doctorId: staffRef(row.doctor),
      therapistId: staffRef(row.therapist),
      bodyParts: row.parts.map((part) => must(BODY_PARTS[part], `body part ${part}`)),
      sessionNo: row.session,
      params: row.params,
      remark: row.remark || null,
      aftercareCall: must(AFTERCARE[row.callAfterDays], `aftercare ${row.callAfterDays}`),
      packageId: row.packageKey === null ? null : ref.patientPackage(row.packageKey),
    };
  });
}

// ── Photos and reports ──

const ALBUMS: Record<string, ImageAlbum> = {
  General: 'general',
  LHR: 'lhr',
  Private: 'private',
};

/** `PT_IMG` (H:3675) — [album, file, taken, patient, body part, visit, by]; parts are the seed's own list. */
const IMAGE_ROWS: readonly (readonly [
  album: string,
  file: string,
  taken: string,
  patient: string,
  part: string,
  visit: number | null,
  by: StaffKey,
])[] = [
  ['General', 'IMG_4974', '19 Aug 2026', 'Varun Bhimani', 'Chest', null, 'KP'],
  ['General', 'IMG_4961', '19 Aug 2026', 'Varun Bhimani', 'Chest', null, 'KP'],
  ['General', 'IMG_4963', '19 Aug 2026', 'Varun Bhimani', 'Chest', null, 'KP'],
  ['General', 'IMG_4960', '19 Aug 2026', 'Varun Bhimani', 'Chest', null, 'KP'],
  ['General', 'IMG_4958', '18 Aug 2026', 'Varun Bhimani', 'Face', 2702, 'DN'],
  ['General', 'IMG_4959', '18 Aug 2026', 'Varun Bhimani', 'Face', 2702, 'DN'],
  ['LHR', 'IMG_5102', '24 Sep 2026', 'Dharti Galani', 'Face', 2790, 'KP'],
  ['General', 'IMG_5100', '24 Sep 2026', 'Dharti Galani', 'Face', 2790, 'KP'],
  ['Private', 'IMG_5101', '24 Sep 2026', 'Dharti Galani', 'Underarm', 2790, 'KP'],
];

export function patientImageSeed(today: string = appToday()): PatientImage[] {
  return IMAGE_ROWS.map(([album, file, taken, patient, part, visit, by], index) => ({
    ...seedCommon(seedAt(taken, '12:00', today), staffRef(by)),
    id: ref.patientImage(index + 1),
    patientId: patientRef(patient),
    appointmentId: visit === null ? null : ref.appointment(visit),
    album: must(ALBUMS[album], `album ${album}`),
    fileUrl: `${FILES}/patient-images/${file}.jpg`,
    fileName: file,
    bodyPart: must(BODY_PARTS[part], `body part ${part}`),
    takenOn: seedDay(taken, today),
    caption: null,
  }));
}

const REPORT_TYPES: Record<string, ReportType> = {
  Lab: 'lab',
  Scan: 'scan',
  Consent: 'consent',
};

/** `PT_REP` (H:3676), verbatim. */
const REPORT_ROWS: readonly (readonly [
  key: number,
  patient: string,
  type: string,
  name: string,
  date: string,
  by: StaffKey,
])[] = [
  [1, 'Dharti Galani', 'Lab', 'CBC + Thyroid profile', '20 Sep 2026', 'RS'],
  [2, 'Dharti Galani', 'Consent', 'Chemical peel consent', '24 Sep 2026', 'RS'],
  [3, 'Varun Bhimani', 'Scan', 'Dermoscopy · chest mole', '18 Aug 2026', 'DN'],
];

export function patientReportSeed(today: string = appToday()): PatientReport[] {
  return REPORT_ROWS.map(([key, patient, type, name, date, by]) => ({
    ...seedCommon(seedAt(date, '12:00', today), staffRef(by)),
    id: ref.patientReport(key),
    patientId: patientRef(patient),
    type: must(REPORT_TYPES[type], `report type ${type}`),
    name,
    date: seedDay(date, today),
    files: [],
    notes: null,
  }));
}

// ── Packages and notes ──

export interface PackageRow {
  key: number;
  patient: string;
  offering: number;
  used: number;
  until: string;
  /** The invoice that sold it; `#787` is `PY_INV`'s, the other two are added (see money). */
  invoice: number;
  sold: string;
}

/**
 * `PT_PK` (H:3677), verbatim, and Dhruv's LHR pack. A package is made by invoicing its offering, so
 * each names its invoice; the sale date is `till` less the offering's validity.
 */
export const PACKAGE_ROWS: readonly PackageRow[] = [
  {
    key: 1,
    patient: 'Dharti Galani',
    offering: 268,
    used: 1,
    until: '24 Sep 2027',
    invoice: 787,
    sold: '24 Sep · 15:30',
  },
  {
    key: 2,
    patient: 'Dharti Galani',
    offering: 273,
    used: 2,
    until: '23 Mar 2027',
    invoice: 782,
    sold: '24 Sep · 15:45',
  },
  {
    key: 3,
    patient: 'Varun Bhimani',
    offering: 267,
    used: 3,
    until: '23 Aug 2027',
    invoice: 780,
    sold: '23 Aug · 12:30',
  },
  // Dhruv's LHR pack, sold on `PY_INV` #781 — today is its fourth session ("Session 4", H:3455).
  {
    key: 4,
    patient: 'Dhruv Patel',
    offering: 267,
    used: 3,
    until: '28 Aug 2027',
    invoice: 781,
    sold: '28 Aug · 17:15',
  },
];

export function patientPackageSeed(today: string = appToday()): PatientPackage[] {
  return PACKAGE_ROWS.map((row) => ({
    ...seedCommon(seedAt(row.sold, '12:00', today), staffRef('RS')),
    id: ref.patientPackage(row.key),
    patientId: patientRef(row.patient),
    offeringId: ref.offering(row.offering),
    invoiceId: ref.invoice(row.invoice),
    sessionsTotal: offeringBySeq(row.offering).sessions,
    sessionsUsed: row.used,
    validUntil: seedDay(row.until, today),
  }));
}

/** `PT_NOTES` (H:3678), verbatim. */
export function patientNoteSeed(today: string = appToday()): PatientNote[] {
  const notes: readonly (readonly [number, string, string])[] = [
    [1, '24 Sep · 15:39', 'Clinic visited'],
    [
      2,
      '24 Sep · 15:40',
      'Patient suggested the peel package, will decide after first session',
    ],
  ];
  return notes.map(([key, at, body]) => ({
    ...seedCommon(seedAt(at, '12:00', today), staffRef('RS')),
    id: ref.patientNote(key),
    patientId: patientRef('Dharti Galani'),
    body,
  }));
}

// ── Feedback ──

const FEELS: Record<string, CheckinFeel> = {
  'Much better': 'much_better',
  Better: 'better',
  Same: 'same',
  Worse: 'worse',
};
const FOLLOWED: Record<string, CheckinFollowed> = {
  Fully: 'fully',
  Mostly: 'mostly',
  Partly: 'partly',
  'Not at all': 'not_at_all',
};

/** `CK_SEED` (H:3681), verbatim. */
export function checkInSeed(today: string = appToday()): CheckIn[] {
  const rows = [
    {
      key: 1,
      visit: 2790,
      treatment: null,
      date: '24 Sep',
      at: '15:30',
      by: 'DD',
      context: 'Consultation',
      feel: 'Same',
      score: 6,
      followed: '',
      followedNote: 'First visit',
      now: 'Tanning on both cheeks, uneven tone',
      next: 'Start peel series · SPF 50 twice daily',
      nextOfferings: [274],
    },
    {
      key: 2,
      visit: null,
      treatment: 498,
      date: '26 Sep',
      at: '11:00',
      by: 'NK',
      context: 'Day-2 call after LHR',
      feel: 'Better',
      score: 7,
      followed: 'Mostly',
      followedNote: 'Missed sunscreen one afternoon',
      now: 'Mild redness settled, skin feels smoother',
      next: 'Continue the plan · next peel on 8 Oct',
      nextOfferings: [],
    },
  ] as const;
  return rows.map((row) => ({
    ...seedCommon(seedAt(`${row.date} · ${row.at}`, '12:00', today), staffRef(row.by)),
    id: ref.checkIn(row.key),
    patientId: patientRef('Dharti Galani'),
    appointmentId: row.visit === null ? null : ref.appointment(row.visit),
    treatmentId: row.treatment === null ? null : ref.treatment(row.treatment),
    context: row.context,
    feel: must(FEELS[row.feel], `feel ${row.feel}`),
    score: row.score,
    followed: row.followed
      ? must(FOLLOWED[row.followed], `followed ${row.followed}`)
      : null,
    followedNote: row.followedNote,
    now: row.now,
    nextPlan: row.next,
    nextOfferingIds: row.nextOfferings.map((seq) => ref.offering(seq)),
    byId: staffRef(row.by),
    date: seedDay(row.date, today),
  }));
}

/** `RV_SRC` (H:3684); "Internal form" is the contract's `internal_form`. */
const REVIEW_SOURCES: Record<string, ReviewSource> = {
  Google: 'google',
  Video: 'video',
  Instagram: 'instagram',
  'Internal form': 'internal_form',
  WhatsApp: 'whatsapp',
};

/** `RV_SEED` (H:3685), verbatim. */
export function reviewSeed(today: string = appToday()): Review[] {
  const rows = [
    {
      key: 1,
      patient: 'Dharti Galani',
      source: 'Google',
      rating: 5,
      text: 'Very gentle peel and the staff explained every step. Skin looks brighter already.',
      link: 'https://g.page/r/cresence-skin/review',
      files: [],
      date: '26 Sep',
      by: 'RS',
      visit: 2790,
    },
    {
      key: 2,
      patient: 'Rhea Shah',
      source: 'Video',
      rating: 5,
      text: 'Testimonial after laser session 3',
      link: '',
      files: ['rhea-testimonial.mp4'],
      date: '20 Sep',
      by: 'NK',
      visit: null,
    },
    {
      key: 3,
      patient: 'Meera Joshi',
      source: 'Internal form',
      rating: 3,
      text: 'Good result but waited 25 minutes past my slot.',
      link: '',
      files: [],
      date: PROTOTYPE_SEED_DAY,
      by: 'RS',
      visit: 2841,
    },
  ] as const;
  return rows.map((row) => ({
    ...seedCommon(seedAt(row.date, '18:00', today), staffRef(row.by)),
    id: ref.review(row.key),
    patientId: patientRef(row.patient),
    appointmentId: row.visit === null ? null : ref.appointment(row.visit),
    source: must(REVIEW_SOURCES[row.source], `review source ${row.source}`),
    rating: row.rating,
    text: row.text,
    link: row.link || null,
    files: row.files.map((file) => `${FILES}/reviews/${file}`),
    date: seedDay(row.date, today),
    byId: staffRef(row.by),
  }));
}

/** No feedback action is logged in the prototype (`fbAct` starts empty, H:4390). */
export function feedbackActionSeed(): FeedbackAction[] {
  return [];
}
