import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { PrescriptionStatus } from '@/shared/api/app/prescriptions-contracts.ts';

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
  },
  /** "Draft" / "Approved" — the drawer's badge and the table's Status. */
  status: { draft: 'rx.status.draft', approved: 'rx.status.approved' },
  /** An approved prescription's drawer: why it cannot be changed (Q19). */
  approvedNote: 'rx.approvedNote',
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
    groups: {
      all: 'rx.quick.groups.all',
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
    /** The Days cell (change-prescription-writing D6): its header and its search. */
    days: 'rx.items.days',
    searchDays: 'rx.items.searchDays',
    /** The Days list's first row once a course is set. */
    noDays: 'rx.items.noDays',
    /** The medicine list's groups (D4). */
    groups: {
      store: 'rx.items.groups.store',
      outside: 'rx.items.groups.outside',
    },
    /** An outside name's line in the list: "Written for this patient before". */
    writtenBefore: 'rx.items.writtenBefore',
    /** The create row: "Outside medicine “Acnestar”". */
    addOutside: 'rx.items.addOutside',
    /** A row's source pill and its spoken words (D4). */
    source: {
      /** "24 in your medical store" (plural). */
      stocked: 'rx.items.source.stocked',
      store: 'rx.items.source.store',
      empty: 'rx.items.source.empty',
      /** The pill's word: "Outside". */
      outside: 'rx.items.source.outside',
      outsideHint: 'rx.items.source.outsideHint',
    },
    /** The list's footer: switch the picked line store ↔ outside. */
    toOutside: 'rx.items.toOutside',
    toOutsideHint: 'rx.items.toOutsideHint',
    toStore: 'rx.items.toStore',
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
    /** The ⌄ beside the taps (D5): its name, its two headings, the presets' words. */
    presets: 'rx.dose.presets',
    presetsHint: 'rx.dose.presetsHint',
    presetNames: {
      morning: 'rx.dose.presetNames.morning',
      night: 'rx.dose.presetNames.night',
      twice: 'rx.dose.presetNames.twice',
      thrice: 'rx.dose.presetNames.thrice',
      afternoon: 'rx.dose.presetNames.afternoon',
      sos: 'rx.dose.presetNames.sos',
    },
    counts: 'rx.dose.counts',
    /** "One less · Morning" / "One more · Morning". */
    less: 'rx.dose.less',
    more: 'rx.dose.more',
    clear: 'rx.dose.clear',
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
    /** "Save & approve" — a member who approves (Q19). */
    approve: 'rx.save.approve',
    sell: 'rx.save.sell',
    /** "Approve · print · send to pharmacy" — a new Rx an approver writes in the visit flow. */
    visit: 'rx.save.visit',
    /** "2 medicines · Dr. Drashti". */
    summary: 'rx.save.summary',
    noMedicine: 'rx.save.noMedicine',
    saved: 'rx.save.saved',
    savedNumber: 'rx.save.savedNumber',
    /** "Prescription #500 approved". */
    approvedNumber: 'rx.save.approvedNumber',
  },
  delete: { title: 'rx.delete.title', deleted: 'rx.delete.deleted' },
  /** "Prescription #500" — the shared print preview's title. */
  preview: 'rx.preview',
  /** The Rx Pad (feat-prescription-composer §6.4): many shorthand lines at once. */
  pad: {
    toggle: 'rx.pad.toggle',
    toggleHint: 'rx.pad.toggleHint',
    label: 'rx.pad.label',
    hint: 'rx.pad.hint',
    placeholder: 'rx.pad.placeholder',
    /** A preview line's state, read out beside its mark. */
    found: 'rx.pad.found',
    typed: 'rx.pad.typed',
    unreadable: 'rx.pad.unreadable',
    /** "3 lines" (plural) · "2 found" · "1 new" · "1 skipped". */
    lines: 'rx.pad.lines',
    foundCount: 'rx.pad.foundCount',
    typedCount: 'rx.pad.typedCount',
    skippedCount: 'rx.pad.skippedCount',
    /** "Only the first 30 lines are read". */
    overflow: 'rx.pad.overflow',
    /** "Add 3 medicines" (plural). */
    add: 'rx.pad.add',
    clear: 'rx.pad.clear',
    close: 'rx.pad.close',
    empty: 'rx.pad.empty',
    /** "3 medicines added" (plural) — the toast. */
    added: 'rx.pad.added',
  },
  /** The Rx sidekick (§6.5): the allergies, since last Rx, the plain words. */
  sidekick: {
    label: 'rx.sidekick.label',
    allergies: 'rx.sidekick.allergies',
    noAllergies: 'rx.sidekick.noAllergies',
    /** "Septran DS matches Sulfa drugs". */
    matches: 'rx.sidekick.matches',
    /** "Since Rx #12 · 30 Sep". */
    since: 'rx.sidekick.since',
    first: 'rx.sidekick.first',
    kinds: {
      new: 'rx.sidekick.kinds.new',
      changed: 'rx.sidekick.kinds.changed',
      unchanged: 'rx.sidekick.kinds.unchanged',
      stopped: 'rx.sidekick.kinds.stopped',
    },
    /** "2 unchanged". */
    unchangedCount: 'rx.sidekick.unchangedCount',
    continue: 'rx.sidekick.continue',
    continueLabel: 'rx.sidekick.continueLabel',
    /** "Cetirizine 10 continued" — the toast. */
    continued: 'rx.sidekick.continued',
    reads: 'rx.sidekick.reads',
    readsEmpty: 'rx.sidekick.readsEmpty',
    /** Earlier prescriptions (change-prescription-writing D8). */
    earlier: {
      title: 'rx.sidekick.earlier.title',
      none: 'rx.sidekick.earlier.none',
      /** "2 of 5". */
      position: 'rx.sidekick.earlier.position',
      older: 'rx.sidekick.earlier.older',
      newer: 'rx.sidekick.earlier.newer',
      inThisRx: 'rx.sidekick.earlier.inThisRx',
      add: 'rx.sidekick.earlier.add',
      addLabel: 'rx.sidekick.earlier.addLabel',
      /** "Add 3 missing" (plural). */
      addAll: 'rx.sidekick.earlier.addAll',
      advice: 'rx.sidekick.earlier.advice',
      noLines: 'rx.sidekick.earlier.noLines',
    },
    /** The folded card's line (plurals): "1 allergy match · 3 changes since Rx #12". */
    summary: {
      allergy: 'rx.sidekick.summary.allergy',
      changes: 'rx.sidekick.summary.changes',
      noChanges: 'rx.sidekick.summary.noChanges',
      first: 'rx.sidekick.summary.first',
    },
    show: 'rx.sidekick.show',
    hide: 'rx.sidekick.hide',
  },
  /** The band under the header: "Allergies". */
  allergyBand: { label: 'rx.allergyBand.label' },
  /** A line in plain words: "1 in the morning + 1 at night · … · 20 in all". */
  plain: {
    morning: 'rx.plain.morning',
    afternoon: 'rx.plain.afternoon',
    night: 'rx.plain.night',
    sos: 'rx.plain.sos',
    total: 'rx.plain.total',
  },
  /** The allergy warning under a matching row (change-prescription-writing D7). */
  rowAllergy: {
    /** "Allergic to Sulfa drugs". */
    warning: 'rx.rowAllergy.warning',
    keep: 'rx.rowAllergy.keep',
    keepLabel: 'rx.rowAllergy.keepLabel',
    remove: 'rx.rowAllergy.remove',
    removeLabel: 'rx.rowAllergy.removeLabel',
    /** "Kept knowingly despite the Sulfa drugs allergy". */
    kept: 'rx.rowAllergy.kept',
    undo: 'rx.rowAllergy.undo',
    /** The held save's toast: "Septran DS matches an allergy — keep it or remove it". */
    held: 'rx.rowAllergy.held',
  },
} as const;

/** A prescription's status pill: a draft waits (butter), an approved one is final (sage). */
export const RX_STATUS_TONES: Readonly<Record<PrescriptionStatus, Tone>> = {
  draft: 'butter',
  approved: 'sage',
};

/** The tones the member's kits take in Quick fill, in turn. */
export const RX_KIT_TONES: readonly Tone[] = ['lav', 'blush', 'butter', 'mint'];

/** The drawer's and the preview's root test ids. */
export const RX_TEST_IDS = {
  drawer: 'rx-drawer',
  preview: 'rx-print-preview',
  /** The Rx Pad and its toggle beside Browse (`rx-pad-…`). */
  pad: 'rx-pad',
  /** The Rx sidekick — the drawer's column, or the folded card below `xl` (`rx-sidekick-…`). */
  sidekick: 'rx-sidekick',
  /** The allergy band under the drawer's header. */
  allergyBand: 'rx-drawer-allergy-band',
  /** The allergy warning under a matching row (`-keep`, `-remove`). */
  rowAllergy: 'rx-items-allergy',
} as const;
