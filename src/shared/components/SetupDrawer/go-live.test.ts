import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OfferingSpecialty } from '@/shared/api/app/app-schema.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import { consultationOf, STARTER_SERVICES } from '@/shared/app/app-starter-services.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

const api = vi.hoisted(() => ({
  fetchAllOfferings: vi.fn(),
  createOffering: vi.fn(),
  completeOnboardingSetup: vi.fn(),
}));
vi.mock('@/shared/api/app/offerings-api.ts', () => ({
  fetchAllOfferings: api.fetchAllOfferings,
  createOffering: api.createOffering,
}));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', () => ({
  completeOnboardingSetup: api.completeOnboardingSetup,
}));

import { consultationsToCreate, runGoLive, starterOfferingFields } from './go-live.ts';

const SPECIALTY_NAMES: Record<OfferingSpecialty, string> = {
  skin: 'Skin',
  hair: 'Hair',
  dental: 'Dental',
  gynac: 'Gynac',
  physio: 'Physio',
  general: 'General',
};

/** "Consultation" with one specialty, "<Specialty> consultation" with more (D18). */
const nameOf = (specialty: OfferingSpecialty, count: number) =>
  count > 1 ? `${SPECIALTY_NAMES[specialty]} consultation` : 'Consultation';

/** An offering as the list reads it — only the fields going live reads. */
const offering = (id: string, name: string, price: number) =>
  ({ id, name, price }) as unknown as OfferingRecord;

const LIVE_SETUP = { isLive: true } as OnboardingSetup;

beforeEach(() => {
  vi.resetAllMocks();
  api.fetchAllOfferings.mockResolvedValue([]);
  api.completeOnboardingSetup.mockResolvedValue(LIVE_SETUP);
  api.createOffering.mockImplementation(
    async ({ fields }: { fields: { name: string; price: number } }) =>
      offering(`ofr_${fields.name}`, fields.name, fields.price),
  );
});

describe('consultationsToCreate', () => {
  it('names the one Consultation "Consultation"', () => {
    expect(
      consultationsToCreate({ specialties: ['skin'], existingNames: [], nameOf }),
    ).toEqual([
      { specialty: 'skin', name: 'Consultation', service: consultationOf('skin') },
    ]);
  });

  it('names each "<Specialty> consultation" with two or more', () => {
    const created = consultationsToCreate({
      specialties: ['skin', 'hair'],
      existingNames: [],
      nameOf,
    });
    expect(created.map((row) => row.name)).toEqual([
      'Skin consultation',
      'Hair consultation',
    ]);
    expect(created.map((row) => row.service)).toEqual([
      consultationOf('skin'),
      consultationOf('hair'),
    ]);
  });

  it('skips a Consultation the clinic already has, in any case and spacing', () => {
    expect(
      consultationsToCreate({
        specialties: ['skin', 'hair'],
        existingNames: ['  skin CONSULTATION '],
        nameOf,
      }).map((row) => row.name),
    ).toEqual(['Hair consultation']);
  });
});

describe('starterOfferingFields', () => {
  it('is the starter row on the New-offering defaults (D23)', () => {
    const prpPack = STARTER_SERVICES.find(
      (row) => row.nameKey === 'starter.names.prpPack',
    );
    if (!prpPack) throw new Error('no PRP pack');
    expect(starterOfferingFields(prpPack, 'PRP pack')).toEqual(
      expect.objectContaining({
        name: 'PRP pack',
        category: 'package',
        price: 21000,
        gstPercent: 18,
        isGstInclusive: false,
        durationMin: 45,
        sessions: 6,
        validityDays: 180,
        isActive: true,
      }),
    );
  });
});

describe('runGoLive', () => {
  it('creates each missing Consultation with a key derived from the action’s, then completes', async () => {
    const result = await runGoLive({
      specialties: ['skin', 'hair'],
      nameOf,
      canSetLowestPrice: true,
      idempotencyKey: 'go',
    });

    expect(api.createOffering).toHaveBeenCalledTimes(2);
    expect(api.createOffering).toHaveBeenNthCalledWith(1, {
      fields: starterOfferingFields(consultationOf('skin'), 'Skin consultation'),
      canSetLowestPrice: true,
      specialty: 'skin',
      idempotencyKey: 'go-consultation-skin',
    });
    expect(api.createOffering).toHaveBeenNthCalledWith(2, {
      fields: starterOfferingFields(consultationOf('hair'), 'Hair consultation'),
      canSetLowestPrice: true,
      specialty: 'hair',
      idempotencyKey: 'go-consultation-hair',
    });
    expect(api.completeOnboardingSetup).toHaveBeenCalledWith({
      idempotencyKey: 'go-complete',
    });
    expect(result.setup).toBe(LIVE_SETUP);
    expect(result.created.map((row) => row.name)).toEqual([
      'Skin consultation',
      'Hair consultation',
    ]);
    expect(result.consultations).toEqual([
      { name: 'Skin consultation', price: 500 },
      { name: 'Hair consultation', price: 500 },
    ]);
  });

  it('creates only what is missing and reads the existing one back at its own price', async () => {
    api.fetchAllOfferings.mockResolvedValue([offering('ofr_x', 'consultation', 750)]);

    const result = await runGoLive({
      specialties: ['dental'],
      nameOf,
      canSetLowestPrice: false,
      idempotencyKey: 'go',
    });

    expect(api.createOffering).not.toHaveBeenCalled();
    expect(api.completeOnboardingSetup).toHaveBeenCalledWith({
      idempotencyKey: 'go-complete',
    });
    expect(result.created).toEqual([]);
    expect(result.consultations).toEqual([{ name: 'consultation', price: 750 }]);
  });

  it('passes the server’s 409 on as it came, after the Consultations', async () => {
    const refusal = new HttpError(
      'Conflict',
      409,
      '/app/onboarding-setup/complete',
      'POST',
      {
        error: { reason: 'onboarding_setup_incomplete' },
      },
    );
    api.completeOnboardingSetup.mockRejectedValue(refusal);

    await expect(
      runGoLive({
        specialties: ['skin'],
        nameOf,
        canSetLowestPrice: false,
        idempotencyKey: 'go',
      }),
    ).rejects.toBe(refusal);
    expect(api.createOffering).toHaveBeenCalledTimes(1);
  });

  it('never completes when a Consultation cannot be created', async () => {
    api.createOffering.mockRejectedValue(new Error('offline'));

    await expect(
      runGoLive({
        specialties: ['skin'],
        nameOf,
        canSetLowestPrice: false,
        idempotencyKey: 'go',
      }),
    ).rejects.toThrow('offline');
    expect(api.completeOnboardingSetup).not.toHaveBeenCalled();
  });
});
