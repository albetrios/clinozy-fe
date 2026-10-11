import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { PatientPackageRow } from '@/shared/api/app/patient-packages-contracts.ts';
import {
  TREATMENT_LIMITS,
  type TreatmentAftercareCall,
  type TreatmentBodyPart,
  type TreatmentFields,
  type TreatmentRecord,
  type TreatmentTemplate,
} from '@/shared/api/app/treatments-contracts.ts';

/*
 * The Treatment drawer's form (KICKOFF §6.6; `patient-file.md:123–141,
 * 360–372`; H:4811–4828). A template's chips store the design's English value
 * ("Laser", "Type IV", "810") in `parameters` — the API keeps each value as text
 * ≤ 80 — and the area chips also map onto the API's `body_parts` where the
 * 15-part list has the place (M33).
 */

/** The drawer's form. */
export interface TreatmentFormValues {
  template: TreatmentTemplate;
  name: string;
  offeringId: string | null;
  /** The patient's package the session spends (a new one only — §6 #20). */
  packageId: string | null;
  sessionNumber: number;
  doctorId: string | null;
  therapistId: string | null;
  /** The template's area chips (Skin body parts, Physio regions), by key. */
  areas: string[];
  /** The template's other fields, by the API's parameter keys. */
  parameters: Record<string, string>;
  remark: string;
  aftercareCall: TreatmentAftercareCall;
}

/** A chip of a template field: its key (copy and test id) and the value it stores. */
export interface TemplateOption {
  key: string;
  value: string;
}

const option = (key: string, value: string): TemplateOption => ({ key, value });

/** Each template's tone (H:4828): Skin · laser lav, Dental mint, Physio sage, Gynac butter, General stone. */
export const TREATMENT_TEMPLATES: readonly { template: TreatmentTemplate; tone: Tone }[] =
  [
    { template: 'skin', tone: 'lav' },
    { template: 'dental', tone: 'mint' },
    { template: 'physio', tone: 'sage' },
    { template: 'gynac', tone: 'butter' },
    { template: 'general', tone: 'stone' },
  ];

/** A template's tone. */
export function templateTone(template: TreatmentTemplate): Tone {
  return (
    TREATMENT_TEMPLATES.find((entry) => entry.template === template)?.tone ?? 'stone'
  );
}

/** Skin · laser's Therapy type chips (`patient-file.md:364`). */
export const SKIN_THERAPY_TYPES = [
  option('laser', 'Laser'),
  option('peel', 'Peel'),
  option('facial', 'Facial'),
  option('injectable', 'Injectable'),
  option('microneedling', 'Microneedling'),
];

/** Skin · laser's body parts, each with the API's `body_parts` value. */
export const SKIN_AREAS: readonly (TemplateOption & { bodyPart: TreatmentBodyPart })[] = [
  { ...option('face', 'Face'), bodyPart: 'face' },
  { ...option('upperLip', 'Upper lip'), bodyPart: 'upper_lip' },
  { ...option('chin', 'Chin'), bodyPart: 'chin' },
  { ...option('underarm', 'Underarm'), bodyPart: 'underarm' },
  { ...option('arms', 'Arms'), bodyPart: 'arms' },
  { ...option('legs', 'Legs'), bodyPart: 'legs' },
  { ...option('back', 'Back'), bodyPart: 'back' },
  { ...option('chest', 'Chest'), bodyPart: 'chest' },
  { ...option('fullBody', 'Full body'), bodyPart: 'full_body' },
];

/** The Fitzpatrick skin types I–VI ("Type III"), stored as their numeral. */
export const SKIN_TYPES = ['I', 'II', 'III', 'IV', 'V', 'VI'].map((numeral) =>
  option(numeral, `Type ${numeral}`),
);

/** Skin · laser's wavelengths, in nm (`patient-file.md:364`). */
export const WAVELENGTHS = ['532', '755', '810', '1064'].map((nm) => option(nm, nm));

/** Dental's Procedure chips (`patient-file.md:365`). */
export const DENTAL_PROCEDURES = [
  option('scaling', 'Scaling'),
  option('filling', 'Filling'),
  option('rct', 'RCT'),
  option('extraction', 'Extraction'),
  option('crown', 'Crown'),
  option('implant', 'Implant'),
  option('whitening', 'Whitening'),
];

/** FDI numbering (H:4816): the four quadrants as the chart shows them. */
export const FDI_QUADRANTS = [
  { key: 'upperRight', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { key: 'upperLeft', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { key: 'lowerRight', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { key: 'lowerLeft', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
] as const;

/** Physio's regions; Neck and Back are API body parts, the joints are not. */
export const PHYSIO_REGIONS: readonly (TemplateOption & {
  bodyPart: TreatmentBodyPart | null;
})[] = [
  { ...option('neck', 'Neck'), bodyPart: 'neck' },
  { ...option('shoulder', 'Shoulder'), bodyPart: null },
  { ...option('back', 'Back'), bodyPart: 'back' },
  { ...option('hip', 'Hip'), bodyPart: null },
  { ...option('knee', 'Knee'), bodyPart: null },
  { ...option('ankle', 'Ankle'), bodyPart: null },
];

/** Physio's Modality chips (`patient-file.md:366`). */
export const PHYSIO_MODALITIES = [
  option('tens', 'TENS'),
  option('ift', 'IFT'),
  option('ultrasound', 'Ultrasound'),
  option('exercise', 'Exercise'),
  option('manualTherapy', 'Manual therapy'),
  option('traction', 'Traction'),
];

/** The pain scores 0–10, Physio's before and after. */
export const PAIN_SCORES = Array.from({ length: 11 }, (_, score) =>
  option(String(score), String(score)),
);

/** Gynac's Visit type chips (`patient-file.md:367`). */
export const GYNAC_VISIT_TYPES = [
  option('anc', 'ANC'),
  option('pnc', 'PNC'),
  option('infertility', 'Infertility'),
  option('contraception', 'Contraception'),
  option('general', 'General'),
];

/** The aftercare call chips (H:4826) and their tones; Next day is the default. */
export const AFTERCARE_CALLS: readonly { call: TreatmentAftercareCall; tone: Tone }[] = [
  { call: 'none', tone: 'stone' },
  { call: 'next_day', tone: 'sage' },
  { call: 'in_two_days', tone: 'mint' },
  { call: 'in_week', tone: 'sky' },
];

/** Anaesthesia's two stored values. */
export const ANAESTHESIA = { given: 'Given', notGiven: 'Not given' } as const;

/** The template's area chips, if it has any. */
function templateAreas(
  template: TreatmentTemplate,
): readonly (TemplateOption & { bodyPart: TreatmentBodyPart | null })[] {
  if (template === 'skin') return SKIN_AREAS;
  if (template === 'physio') return PHYSIO_REGIONS;
  return [];
}

// ── Teeth ──

/** Picked teeth, stored as their two-digit FDI codes back to back ("1817") — 32 fit the 80. */
export function teethOf(stored: string | undefined): number[] {
  return (stored?.match(/\d{2}/g) ?? []).map(Number);
}

/** Picked teeth as the stored value. */
export function storedTeeth(teeth: readonly number[]): string {
  return [...teeth].sort((a, b) => a - b).join('');
}

// ── The form ──

/** The next session's number after `session`, within the API's range. */
const nextSession = (session: number) =>
  Math.min(TREATMENT_LIMITS.session.max, session + 1);

/** A blank form for a template: its areas and fields empty, the rest kept. */
export function withTemplate(
  values: TreatmentFormValues,
  template: TreatmentTemplate,
): TreatmentFormValues {
  return { ...values, template, areas: [], parameters: {} };
}

/** A new treatment: the template to start with, session 1, the next-day call. */
export function newTreatmentForm(
  template: TreatmentTemplate,
  staff: { doctorId: string | null; therapistId: string | null },
  last?: TreatmentRecord,
): TreatmentFormValues {
  const blank: TreatmentFormValues = {
    template,
    name: '',
    offeringId: null,
    packageId: null,
    sessionNumber: 1,
    doctorId: staff.doctorId,
    therapistId: staff.therapistId,
    areas: [],
    parameters: {},
    remark: '',
    aftercareCall: 'next_day',
  };
  if (!last) return blank;
  // A new treatment continues the last one (H:4811): its name, its areas when
  // the template is the same, and the next session; the template's own fields
  // start empty, and a package is the package chip's to pick.
  const previous = treatmentFormOf(last);
  return {
    ...blank,
    name: previous.name,
    offeringId: previous.offeringId,
    areas: previous.template === template ? previous.areas : [],
    sessionNumber: nextSession(last.sessionNumber),
  };
}

/** A saved treatment's area chips: its own list, else its body parts. */
function areasOf(treatment: TreatmentRecord): string[] {
  const options = templateAreas(treatment.template);
  const listed = treatment.parameters.areas;
  if (listed) {
    return listed
      .split(',')
      .map((label) => options.find((area) => area.value === label.trim())?.key)
      .filter((key): key is string => Boolean(key));
  }
  return options
    .filter((area) => area.bodyPart && treatment.bodyParts.includes(area.bodyPart))
    .map((area) => area.key);
}

/** A saved treatment as the edit drawer opens it. */
export function treatmentFormOf(treatment: TreatmentRecord): TreatmentFormValues {
  // The areas are their own field (the chips); every other parameter stays as stored.
  const parameters = Object.fromEntries(
    Object.entries(treatment.parameters).filter(([key]) => key !== 'areas'),
  );
  return {
    template: treatment.template,
    name: treatment.name,
    offeringId: treatment.offeringId,
    packageId: treatment.packageId,
    sessionNumber: treatment.sessionNumber,
    doctorId: treatment.doctorId,
    therapistId: treatment.therapistId,
    areas: areasOf(treatment),
    parameters,
    remark: treatment.remark ?? '',
    aftercareCall: treatment.aftercareCall,
  };
}

/** A package a new session can spend: active, with a session left (the server's counts). */
export function canSpendSession(row: PatientPackageRow): boolean {
  return row.status === 'active' && row.sessionsLeft > 0;
}

/**
 * The next session of a treatment (Quick fill "Next session of …"): on its package while that
 * package can still spend a session.
 */
export function nextSessionForm(
  last: TreatmentRecord,
  current: TreatmentFormValues,
  packages: readonly PatientPackageRow[],
): TreatmentFormValues {
  const form = treatmentFormOf(last);
  const onPackage = packages.some(
    (row) => row.id === last.packageId && canSpendSession(row),
  );
  return {
    ...current,
    template: form.template,
    name: form.name,
    offeringId: form.offeringId,
    packageId: onPackage ? last.packageId : null,
    areas: form.areas,
    parameters: form.parameters,
    sessionNumber: nextSession(last.sessionNumber),
    doctorId: form.doctorId,
    therapistId: form.therapistId,
  };
}

/** A session on a package: the package's offering and name, its number the server's. */
export function onPackageForm(
  values: TreatmentFormValues,
  row: PatientPackageRow,
): TreatmentFormValues {
  return { ...values, name: row.name, offeringId: row.offeringId, packageId: row.id };
}

/** What a save writes; a blank name saves as `fallbackName` (A-F11). */
export function treatmentFieldsOf(
  values: TreatmentFormValues,
  fallbackName: string,
): TreatmentFields {
  const options = templateAreas(values.template);
  const picked = options.filter((area) => values.areas.includes(area.key));
  const bodyParts = [
    ...new Set(
      picked
        .map((area) => area.bodyPart)
        .filter((part): part is TreatmentBodyPart => Boolean(part)),
    ),
  ];
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(values.parameters)) {
    const text = value.trim();
    if (text) parameters[key] = text;
  }
  if (picked.length) parameters.areas = picked.map((area) => area.value).join(', ');
  return {
    name: values.name.trim() || fallbackName,
    template: values.template,
    offeringId: values.offeringId,
    doctorId: values.doctorId,
    therapistId: values.therapistId,
    bodyParts,
    sessionNumber: values.sessionNumber,
    parameters,
    remark: values.remark.trim() || null,
    aftercareCall: values.aftercareCall,
  };
}

/** The template a new treatment starts with this session (H:4828 — remembered after each save). */
let rememberedTemplate: TreatmentTemplate | null = null;

/** Remember the template just saved for the next new treatment. */
export function rememberTemplate(template: TreatmentTemplate): void {
  rememberedTemplate = template;
}

/** A new treatment's template: the patient's last, else the one saved last, else Skin · laser. */
export function startingTemplate(last: TreatmentRecord | undefined): TreatmentTemplate {
  return last?.template ?? rememberedTemplate ?? 'skin';
}
