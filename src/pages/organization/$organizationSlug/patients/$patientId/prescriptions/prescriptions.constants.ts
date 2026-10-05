import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The prescription drawer and its print preview read the patient file's namespace. */
export const RX_NS = I18N_NAMESPACES.patientFile;

/**
 * The Prescription drawer and the print preview (`patient-file.md:105–121,
 * 269–315`; KICKOFF §6.6 Drawers), verbatim; plurals for the counts.
 */
export const RX_KEYS = {
  /** "Prescription" — the not-found toast's record. */
  record: 'rx.record',
  title: { create: 'rx.title.create', edit: 'rx.title.edit' },
  /** "Dharti Galani · #3508". */
  sub: 'rx.sub',
  /** "2 medicines" (plural). */
  medicines: 'rx.medicines',
  quickFill: {
    print: 'rx.quickFill.print',
    /** "Repeat last Rx #500". */
    repeat: 'rx.quickFill.repeat',
    kits: {
      hairFall: 'rx.quickFill.kits.hairFall',
      postPeel: 'rx.quickFill.kits.postPeel',
      pigmentation: 'rx.quickFill.kits.pigmentation',
    },
  },
  /** A kit's own words: its line note and its advice. */
  kit: { reapply: 'rx.kit.reapply', avoidSun: 'rx.kit.avoidSun' },
  steps: {
    prescription: 'rx.steps.prescription',
    medicines: 'rx.steps.medicines',
    notes: 'rx.steps.notes',
  },
  date: 'rx.date',
  doctor: 'rx.doctor',
  doctorPlaceholder: 'rx.doctorPlaceholder',
  quick: {
    placeholder: 'rx.quick.placeholder',
    hint: 'rx.quick.hint',
    often: 'rx.quick.often',
    groups: {
      all: 'rx.quick.groups.all',
      often: 'rx.quick.groups.often',
      oral: 'rx.quick.groups.oral',
      topical: 'rx.quick.groups.topical',
    },
    newMedicine: 'rx.quick.newMedicine',
    /** A medicine's sub line: its last dosage, or "No previous dosage". */
    lastSaved: 'rx.quick.lastSaved',
    noDosage: 'rx.quick.noDosage',
    /** "8 in stock" (plural) / "out of stock". */
    inStock: 'rx.quick.inStock',
    outOfStock: 'rx.quick.outOfStock',
    /** "Flubolt 400 added". */
    added: 'rx.quick.added',
    /** The ×N pill of a typed quantity. */
    qty: 'rx.quick.qty',
  },
  items: {
    label: 'rx.items.label',
    medicine: 'rx.items.medicine',
    dose: 'rx.items.dose',
    meal: 'rx.items.meal',
    where: 'rx.items.where',
    qty: 'rx.items.qty',
    searchMedicine: 'rx.items.searchMedicine',
    addMedicine: 'rx.items.addMedicine',
    use: 'rx.items.use',
    note: 'rx.items.note',
  },
  dose: {
    group: 'rx.dose.group',
    times: {
      morning: 'rx.dose.times.morning',
      afternoon: 'rx.dose.times.afternoon',
      night: 'rx.dose.times.night',
    },
    /** "Morning · 1 — click to change". */
    on: 'rx.dose.on',
    off: 'rx.dose.off',
    sos: 'rx.dose.sos',
    sosHint: 'rx.dose.sosHint',
  },
  meal: {
    before: 'rx.meal.before',
    after: 'rx.meal.after',
    beforeHint: 'rx.meal.beforeHint',
    afterHint: 'rx.meal.afterHint',
    more: 'rx.meal.more',
    /** "Morning & night · change". */
    change: 'rx.meal.change',
  },
  timings: {
    empty_stomach: 'rx.timings.empty_stomach',
    with_meal: 'rx.timings.with_meal',
    morning: 'rx.timings.morning',
    night: 'rx.timings.night',
    morning_night: 'rx.timings.morning_night',
    thrice_week: 'rx.timings.thrice_week',
    once_week: 'rx.timings.once_week',
    alternate_days: 'rx.timings.alternate_days',
  },
  places: {
    face: 'rx.places.face',
    scalp: 'rx.places.scalp',
    hair: 'rx.places.hair',
    body: 'rx.places.body',
    underarm: 'rx.places.underarm',
    neck: 'rx.places.neck',
    back: 'rx.places.back',
    chest: 'rx.places.chest',
    hands: 'rx.places.hands',
    legs: 'rx.places.legs',
    feet: 'rx.places.feet',
    lips: 'rx.places.lips',
    underEyes: 'rx.places.underEyes',
    affectedArea: 'rx.places.affectedArea',
  },
  notes: {
    advice: 'rx.notes.advice',
    advicePlaceholder: 'rx.notes.advicePlaceholder',
    lab: 'rx.notes.lab',
    labPlaceholder: 'rx.notes.labPlaceholder',
    procedure: 'rx.notes.procedure',
    procedurePlaceholder: 'rx.notes.procedurePlaceholder',
  },
  /** "10 days" (plural) — the note a typed "10d" writes. */
  daysNote: 'rx.daysNote',
  /** The day words a note's "10 days" is read in, comma separated. */
  dayWords: 'rx.dayWords',
  save: {
    create: 'rx.save.create',
    edit: 'rx.save.edit',
    sell: 'rx.save.sell',
    /** "Approve · print · send to pharmacy" — a new Rx written in the visit flow. */
    visit: 'rx.save.visit',
    /** "2 medicines · Dr. Drashti". */
    summary: 'rx.save.summary',
    noMedicine: 'rx.save.noMedicine',
    saved: 'rx.save.saved',
    savedNumber: 'rx.save.savedNumber',
  },
  delete: { title: 'rx.delete.title', deleted: 'rx.delete.deleted' },
  /** "Prescription #500" — the shared print preview's title. */
  preview: 'rx.preview',
} as const;

/** The drawer's and the preview's root test ids. */
export const RX_TEST_IDS = {
  drawer: 'rx-drawer',
  preview: 'rx-print-preview',
} as const;
