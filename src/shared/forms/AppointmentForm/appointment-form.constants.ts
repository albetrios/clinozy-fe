import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { AppointmentType, ImageAlbum } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * The appointment form's copy lives in `clinic`, not the room's
 * `appointments`: the form is shared — the Appointments room opens it, and the
 * lead drawer and the task drawer stack it (KICKOFF §6.4). The status
 * machine's words, the cancel confirm and the booking toasts are the clinic
 * vocabulary's (`CLINIC_KEYS.appointments`).
 */
export const APPOINTMENT_FORM_NS = I18N_NAMESPACES.clinic;

const TYPE_KEYS = (prefix: string): Readonly<Record<AppointmentType, string>> => ({
  consultation: `${prefix}.consultation`,
  follow_up: `${prefix}.follow_up`,
  treatment: `${prefix}.treatment`,
  package_session: `${prefix}.package_session`,
  other: `${prefix}.other`,
});

const ALBUM_KEYS: Readonly<Record<ImageAlbum, string>> = {
  general: 'appointmentForm.photos.albums.general',
  private: 'appointmentForm.photos.albums.private',
  lhr: 'appointmentForm.photos.albums.lhr',
};

/** Key paths for the appointment form (`appointments.md` › Copy, verbatim). */
export const APPOINTMENT_FORM_KEYS = {
  title: {
    /** Edit and Reschedule while the booking loads. */
    loading: 'appointmentForm.title.loading',
    create: 'appointmentForm.title.create',
    /** "Appointment #<seq>". */
    edit: 'appointmentForm.title.edit',
    /** "Reschedule #<seq>". */
    reschedule: 'appointmentForm.title.reschedule',
  },
  sub: 'appointmentForm.sub',
  who: {
    search: 'appointmentForm.who.search',
    searchLabel: 'appointmentForm.who.searchLabel',
    useContact: 'appointmentForm.who.useContact',
    /** "Patient · <care>" — the care types joined; "Patient" without one. */
    patient: 'appointmentForm.who.patient',
    patientCare: 'appointmentForm.who.patientCare',
    /** "Lead #<seq> · <mobile>". */
    lead: 'appointmentForm.who.lead',
    /** "+ Create contact “<query>”". */
    createContact: 'appointmentForm.who.createContact',
    newContact: 'appointmentForm.who.newContact',
    mobile: 'appointmentForm.who.mobile',
    name: 'appointmentForm.who.name',
    mobileLabel: 'appointmentForm.who.mobileLabel',
    save: 'appointmentForm.who.save',
    addName: 'appointmentForm.who.addName',
    mobileDigits: 'appointmentForm.who.mobileDigits',
  },
  links: {
    connected: 'appointmentForm.links.connected',
    /** A chip: "#<seq> · <status>". */
    chip: 'appointmentForm.links.chip',
    /** A chip's tooltip: "Lead #<seq> · <source> · owner <name>". */
    chipHint: 'appointmentForm.links.chipHint',
    movesAtCheckIn: 'appointmentForm.links.movesAtCheckIn',
    lead: 'appointmentForm.links.lead',
    /** A radio: "Lead #<seq>". */
    leadOption: 'appointmentForm.links.leadOption',
  },
  status: {
    section: 'appointmentForm.status.section',
    group: 'appointmentForm.status.group',
    copy: 'appointmentForm.status.copy',
    copyHint: 'appointmentForm.status.copyHint',
    cancelVisit: 'appointmentForm.status.cancelVisit',
    cancelHint: 'appointmentForm.status.cancelHint',
    /** The cancelled banner's line: "<reason> · slot released · reminders stopped". */
    cancelledReason: 'appointmentForm.status.cancelledReason',
    cancelledNoReason: 'appointmentForm.status.cancelledNoReason',
    restore: 'appointmentForm.status.restore',
    /** "Rescheduled · was <day> <time> …" — Confirmed, then Scheduled. */
    rescheduledConfirm: 'appointmentForm.status.rescheduledConfirm',
    rescheduled: 'appointmentForm.status.rescheduled',
    /** "Plan ready · <n> offering(s)". */
    planReady: 'appointmentForm.status.planReady',
    planNotPrepared: 'appointmentForm.status.planNotPrepared',
    /** The plan flag's tooltip, its parts joined with " · ". */
    planVisit: 'appointmentForm.status.planVisit',
    planEarlier: 'appointmentForm.status.planEarlier',
    planOpen: 'appointmentForm.status.planOpen',
    planEmpty: 'appointmentForm.status.planEmpty',
    createPatient: 'appointmentForm.status.createPatient',
  },
  details: {
    title: 'appointmentForm.details.title',
    notFilled: 'appointmentForm.details.notFilled',
    open: 'appointmentForm.details.open',
    type: 'appointmentForm.details.type',
    typeGroup: 'appointmentForm.details.typeGroup',
    types: TYPE_KEYS('appointmentForm.details.types'),
    /** Each type chip's tooltip. */
    typeHints: TYPE_KEYS('appointmentForm.details.typeHints'),
    /** The line under the chips; Package session takes `{{next}}` and `{{total}}`. */
    typeLines: {
      consultation: 'appointmentForm.details.typeLines.consultation',
      follow_up: 'appointmentForm.details.typeLines.follow_up',
      package_session: 'appointmentForm.details.typeLines.package_session',
      other: 'appointmentForm.details.typeLines.other',
    },
    treatment: 'appointmentForm.details.treatment',
    pickTreatment: 'appointmentForm.details.pickTreatment',
    searchTreatments: 'appointmentForm.details.searchTreatments',
    common: 'appointmentForm.details.common',
    fromOfferings: 'appointmentForm.details.fromOfferings',
    package: 'appointmentForm.details.package',
    packageNext: 'appointmentForm.details.packageNext',
    packageLeft: 'appointmentForm.details.packageLeft',
    noPackage: 'appointmentForm.details.noPackage',
    pickContactPackages: 'appointmentForm.details.pickContactPackages',
    asTreatment: 'appointmentForm.details.asTreatment',
    doctor: 'appointmentForm.details.doctor',
    pickDoctor: 'appointmentForm.details.pickDoctor',
    searchDoctors: 'appointmentForm.details.searchDoctors',
    length: 'appointmentForm.details.length',
    /** "<n> min" on a chip, "<n> minutes" its tooltip. */
    minutes: 'appointmentForm.details.minutes',
    minutesHint: 'appointmentForm.details.minutesHint',
    reason: 'appointmentForm.details.reason',
    reasonPlaceholder: 'appointmentForm.details.reasonPlaceholder',
    notes: 'appointmentForm.details.notes',
    notesPlaceholder: 'appointmentForm.details.notesPlaceholder',
  },
  slot: {
    title: 'appointmentForm.slot.title',
    nextWeek: 'appointmentForm.slot.nextWeek',
    calendar: 'appointmentForm.slot.calendar',
    previousMonth: 'appointmentForm.slot.previousMonth',
    nextMonth: 'appointmentForm.slot.nextMonth',
    step: 'appointmentForm.slot.step',
    /** "<n> min". */
    stepOption: 'appointmentForm.slot.stepOption',
    time: 'appointmentForm.slot.time',
    pickDate: 'appointmentForm.slot.pickDate',
    /** The day offers no start: closed, the doctor off, or every time passed. */
    none: 'appointmentForm.slot.none',
    am: 'appointmentForm.slot.am',
    pm: 'appointmentForm.slot.pm',
    /** "<hour> <AM/PM>" — a row's name. */
    hour: 'appointmentForm.slot.hour',
    free: 'appointmentForm.slot.free',
    booked: 'appointmentForm.slot.booked',
    locked: 'appointmentForm.slot.locked',
    lockedSummary: 'appointmentForm.slot.lockedSummary',
    lockedToast: 'appointmentForm.slot.lockedToast',
  },
  notPatient: {
    section: 'appointmentForm.notPatient.section',
    title: 'appointmentForm.notPatient.title',
    body: 'appointmentForm.notPatient.body',
    action: 'appointmentForm.notPatient.action',
    done: 'appointmentForm.notPatient.done',
  },
  photos: {
    title: 'appointmentForm.photos.title',
    section: 'appointmentForm.photos.section',
    locked: 'appointmentForm.photos.locked',
    checkIn: 'appointmentForm.photos.checkIn',
    album: 'appointmentForm.photos.album',
    albums: ALBUM_KEYS,
    upload: 'appointmentForm.photos.upload',
    add: 'appointmentForm.photos.add',
    open: 'appointmentForm.photos.open',
    edit: 'appointmentForm.photos.edit',
    delete: 'appointmentForm.photos.delete',
    /** "<n> photo(s) · they show in <first>’s file under this visit". */
    count: 'appointmentForm.photos.count',
    empty: 'appointmentForm.photos.empty',
    attached: 'appointmentForm.photos.attached',
    deleteTitle: 'appointmentForm.photos.deleteTitle',
    deleted: 'appointmentForm.photos.deleted',
    reasons: {
      wrongPatient: 'appointmentForm.photos.reasons.wrongPatient',
      blurry: 'appointmentForm.photos.reasons.blurry',
      duplicate: 'appointmentForm.photos.reasons.duplicate',
      other: 'appointmentForm.photos.reasons.other',
    },
  },
  footer: {
    pickTime: 'appointmentForm.footer.pickTime',
    book: 'appointmentForm.footer.book',
    move: 'appointmentForm.footer.move',
    saveChanges: 'appointmentForm.footer.saveChanges',
    minutes: 'appointmentForm.footer.minutes',
  },
  validation: {
    who: 'appointmentForm.validation.who',
    slot: 'appointmentForm.validation.slot',
    passed: 'appointmentForm.validation.passed',
    taken: 'appointmentForm.validation.taken',
    doctor: 'appointmentForm.validation.doctor',
  },
  copied: 'appointmentForm.copied',
} as const;

/**
 * `data-testid`s of the form. The drawer takes the routes' ids — the New
 * appointment drawer and the appointment drawer — and its parts derive theirs
 * (`<drawer>-save`, `-close` …).
 */
export const APPOINTMENT_FORM_TEST_IDS = {
  /** New (`create/`, a stacked booking). */
  createDrawer: 'new-appointment-drawer',
  /** Edit and Reschedule (`$appointmentId/`). */
  drawer: 'appointment-drawer',
  form: 'appointment-form',
  whoSearch: 'appointment-form-who-search',
  whoHit: 'appointment-form-who-hit',
  whoCreate: 'appointment-form-who-create',
  whoCard: 'appointment-form-who-card',
  whoMobile: 'appointment-form-who-mobile',
  whoEdit: 'appointment-form-who-edit',
  whoEditName: 'appointment-form-who-edit-name',
  whoEditMobile: 'appointment-form-who-edit-mobile',
  whoEditSave: 'appointment-form-who-edit-save',
  connectedLead: 'appointment-form-connected-lead',
  leadOption: 'appointment-form-lead-option',
  status: 'appointment-form-status',
  statusTile: (status: string) => `appointment-form-status-${status}`,
  statusHint: 'appointment-form-status-hint',
  cancelled: 'appointment-form-cancelled',
  restore: 'appointment-form-restore',
  rescheduled: 'appointment-form-rescheduled',
  copy: 'appointment-form-copy',
  rebook: 'appointment-form-rebook',
  cancelVisit: 'appointment-form-cancel-visit',
  plan: 'appointment-form-plan',
  details: 'appointment-form-details',
  detailsToggle: 'appointment-form-details-toggle',
  type: 'appointment-form-type',
  treatment: 'appointment-form-treatment',
  package: 'appointment-form-package',
  packageAsTreatment: 'appointment-form-package-as-treatment',
  doctor: 'appointment-form-doctor',
  length: 'appointment-form-length',
  reason: 'appointment-form-reason',
  notes: 'appointment-form-notes',
  slot: 'appointment-form-slot',
  slotToggle: 'appointment-form-slot-toggle',
  /** The quick dates; each chip is `<id>-today` · `-tomorrow` · `-next-week`. */
  quickDate: 'appointment-form-quick',
  calendar: 'appointment-form-calendar',
  calendarDay: 'appointment-form-calendar-day',
  calendarPrevious: 'appointment-form-calendar-previous',
  calendarNext: 'appointment-form-calendar-next',
  slotStep: 'appointment-form-slot-step',
  slotHour: 'appointment-form-slot-hour',
  slotTime: 'appointment-form-slot-time',
  notPatient: 'appointment-form-not-patient',
  createPatient: 'appointment-form-create-patient',
  photos: 'appointment-form-photos',
  photosCheckIn: 'appointment-form-photos-check-in',
  photosUpload: 'appointment-form-photos-upload',
  photoTile: 'appointment-form-photo',
  photoDelete: 'appointment-form-photo-delete',
  chat: 'appointment-form-chat',
} as const;
