import type { OfferingSpecialty } from '@/shared/api/app/app-schema.ts';
import { createOffering, fetchAllOfferings } from '@/shared/api/app/offerings-api.ts';
import {
  OFFERING_DEFAULTS,
  type OfferingFields,
  type OfferingRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import { completeOnboardingSetup } from '@/shared/api/app/onboarding-setup-api.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import {
  consultationOf,
  type StarterService,
} from '@/shared/app/app-starter-services.ts';

/*
 * "Go live" (KICKOFF §6.1; BRIEF.md:69–76; D26): one Consultation per chosen specialty unless the
 * clinic already has one of that name, then the server takes the clinic live once — refusing with
 * `409 onboarding_setup_incomplete` while a live check fails. The server holds no starter list;
 * the client creates the Consultations first.
 */

/** A Consultation "Go live" creates: the specialty's starter row under its name. */
export interface GoLiveConsultation {
  specialty: OfferingSpecialty;
  name: string;
  service: StarterService;
}

/**
 * The Consultations to create: one per chosen specialty — "Consultation" with one, "<Specialty>
 * consultation" with more (D18) — unless an offering of that name exists (any case).
 */
export function consultationsToCreate({
  specialties,
  existingNames,
  nameOf,
}: {
  specialties: readonly OfferingSpecialty[];
  existingNames: readonly string[];
  /** The Consultation's name for a specialty, in the clinic's words. */
  nameOf: (specialty: OfferingSpecialty, specialtyCount: number) => string;
}): GoLiveConsultation[] {
  const taken = new Set(existingNames.map((name) => name.trim().toLocaleLowerCase()));
  return specialties.flatMap((specialty) => {
    const name = nameOf(specialty, specialties.length);
    if (taken.has(name.trim().toLocaleLowerCase())) return [];
    taken.add(name.trim().toLocaleLowerCase());
    return [{ specialty, name, service: consultationOf(specialty) }];
  });
}

/** A starter row as the New-offering form's fields (D23 — the New-offering defaults). */
export function starterOfferingFields(
  service: StarterService,
  name: string,
): OfferingFields {
  return {
    ...OFFERING_DEFAULTS,
    name,
    category: service.category,
    price: service.price,
    gstPercent: service.gstPercent,
    durationMin: service.durationMinutes,
    sessions: service.sessions,
    validityDays: service.validityDays,
  };
}

/** What going live left behind: the setup as it stands, and the Consultations it created. */
export interface GoLiveResult {
  setup: OnboardingSetup;
  created: OfferingRecord[];
  /** Every chosen specialty's Consultation — created now or there already. */
  consultations: { name: string; price: number }[];
}

/**
 * Runs "Go live": reads the offerings, creates each missing Consultation (each with a key derived
 * from the action's, so a retry repeats none), then completes. Throws the API's error as it came —
 * the caller reads `409 onboarding_setup_incomplete`.
 */
export async function runGoLive({
  specialties,
  nameOf,
  canSetLowestPrice,
  idempotencyKey,
}: {
  specialties: readonly OfferingSpecialty[];
  nameOf: (specialty: OfferingSpecialty, specialtyCount: number) => string;
  canSetLowestPrice: boolean;
  idempotencyKey: string;
}): Promise<GoLiveResult> {
  const offerings = await fetchAllOfferings();
  const missing = consultationsToCreate({
    specialties,
    existingNames: offerings.map((offering) => offering.name),
    nameOf,
  });
  const created: OfferingRecord[] = [];
  for (const consultation of missing) {
    created.push(
      await createOffering({
        fields: starterOfferingFields(consultation.service, consultation.name),
        canSetLowestPrice,
        specialty: consultation.specialty,
        idempotencyKey: `${idempotencyKey}-consultation-${consultation.specialty}`,
      }),
    );
  }
  const setup = await completeOnboardingSetup({
    idempotencyKey: `${idempotencyKey}-complete`,
  });
  const all = [...offerings, ...created];
  const consultations = specialties.flatMap((specialty) => {
    const name = nameOf(specialty, specialties.length).trim().toLocaleLowerCase();
    const found = all.find(
      (offering) => offering.name.trim().toLocaleLowerCase() === name,
    );
    return found ? [{ name: found.name, price: found.price }] : [];
  });
  return { setup, created, consultations };
}
