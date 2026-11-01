import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { WEEK } from '@/shared/api/app/app-week.ts';
import type { BranchHours } from '@/shared/app/branch-hours.ts';
import {
  type AppIcon,
  Bell,
  Building,
  Calendar,
  FileIcon,
  InstagramMark,
  Package,
  Receipt,
  SquareCheck,
} from '@/shared/icons/index.ts';

/**
 * The showcase's namespace — `auth` — read from the registry: importing
 * `AUTH_NS` would pull the first-paint auth constants into this lazy chunk's
 * graph and re-split them.
 */
export const AUTH_SHOWCASE_NS = I18N_NAMESPACES.auth;

/**
 * One of the tour's eight chapters: the seven in the order one patient meets the clinic, then
 * Branches, the clinic it all happens in.
 */
export type TourChapterId =
  | 'leads'
  | 'appointments'
  | 'frontDesk'
  | 'patientFile'
  | 'treatment'
  | 'payments'
  | 'tasks'
  | 'branches';

/** A chapter's narration keys: the room it happens in, a headline, one line. */
function chapterKeys<Id extends TourChapterId>(id: Id) {
  return {
    room: `showcase.chapters.${id}.room`,
    title: `showcase.chapters.${id}.title`,
    body: `showcase.chapters.${id}.body`,
  } as const;
}

/**
 * The showcase's keys in the `auth` namespace (`showcase.*`). Kept here, not in
 * `AUTH_KEYS`: that table rides the first-paint chunk, and these belong to the
 * lazily loaded auth layout (the bundle budget's ratchet).
 */
export const AUTH_SHOWCASE_KEYS = {
  kicker: 'showcase.kicker',
  title: 'showcase.title',
  privacy: 'showcase.privacy',
  tour: {
    steps: 'showcase.tour.steps',
    step: 'showcase.tour.step',
    pause: 'showcase.tour.pause',
    play: 'showcase.tour.play',
  },
  chapters: {
    leads: chapterKeys('leads'),
    appointments: chapterKeys('appointments'),
    appointmentsTomorrow: 'showcase.chapters.appointments.titleTomorrow',
    appointmentsLater: 'showcase.chapters.appointments.titleLater',
    frontDesk: chapterKeys('frontDesk'),
    patientFile: chapterKeys('patientFile'),
    treatment: chapterKeys('treatment'),
    payments: chapterKeys('payments'),
    tasks: chapterKeys('tasks'),
    branches: chapterKeys('branches'),
  },
  sheet: {
    label: 'showcase.sheet.label',
    today: 'showcase.sheet.today',
    tomorrow: 'showcase.sheet.tomorrow',
    live: 'showcase.sheet.live',
    closed: 'showcase.sheet.closed',
    tabs: {
      all: 'showcase.sheet.tabs.all',
      waiting: 'showcase.sheet.tabs.waiting',
      withDoctor: 'showcase.sheet.tabs.withDoctor',
      inTreatment: 'showcase.sheet.tabs.inTreatment',
      done: 'showcase.sheet.tabs.done',
    },
    openSlot: 'showcase.sheet.openSlot',
    freeToday: 'showcase.sheet.freeToday',
    freeTomorrow: 'showcase.sheet.freeTomorrow',
    freeLater: 'showcase.sheet.freeLater',
    allBranches: 'showcase.sheet.allBranches',
    /** A branch's state on the viewer's clock, as its sheet in the deck reads it. */
    branchState: {
      open: 'showcase.sheet.branchState.open',
      opensToday: 'showcase.sheet.branchState.opensToday',
      opensTomorrow: 'showcase.sheet.branchState.opensTomorrow',
      opensLater: 'showcase.sheet.branchState.opensLater',
    },
    visits: {
      hairLoss: 'showcase.sheet.visits.hairLoss',
      acneScars: 'showcase.sheet.visits.acneScars',
      peelFirst: 'showcase.sheet.visits.peelFirst',
      peelSecond: 'showcase.sheet.visits.peelSecond',
      laser: 'showcase.sheet.visits.laser',
      botox: 'showcase.sheet.visits.botox',
      hydrafacial: 'showcase.sheet.visits.hydrafacial',
    },
    status: {
      open: 'showcase.sheet.status.open',
      booked: 'showcase.sheet.status.booked',
      waitingFor: 'showcase.sheet.status.waitingFor',
      checkedIn: 'showcase.sheet.status.checkedIn',
      withDoctor: 'showcase.sheet.status.withDoctor',
      inTreatment: 'showcase.sheet.status.inTreatment',
      paid: 'showcase.sheet.status.paid',
      followUp: 'showcase.sheet.status.followUp',
    },
  },
  lens: {
    leads: {
      message: 'showcase.lens.leads.message',
      newLead: 'showcase.lens.leads.newLead',
      added: 'showcase.lens.leads.added',
    },
    appointments: {
      doctorToday: 'showcase.lens.appointments.doctorToday',
      doctorTomorrow: 'showcase.lens.appointments.doctorTomorrow',
      doctorLater: 'showcase.lens.appointments.doctorLater',
      length: 'showcase.lens.appointments.length',
      earliest: 'showcase.lens.appointments.earliest',
    },
    frontDesk: {
      notified: 'showcase.lens.frontDesk.notified',
      waiting: 'showcase.lens.frontDesk.waiting',
      live: 'showcase.lens.frontDesk.live',
    },
    patientFile: {
      file: 'showcase.lens.patientFile.file',
      notes: 'showcase.lens.patientFile.notes',
      photos: 'showcase.lens.patientFile.photos',
      prescription: 'showcase.lens.patientFile.prescription',
      line: 'showcase.lens.patientFile.line',
    },
    treatment: {
      package: 'showcase.lens.treatment.package',
      used: 'showcase.lens.treatment.used',
      next: 'showcase.lens.treatment.next',
    },
    payments: {
      bill: 'showcase.lens.payments.bill',
      consultation: 'showcase.lens.payments.consultation',
      session: 'showcase.lens.payments.session',
      nothingDue: 'showcase.lens.payments.nothingDue',
    },
    tasks: {
      title: 'showcase.lens.tasks.title',
      due: 'showcase.lens.tasks.due',
      call: 'showcase.lens.tasks.call',
      when: 'showcase.lens.tasks.when',
      reminder: 'showcase.lens.tasks.reminder',
    },
    branches: {
      title: 'showcase.lens.branches.title',
      openNow: 'showcase.lens.branches.openNow',
      everyDay: 'showcase.lens.branches.everyDay',
      days: 'showcase.lens.branches.days',
      oneFile: 'showcase.lens.branches.oneFile',
    },
  },
} as const;

/** The showcase's test ids. */
export const AUTH_SHOWCASE_TEST_IDS = {
  stage: 'auth-showcase',
  tour: 'auth-showcase-tour',
  step: (index: number) => `auth-showcase-step-${index}`,
  toggle: 'auth-showcase-toggle',
  narration: 'auth-showcase-narration',
  sheet: 'auth-showcase-sheet',
  story: 'auth-showcase-story',
  lens: 'auth-showcase-lens',
  privacy: 'auth-showcase-privacy',
} as const;

/** One chapter: the room's tone (`SECTION_TONES`) and the lens's icon. */
export interface TourChapter {
  id: TourChapterId;
  tone: Tone;
  icon: AppIcon;
}

/**
 * The tour's chapters, each in the tone of the room it happens in: Leads lav ·
 * Appointments sky · Front desk butter · Patient file blush · Treatment sage ·
 * Payments peach · Tasks plum · Branches stone.
 */
export const TOUR_CHAPTERS: readonly TourChapter[] = [
  { id: 'leads', tone: 'lav', icon: InstagramMark },
  { id: 'appointments', tone: 'sky', icon: Calendar },
  { id: 'frontDesk', tone: 'butter', icon: Bell },
  { id: 'patientFile', tone: 'blush', icon: FileIcon },
  { id: 'treatment', tone: 'sage', icon: Package },
  { id: 'payments', tone: 'peach', icon: Receipt },
  { id: 'tasks', tone: 'plum', icon: SquareCheck },
  { id: 'branches', tone: 'stone', icon: Building },
];

/** How long a chapter plays before the next. */
export const TOUR_CHAPTER_MS = 5200;
/** The last chapter's extra rest before the tour ends its round. */
export const TOUR_END_REST_MS = 2400;
/** Below this share of the stage on screen (a phone scrolled to the form), the tour holds. */
export const TOUR_VISIBLE_SHARE = 0.35;

/** A member of the illustrated team: initials, a name and their tone. */
export interface TourStaff {
  initials: string;
  name: string;
  tone: Tone;
}

/**
 * The illustrated clinic's team. Names, not copy: they read the same in every
 * language, like the patients' (the tour's people are fictional).
 */
export const TOUR_STAFF = {
  mehta: { initials: 'AM', name: 'Dr. Mehta', tone: 'lav' },
  iyer: { initials: 'RI', name: 'Dr. Iyer', tone: 'sky' },
  neha: { initials: 'NK', name: 'Neha K.', tone: 'sage' },
  desk: { initials: 'SD', name: 'Sara D.', tone: 'peach' },
} as const satisfies Record<string, TourStaff>;

/** The patient the tour follows. */
export const TOUR_PATIENT = { name: 'Riya Sharma', initials: 'RS' } as const;

/** One of the illustrated clinic's branches. */
export type TourBranchId = 'adajan' | 'vesu' | 'varachha';

/** A branch of the illustrated clinic: its name, its tone and its hours. */
export interface TourBranch {
  id: TourBranchId;
  /** A place's name, not copy: it reads the same in every language. */
  name: string;
  tone: Tone;
  /** Its own hours; null for Riya's branch, which keeps this device's (`rememberedBranchHours`). */
  hours: BranchHours | null;
}

/**
 * The illustrated clinic's branches — the demo clinic's Surat branches. Adajan, the main one,
 * opens every day, 09:00–21:00; Vesu, Riya's branch, keeps the hours this device last worked in;
 * Varachha opens Tuesday to Sunday, 11:00–19:00.
 */
export const TOUR_BRANCHES = {
  adajan: {
    id: 'adajan',
    name: 'Adajan',
    tone: 'sage',
    hours: { opensAt: '09:00', closesAt: '21:00', workingDays: WEEK },
  },
  vesu: { id: 'vesu', name: 'Vesu', tone: 'sky', hours: null },
  varachha: {
    id: 'varachha',
    name: 'Varachha',
    tone: 'butter',
    hours: {
      opensAt: '11:00',
      closesAt: '19:00',
      workingDays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    },
  },
} as const satisfies Readonly<Record<TourBranchId, TourBranch>>;

/** The branches in the header picker's order: the main one first. */
export const TOUR_BRANCH_ORDER: readonly TourBranchId[] = ['adajan', 'vesu', 'varachha'];

/** Riya's branch: the sheet of the seven chapters before Branches, in this device's hours. */
export const TOUR_HOME_BRANCH: TourBranchId = 'vesu';

/** A visit status: its tone and the key for its label. */
export type TourStatus = keyof (typeof AUTH_SHOWCASE_KEYS)['sheet']['status'];

/** The statuses' tones (the Today lanes'). `open` is the dashed free-slot pill. */
export const TOUR_STATUS_TONES: Readonly<Record<Exclude<TourStatus, 'open'>, Tone>> = {
  booked: 'sky',
  waitingFor: 'butter',
  checkedIn: 'butter',
  withDoctor: 'blush',
  inTreatment: 'sage',
  paid: 'peach',
  followUp: 'plum',
};

/** One of the other visits on the sheet: minutes from the base row, and who. */
export interface TourVisit {
  at: number;
  patient: string;
  visit: keyof (typeof AUTH_SHOWCASE_KEYS)['sheet']['visits'];
  staff: keyof typeof TOUR_STAFF;
  /** Its status while the clinic is open; after hours every visit is booked. */
  status: TourStatus;
  /** The branch it is booked at — named on its row once the sheet shows every branch. */
  branch: TourBranchId;
}

/** The visit before Riya's slot: the row the now line sits under. */
export const TOUR_VISITS_BEFORE: readonly TourVisit[] = [
  {
    at: -15,
    patient: 'Kabir Shah',
    visit: 'hairLoss',
    staff: 'mehta',
    status: 'withDoctor',
    branch: 'adajan',
  },
];
/** The four visits after Riya's slot, a quarter hour apart. */
export const TOUR_VISITS_AFTER: readonly TourVisit[] = [
  {
    at: 30,
    patient: 'Meera Pillai',
    visit: 'peelSecond',
    staff: 'neha',
    status: 'waitingFor',
    branch: 'vesu',
  },
  {
    at: 45,
    patient: 'Sana Qureshi',
    visit: 'laser',
    staff: 'neha',
    status: 'booked',
    branch: 'varachha',
  },
  {
    at: 60,
    patient: 'Vikram Joshi',
    visit: 'botox',
    staff: 'iyer',
    status: 'booked',
    branch: 'adajan',
  },
  {
    at: 75,
    patient: 'Isha Kapoor',
    visit: 'hydrafacial',
    staff: 'neha',
    status: 'booked',
    branch: 'vesu',
  },
];

/** Riya's row at each chapter: the sum of every chapter so far. */
export interface TourStory {
  /** Still a free slot (the enquiry has not booked yet). */
  open: boolean;
  visit: TourVisit['visit'];
  staff: keyof typeof TOUR_STAFF;
  status: TourStatus;
}

/**
 * Riya's row as each chapter leaves it: an open slot (Leads), booked with Dr.
 * Iyer, checked in, with the doctor, into her first peel session with Neha,
 * paid, and a follow-up set — still set when the sheet shows every branch.
 */
export const TOUR_STORY: Readonly<Record<TourChapterId, TourStory>> = {
  leads: { open: true, visit: 'acneScars', staff: 'iyer', status: 'open' },
  appointments: { open: false, visit: 'acneScars', staff: 'iyer', status: 'booked' },
  frontDesk: { open: false, visit: 'acneScars', staff: 'iyer', status: 'checkedIn' },
  patientFile: { open: false, visit: 'acneScars', staff: 'iyer', status: 'withDoctor' },
  treatment: { open: false, visit: 'peelFirst', staff: 'neha', status: 'inTreatment' },
  payments: { open: false, visit: 'peelFirst', staff: 'neha', status: 'paid' },
  tasks: { open: false, visit: 'peelFirst', staff: 'neha', status: 'followUp' },
  branches: { open: false, visit: 'peelFirst', staff: 'neha', status: 'followUp' },
};

/**
 * The lane counts above the rows at each chapter — Waiting, With doctor, In
 * treatment, Done — as Riya moves through them; at Branches, every branch's.
 * After hours every lane is 0.
 */
export const TOUR_LANE_COUNTS: Readonly<
  Record<TourChapterId, readonly [number, number, number, number]>
> = {
  leads: [1, 1, 0, 6],
  appointments: [1, 1, 0, 6],
  frontDesk: [2, 1, 0, 6],
  patientFile: [1, 2, 0, 6],
  treatment: [1, 1, 1, 6],
  payments: [1, 1, 0, 7],
  tasks: [1, 1, 0, 7],
  branches: [3, 3, 1, 19],
};

/** The day's visit count on the "All" tab: Riya's branch's, and every branch's (Branches). */
export const TOUR_VISITS_TODAY = { branch: 18, everyBranch: 46 } as const;
/** Riya's bill, in rupees: the consultation and the first peel session. */
export const TOUR_BILL = { consultation: 1000, session: 3500 } as const;
/** Her package: sessions in it. */
export const TOUR_PACKAGE_SESSIONS = 4;
