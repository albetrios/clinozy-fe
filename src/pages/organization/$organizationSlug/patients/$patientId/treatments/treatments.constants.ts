import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Treatment drawer reads the patient file's namespace. */
export const TREATMENT_NS = I18N_NAMESPACES.patientFile;

/** The Treatment drawer (`patient-file.md:123–141, 360–372`; KICKOFF §6.6 Drawers), verbatim. */
export const TREATMENT_KEYS = {
  /** "Treatment" — the not-found toast's record, and a blank name's fallback (A-F11). */
  record: 'treatment.record',
  title: { create: 'treatment.title.create', edit: 'treatment.title.edit' },
  sub: 'treatment.sub',
  /** "Session 2". */
  session: 'treatment.session',
  quickFill: {
    /** "Log check-in" — an edit's check-in drawer, stacked (H:4828). */
    checkIn: 'treatment.quickFill.checkIn',
    /** "Next session of LHR Full Face". */
    next: 'treatment.quickFill.next',
    /** "LHR Full Face · B4G7 · session 2". */
    package: 'treatment.quickFill.package',
  },
  /** The Type switch's name. */
  type: 'treatment.type',
  templates: {
    skin: 'treatment.templates.skin',
    dental: 'treatment.templates.dental',
    physio: 'treatment.templates.physio',
    gynac: 'treatment.templates.gynac',
    general: 'treatment.templates.general',
  },
  steps: {
    session: 'treatment.steps.session',
    /** "Skin · laser details". */
    details: 'treatment.steps.details',
    aftercare: 'treatment.steps.aftercare',
  },
  name: 'treatment.name',
  namePlaceholder: 'treatment.namePlaceholder',
  sessionNo: 'treatment.sessionNo',
  doctor: 'treatment.doctor',
  doctorPlaceholder: 'treatment.doctorPlaceholder',
  therapist: 'treatment.therapist',
  therapistPlaceholder: 'treatment.therapistPlaceholder',
  skin: {
    therapyType: 'treatment.skin.therapyType',
    therapyTypes: {
      laser: 'treatment.skin.therapyTypes.laser',
      peel: 'treatment.skin.therapyTypes.peel',
      facial: 'treatment.skin.therapyTypes.facial',
      injectable: 'treatment.skin.therapyTypes.injectable',
      microneedling: 'treatment.skin.therapyTypes.microneedling',
    },
    bodyPart: 'treatment.skin.bodyPart',
    pickAny: 'treatment.skin.pickAny',
    areas: {
      face: 'treatment.skin.areas.face',
      upperLip: 'treatment.skin.areas.upperLip',
      chin: 'treatment.skin.areas.chin',
      underarm: 'treatment.skin.areas.underarm',
      arms: 'treatment.skin.areas.arms',
      legs: 'treatment.skin.areas.legs',
      back: 'treatment.skin.areas.back',
      chest: 'treatment.skin.areas.chest',
      fullBody: 'treatment.skin.areas.fullBody',
    },
    skinType: 'treatment.skin.skinType',
    /** "Type IV". */
    skinTypeValue: 'treatment.skin.skinTypeValue',
    machine: 'treatment.skin.machine',
    machinePlaceholder: 'treatment.skin.machinePlaceholder',
    wavelength: 'treatment.skin.wavelength',
    startReading: 'treatment.skin.startReading',
    endReading: 'treatment.skin.endReading',
    readingPlaceholder: 'treatment.skin.readingPlaceholder',
    power: 'treatment.skin.power',
    powerPlaceholder: 'treatment.skin.powerPlaceholder',
  },
  dental: {
    procedure: 'treatment.dental.procedure',
    procedures: {
      scaling: 'treatment.dental.procedures.scaling',
      filling: 'treatment.dental.procedures.filling',
      rct: 'treatment.dental.procedures.rct',
      extraction: 'treatment.dental.procedures.extraction',
      crown: 'treatment.dental.procedures.crown',
      implant: 'treatment.dental.procedures.implant',
      whitening: 'treatment.dental.procedures.whitening',
    },
    teeth: 'treatment.dental.teeth',
    teethHint: 'treatment.dental.teethHint',
    quadrants: {
      upperRight: 'treatment.dental.quadrants.upperRight',
      upperLeft: 'treatment.dental.quadrants.upperLeft',
      lowerRight: 'treatment.dental.quadrants.lowerRight',
      lowerLeft: 'treatment.dental.quadrants.lowerLeft',
    },
    /** "Tooth 18". */
    tooth: 'treatment.dental.tooth',
    material: 'treatment.dental.material',
    materialPlaceholder: 'treatment.dental.materialPlaceholder',
    anaesthesia: 'treatment.dental.anaesthesia',
    given: 'treatment.dental.given',
    notGiven: 'treatment.dental.notGiven',
  },
  physio: {
    region: 'treatment.physio.region',
    regions: {
      neck: 'treatment.physio.regions.neck',
      shoulder: 'treatment.physio.regions.shoulder',
      back: 'treatment.physio.regions.back',
      hip: 'treatment.physio.regions.hip',
      knee: 'treatment.physio.regions.knee',
      ankle: 'treatment.physio.regions.ankle',
    },
    modality: 'treatment.physio.modality',
    modalities: {
      tens: 'treatment.physio.modalities.tens',
      ift: 'treatment.physio.modalities.ift',
      ultrasound: 'treatment.physio.modalities.ultrasound',
      exercise: 'treatment.physio.modalities.exercise',
      manualTherapy: 'treatment.physio.modalities.manualTherapy',
      traction: 'treatment.physio.modalities.traction',
    },
    painBefore: 'treatment.physio.painBefore',
    painAfter: 'treatment.physio.painAfter',
    painHint: 'treatment.physio.painHint',
    exercises: 'treatment.physio.exercises',
    exercisesPlaceholder: 'treatment.physio.exercisesPlaceholder',
  },
  gynac: {
    visitType: 'treatment.gynac.visitType',
    visitTypes: {
      anc: 'treatment.gynac.visitTypes.anc',
      pnc: 'treatment.gynac.visitTypes.pnc',
      infertility: 'treatment.gynac.visitTypes.infertility',
      contraception: 'treatment.gynac.visitTypes.contraception',
      general: 'treatment.gynac.visitTypes.general',
    },
    lmp: 'treatment.gynac.lmp',
    gestation: 'treatment.gynac.gestation',
    weeks: 'treatment.gynac.weeks',
    bp: 'treatment.gynac.bp',
    bpPlaceholder: 'treatment.gynac.bpPlaceholder',
    weight: 'treatment.gynac.weight',
    kg: 'treatment.gynac.kg',
    findings: 'treatment.gynac.findings',
    findingsPlaceholder: 'treatment.gynac.findingsPlaceholder',
  },
  general: {
    area: 'treatment.general.area',
    areaPlaceholder: 'treatment.general.areaPlaceholder',
    parameters: 'treatment.general.parameters',
    parametersPlaceholder: 'treatment.general.parametersPlaceholder',
  },
  aftercare: {
    remark: 'treatment.aftercare.remark',
    remarkPlaceholder: 'treatment.aftercare.remarkPlaceholder',
    call: 'treatment.aftercare.call',
    callHint: 'treatment.aftercare.callHint',
    calls: {
      none: 'treatment.aftercare.calls.none',
      next_day: 'treatment.aftercare.calls.next_day',
      in_2_days: 'treatment.aftercare.calls.in_2_days',
      in_week: 'treatment.aftercare.calls.in_week',
    },
    feedback: 'treatment.aftercare.feedback',
    /** "26 Sep · Better 7/10". */
    feedbackItem: 'treatment.aftercare.feedbackItem',
    noCheckIn: 'treatment.aftercare.noCheckIn',
  },
  save: {
    create: 'treatment.save.create',
    edit: 'treatment.save.edit',
    saved: 'treatment.save.saved',
  },
  delete: { title: 'treatment.delete.title', deleted: 'treatment.delete.deleted' },
} as const;

/** The drawer's root test id. */
export const TREATMENT_TEST_ID = 'treatment-drawer';
