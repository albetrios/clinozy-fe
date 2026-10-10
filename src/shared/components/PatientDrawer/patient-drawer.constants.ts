import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The patient drawer's copy lives in `clinic`, not the room's `patients`: the
 * drawer is shared — the Patients room opens it, and the invoice and
 * appointment pickers stack it as quick-add (KICKOFF §6.5, Q-P2).
 */
export const PATIENT_DRAWER_NS = I18N_NAMESPACES.clinic;

/** Key paths for the patient drawer (`patients.md` › Copy, verbatim). */
export const PATIENT_DRAWER_KEYS = {
  title: { create: 'patientDrawer.title.create', edit: 'patientDrawer.title.edit' },
  sub: { full: 'patientDrawer.sub.full', quick: 'patientDrawer.sub.quick' },
  quickFill: {
    walkIn: 'patientDrawer.quickFill.walkIn',
    referred: 'patientDrawer.quickFill.referred',
    instagram: 'patientDrawer.quickFill.instagram',
    lhr: 'patientDrawer.quickFill.lhr',
  },
  steps: {
    contact: 'patientDrawer.steps.contact',
    clinic: 'patientDrawer.steps.clinic',
  },
  /** The 11px section labels inside the steps (H:894). */
  groups: {
    contact: 'patientDrawer.groups.contact',
    personal: 'patientDrawer.groups.personal',
    clinic: 'patientDrawer.groups.clinic',
    referral: 'patientDrawer.groups.referral',
  },
  fields: {
    firstName: 'patientDrawer.fields.firstName',
    lastName: 'patientDrawer.fields.lastName',
    mobile: 'patientDrawer.fields.mobile',
    mobileHint: 'patientDrawer.fields.mobileHint',
    phone2: 'patientDrawer.fields.phone2',
    phone2Hint: 'patientDrawer.fields.phone2Hint',
    address: 'patientDrawer.fields.address',
    addressPlaceholder: 'patientDrawer.fields.addressPlaceholder',
    homeBranch: 'patientDrawer.fields.homeBranch',
    gender: 'patientDrawer.fields.gender',
    birthDate: 'patientDrawer.fields.birthDate',
    /** "Age 28" — the Birth date's hint once a date is set. */
    age: 'patientDrawer.fields.age',
    types: 'patientDrawer.fields.types',
    typesHint: 'patientDrawer.fields.typesHint',
    status: 'patientDrawer.fields.status',
    conversion: 'patientDrawer.fields.conversion',
    referredBy: 'patientDrawer.fields.referredBy',
    referredByPlaceholder: 'patientDrawer.fields.referredByPlaceholder',
    referrerType: 'patientDrawer.fields.referrerType',
    followUp: 'patientDrawer.fields.followUp',
    followUpDate: 'patientDrawer.fields.followUpDate',
    followUpTime: 'patientDrawer.fields.followUpTime',
    notes: 'patientDrawer.fields.notes',
    notesPlaceholder: 'patientDrawer.fields.notesPlaceholder',
    consent: 'patientDrawer.fields.consent',
    consentHint: 'patientDrawer.fields.consentHint',
    photos: 'patientDrawer.fields.photos',
    photosHint: 'patientDrawer.fields.photosHint',
    photosDrop: 'patientDrawer.fields.photosDrop',
    /** "JPG or PNG · up to 10 MB each" (Q-P5: the one 10 MB limit). */
    photosLimit: 'patientDrawer.fields.photosLimit',
    photosRemove: 'patientDrawer.fields.photosRemove',
  },
  /** The Follow-up quick chips, computed from today (H:4716, §7.3). */
  followUpQuick: {
    tomorrow: 'patientDrawer.followUpQuick.tomorrow',
    week: 'patientDrawer.followUpQuick.week',
    twentyDays: 'patientDrawer.followUpQuick.twentyDays',
    month: 'patientDrawer.followUpQuick.month',
  },
  save: {
    create: 'patientDrawer.save.create',
    edit: 'patientDrawer.save.edit',
    createAnother: 'patientDrawer.save.createAnother',
  },
  /** "Add name and mobile" — Save with a required field still empty. */
  missing: 'patientDrawer.missing',
  /** "Enter a 10-digit mobile" — a mobile that is not ten digits from 6–9. */
  mobileInvalid: 'patientDrawer.mobileInvalid',
  /** "Patient #3509 created" (D28, Q-P6). */
  created: 'patientDrawer.created',
  openFile: 'patientDrawer.openFile',
  /** "Priya Shah saved". */
  saved: 'patientDrawer.saved',
  /** "Priya Shah registered as patient #3509", " · 2 photos filed" with photos (plural). */
  registered: 'patientDrawer.registered',
  registeredPhotos: 'patientDrawer.registeredPhotos',
  /** "Same mobile as Priya Shah · #3508" (Q-P7). */
  duplicate: 'patientDrawer.duplicate',
  /** Quick-add's action on the notice: the parent field takes the existing patient. */
  useExisting: 'patientDrawer.useExisting',
  /** "Riya Mehta is already in your contacts · the file opens on them". */
  knownPerson: 'patientDrawer.knownPerson',
  /** The footer summary with no name yet. */
  summaryEmpty: 'patientDrawer.summaryEmpty',
} as const;

/** The drawer's root test id (KICKOFF §6.5 Test ids); its parts derive theirs. */
export const PATIENT_DRAWER_TEST_ID = 'patient-drawer';

/** The quick-add child's root test id. */
export const PATIENT_QUICK_ADD_TEST_ID = 'patient-quick-add';
