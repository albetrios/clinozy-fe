import type { OfferingCategory, OfferingSpecialty } from '@/shared/api/app/app-schema.ts';
import type { GstPercent } from '@/shared/api/app/offerings-contracts.ts';

/*
 * The starter services (feat-clinic-setup D18; `plans/decisions.md` › Starter services): the rows
 * the guide's "Add your treatments" offers for each chosen specialty, and the Consultation "Go
 * live" creates for each one (D26). Prices in rupees as the API takes them; GST exclusive (the
 * New-offering default, D23). Names are i18n keys in the `setup` namespace; a drift test pins the
 * rows to the decisions table.
 */

/** One starter row. */
export interface StarterService {
  specialty: OfferingSpecialty;
  /** `setup` i18n key of the row's name. */
  nameKey: string;
  category: OfferingCategory;
  durationMinutes: number;
  /** ₹, GST exclusive. */
  price: number;
  gstPercent: GstPercent;
  sessions: number;
  /** Days a package's sessions stay valid; 0 for none. */
  validityDays: number;
  /** Ticked when the list opens — the Consultation only (D18). */
  isTicked: boolean;
}

/** The `setup` i18n prefix of the starter names. */
const NAME = 'starter.names';

/** A row with the house defaults: one session, no validity. */
function row(
  specialty: OfferingSpecialty,
  name: string,
  values: Pick<StarterService, 'category' | 'durationMinutes' | 'price' | 'gstPercent'> &
    Partial<Pick<StarterService, 'sessions' | 'validityDays'>>,
): StarterService {
  return {
    specialty,
    nameKey: `${NAME}.${name}`,
    sessions: 1,
    validityDays: 0,
    isTicked: values.category === 'consultation' && name === 'consultation',
    ...values,
  };
}

/** Every starter row, in the decisions table's order. */
export const STARTER_SERVICES: readonly StarterService[] = [
  row('skin', 'consultation', {
    category: 'consultation',
    durationMinutes: 20,
    price: 500,
    gstPercent: 0,
  }),
  row('skin', 'chemicalPeel', {
    category: 'treatment',
    durationMinutes: 30,
    price: 2500,
    gstPercent: 18,
  }),
  row('skin', 'hydrafacial', {
    category: 'treatment',
    durationMinutes: 45,
    price: 3500,
    gstPercent: 18,
  }),
  row('skin', 'laserHairRemovalFullFace', {
    category: 'lhr',
    durationMinutes: 30,
    price: 2500,
    gstPercent: 18,
  }),
  row('skin', 'acneScarTreatment', {
    category: 'treatment',
    durationMinutes: 45,
    price: 4000,
    gstPercent: 18,
  }),
  row('hair', 'consultation', {
    category: 'consultation',
    durationMinutes: 20,
    price: 500,
    gstPercent: 0,
  }),
  row('hair', 'prpSession', {
    category: 'treatment',
    durationMinutes: 45,
    price: 4000,
    gstPercent: 18,
  }),
  row('hair', 'prpPack', {
    category: 'package',
    durationMinutes: 45,
    price: 21000,
    gstPercent: 18,
    sessions: 6,
    validityDays: 180,
  }),
  row('hair', 'scalpTreatment', {
    category: 'treatment',
    durationMinutes: 30,
    price: 1500,
    gstPercent: 18,
  }),
  row('dental', 'consultation', {
    category: 'consultation',
    durationMinutes: 15,
    price: 300,
    gstPercent: 0,
  }),
  row('dental', 'scalingPolishing', {
    category: 'treatment',
    durationMinutes: 30,
    price: 1200,
    gstPercent: 0,
  }),
  row('dental', 'toothFilling', {
    category: 'treatment',
    durationMinutes: 30,
    price: 1500,
    gstPercent: 0,
  }),
  row('dental', 'rootCanal', {
    category: 'treatment',
    durationMinutes: 60,
    price: 5000,
    gstPercent: 0,
  }),
  row('dental', 'teethWhitening', {
    category: 'treatment',
    durationMinutes: 60,
    price: 6000,
    gstPercent: 18,
  }),
  row('gynac', 'consultation', {
    category: 'consultation',
    durationMinutes: 20,
    price: 600,
    gstPercent: 0,
  }),
  row('gynac', 'papSmear', {
    category: 'treatment',
    durationMinutes: 15,
    price: 800,
    gstPercent: 0,
  }),
  row('gynac', 'pelvicUltrasound', {
    category: 'treatment',
    durationMinutes: 20,
    price: 1200,
    gstPercent: 0,
  }),
  row('physio', 'consultation', {
    category: 'consultation',
    durationMinutes: 30,
    price: 500,
    gstPercent: 0,
  }),
  row('physio', 'physioSession', {
    category: 'treatment',
    durationMinutes: 45,
    price: 700,
    gstPercent: 0,
  }),
  row('physio', 'physioPack', {
    category: 'package',
    durationMinutes: 45,
    price: 6000,
    gstPercent: 0,
    sessions: 10,
    validityDays: 90,
  }),
  row('general', 'consultation', {
    category: 'consultation',
    durationMinutes: 15,
    price: 400,
    gstPercent: 0,
  }),
  row('general', 'followUpVisit', {
    category: 'consultation',
    durationMinutes: 10,
    price: 200,
    gstPercent: 0,
  }),
  row('general', 'dressing', {
    category: 'treatment',
    durationMinutes: 15,
    price: 300,
    gstPercent: 0,
  }),
];

/** The rows of the chosen specialties, in the clinic's specialty order. */
export function starterServicesFor(
  specialties: readonly OfferingSpecialty[],
): StarterService[] {
  return specialties.flatMap((specialty) =>
    STARTER_SERVICES.filter((service) => service.specialty === specialty),
  );
}

/** A specialty's Consultation row — the one "Go live" creates. */
export function consultationOf(specialty: OfferingSpecialty): StarterService {
  const found = STARTER_SERVICES.find(
    (service) =>
      service.specialty === specialty && service.nameKey === `${NAME}.consultation`,
  );
  if (!found) throw new Error(`app-starter-services: no consultation for ${specialty}`);
  return found;
}

/**
 * Whether a starter row is a specialty's Consultation — named "Consultation" with one specialty,
 * "<Specialty> consultation" with more (D18), so its name is worked out where it is shown.
 */
export function isConsultationRow(service: StarterService): boolean {
  return service.nameKey === `${NAME}.consultation`;
}
