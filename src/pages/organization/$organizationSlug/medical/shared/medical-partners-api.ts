import {
  appHttpError,
  definedFields,
  refuseUnknownIds,
  validateAppInput,
} from '@/shared/api/app/app-fixture-store.ts';
import type {
  DeleteReason,
  Manufacturer,
  MedicalRep,
  MRVisit,
  Supplier,
} from '@/shared/api/app/app-schema.ts';

import {
  MANUFACTURER_TONES,
  type ManufacturerInput,
  manufacturerInputSchema,
  type MedicalRepInput,
  medicalRepInputSchema,
  type MrVisitInput,
  mrVisitInputSchema,
  PARTNER_NAME_MESSAGE,
  type SupplierInput,
  supplierInputSchema,
} from './medical-partners-contracts.ts';

/*
 * The Medical store's partner writes — suppliers, manufacturers, MRs and an
 * MR's visits (`S:1675–1676`) — on the fixture world until clinozy-be serves
 * them (REPLACE_WITH_API, D6). The world is imported on demand, so its seed
 * never lands in a route chunk. A delete is soft (`S:1546`) and restores as
 * the toast's Undo (D32).
 */

const fixtureWorld = () => import('@/shared/api/app/fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['appFixtures'];

/** A 422 on the name — the quick creates' one check. */
function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw appHttpError(422, 'validation', PARTNER_NAME_MESSAGE, {
      name: [PARTNER_NAME_MESSAGE],
    });
  }
  return trimmed;
}

/** A 422 when a picked manufacturer is unknown — the server's foreign-key check. */
function refuseUnknownMakers(world: FixtureWorld, ids: readonly string[]) {
  refuseUnknownIds(
    'manufacturerIds',
    ids,
    world.manufacturers.snapshot(),
    'Pick manufacturers the store has',
  );
}

// ── Suppliers ──

/** Create a supplier from its drawer (`S:1675`; REPLACE_WITH_API). */
export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { appFixtures } = await fixtureWorld();
  const fields = validateAppInput(supplierInputSchema, input);
  refuseUnknownMakers(appFixtures, fields.manufacturerIds);
  return appFixtures.suppliers.create({ ...fields, isQuick: false });
}

/** Save a supplier (`S:1675`; REPLACE_WITH_API): a full save drops the quick flag. */
export async function updateSupplier(
  id: string,
  patch: Partial<SupplierInput>,
): Promise<Supplier> {
  const { appFixtures } = await fixtureWorld();
  const saved = await appFixtures.suppliers.get(id);
  const fields = validateAppInput(supplierInputSchema, {
    ...saved,
    ...definedFields(patch),
  });
  refuseUnknownMakers(appFixtures, fields.manufacturerIds);
  return appFixtures.suppliers.update(id, { ...fields, isQuick: false });
}

/**
 * "Add supplier “Om Pharma”" (`medical.md:316`; REPLACE_WITH_API): the typed
 * name, no phone or GST yet, distributing the makers the picker came from.
 */
export async function quickCreateSupplier(
  name: string,
  manufacturerIds: readonly string[] = [],
): Promise<Supplier> {
  const { appFixtures } = await fixtureWorld();
  refuseUnknownMakers(appFixtures, manufacturerIds);
  return appFixtures.suppliers.create({
    name: requireName(name),
    phone: null,
    gstNumber: null,
    manufacturerIds: [...manufacturerIds],
    isQuick: true,
  });
}

/**
 * Soft-delete a supplier (`S:1546`; REPLACE_WITH_API) — refused while it is
 * owed money or an order is not paid yet (`medical.md:203`; a 409 the UI never
 * offers, since Delete is hidden then).
 */
export async function deleteSupplier(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<Supplier> {
  const { appFixtures } = await fixtureWorld();
  const open = appFixtures.purchaseOrders.snapshot(
    (order) =>
      order.supplierId === id && order.stage !== 'paid' && order.stage !== 'cancelled',
  );
  if (open.length > 0) {
    throw appHttpError(409, 'conflict', 'Settle this supplier’s orders first');
  }
  return appFixtures.suppliers.remove(id, reason, note);
}

/** Restore a deleted supplier — the Undo of its toast (D32). */
export async function restoreSupplier(id: string): Promise<Supplier> {
  const { appFixtures } = await fixtureWorld();
  return appFixtures.suppliers.restore(id);
}

// ── Manufacturers ──

/**
 * Write a manufacturer's connections where they live (`medical.md:221`): each
 * picked supplier and MR gains it, and every other one loses it.
 */
async function linkManufacturer(
  world: FixtureWorld,
  makerId: string,
  supplierIds: readonly string[],
  mrIds: readonly string[],
) {
  const relink = (current: readonly string[], on: boolean) => {
    const has = current.includes(makerId);
    if (on && !has) return [...current, makerId];
    if (!on && has) return current.filter((id) => id !== makerId);
    return null;
  };
  for (const supplier of world.suppliers.snapshot()) {
    const next = relink(supplier.manufacturerIds, supplierIds.includes(supplier.id));
    if (next) await world.suppliers.update(supplier.id, { manufacturerIds: next });
  }
  for (const rep of world.medicalReps.snapshot()) {
    const next = relink(rep.manufacturerIds, mrIds.includes(rep.id));
    if (next) await world.medicalReps.update(rep.id, { manufacturerIds: next });
  }
}

/** The pickers' foreign keys of a manufacturer save. */
function refuseUnknownLinks(
  world: FixtureWorld,
  fields: { supplierIds: readonly string[]; mrIds: readonly string[] },
) {
  refuseUnknownIds(
    'supplierIds',
    fields.supplierIds,
    world.suppliers.snapshot(),
    'Pick suppliers the store buys from',
  );
  refuseUnknownIds('mrIds', fields.mrIds, world.medicalReps.snapshot(), 'Pick known MRs');
}

/**
 * Create a manufacturer and its connections (`S:1675`; REPLACE_WITH_API): the
 * name upper-cased, the links written on the suppliers and MRs.
 */
export async function createManufacturer(
  input: ManufacturerInput,
): Promise<Manufacturer> {
  const { appFixtures } = await fixtureWorld();
  const { supplierIds, mrIds, ...fields } = validateAppInput(
    manufacturerInputSchema,
    input,
  );
  refuseUnknownLinks(appFixtures, { supplierIds, mrIds });
  const maker = await appFixtures.manufacturers.create({ ...fields, isQuick: false });
  await linkManufacturer(appFixtures, maker.id, supplierIds, mrIds);
  return maker;
}

/** Save a manufacturer and its connections (`S:1675`; REPLACE_WITH_API). */
export async function updateManufacturer(
  id: string,
  input: ManufacturerInput,
): Promise<Manufacturer> {
  const { appFixtures } = await fixtureWorld();
  await appFixtures.manufacturers.get(id);
  const { supplierIds, mrIds, ...fields } = validateAppInput(
    manufacturerInputSchema,
    input,
  );
  refuseUnknownLinks(appFixtures, { supplierIds, mrIds });
  const maker = await appFixtures.manufacturers.update(id, {
    ...fields,
    isQuick: false,
  });
  await linkManufacturer(appFixtures, id, supplierIds, mrIds);
  return maker;
}

/**
 * "Add manufacturer “acme”" (`medical.md:315`; REPLACE_WITH_API): "ACME" in
 * the next of the six colours.
 */
export async function quickCreateManufacturer(name: string): Promise<Manufacturer> {
  const { appFixtures } = await fixtureWorld();
  const count = appFixtures.manufacturers.snapshot().length;
  return appFixtures.manufacturers.create({
    name: requireName(name).toUpperCase(),
    tone: MANUFACTURER_TONES[count % MANUFACTURER_TONES.length] ?? 'lav',
    isQuick: true,
  });
}

/**
 * Soft-delete a manufacturer (`S:1546`; REPLACE_WITH_API) — refused while a
 * medicine names it (`medical.md:219`; Delete is hidden then).
 */
export async function deleteManufacturer(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<Manufacturer> {
  const { appFixtures } = await fixtureWorld();
  const used = appFixtures.medicines.snapshot((row) => row.manufacturerId === id);
  if (used.length > 0) {
    throw appHttpError(409, 'conflict', 'Medicines still name this manufacturer');
  }
  return appFixtures.manufacturers.remove(id, reason, note);
}

/** Restore a deleted manufacturer — the Undo of its toast (D32). */
export async function restoreManufacturer(id: string): Promise<Manufacturer> {
  const { appFixtures } = await fixtureWorld();
  return appFixtures.manufacturers.restore(id);
}

// ── MRs ──

/** Create an MR from their drawer (`S:1675`; REPLACE_WITH_API). */
export async function createMedicalRep(input: MedicalRepInput): Promise<MedicalRep> {
  const { appFixtures } = await fixtureWorld();
  const fields = validateAppInput(medicalRepInputSchema, input);
  refuseUnknownMakers(appFixtures, fields.manufacturerIds);
  return appFixtures.medicalReps.create(fields);
}

/** Save an MR (`S:1675`; REPLACE_WITH_API). */
export async function updateMedicalRep(
  id: string,
  patch: Partial<MedicalRepInput>,
): Promise<MedicalRep> {
  const { appFixtures } = await fixtureWorld();
  const saved = await appFixtures.medicalReps.get(id);
  const fields = validateAppInput(medicalRepInputSchema, {
    ...saved,
    ...definedFields(patch),
  });
  refuseUnknownMakers(appFixtures, fields.manufacturerIds);
  return appFixtures.medicalReps.update(id, fields);
}

/** "Add MR “Ravi”" (`medical.md:317`; REPLACE_WITH_API): the typed name, nothing else yet. */
export async function quickCreateMedicalRep(name: string): Promise<MedicalRep> {
  const { appFixtures } = await fixtureWorld();
  return appFixtures.medicalReps.create({
    name: requireName(name),
    phone: null,
    nextVisitOn: null,
    manufacturerIds: [],
  });
}

/** Soft-delete an MR (`S:1546`; REPLACE_WITH_API). */
export async function deleteMedicalRep(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<MedicalRep> {
  const { appFixtures } = await fixtureWorld();
  return appFixtures.medicalReps.remove(id, reason, note);
}

/** Restore a deleted MR — the Undo of their toast (D32). */
export async function restoreMedicalRep(id: string): Promise<MedicalRep> {
  const { appFixtures } = await fixtureWorld();
  return appFixtures.medicalReps.restore(id);
}

/**
 * Log an MR's visit (`logMRVisit`, `S:1676`; REPLACE_WITH_API): the visit
 * joins their history (the row's Last visit and Samples) and its "Next visit"
 * becomes theirs (`medical.md:251`).
 */
export async function logMrVisit(input: MrVisitInput): Promise<MRVisit> {
  const { appFixtures } = await fixtureWorld();
  const { nextVisitOn, ...visit } = validateAppInput(mrVisitInputSchema, input);
  await appFixtures.medicalReps.get(visit.mrId);
  const logged = await appFixtures.mrVisits.create(visit);
  await appFixtures.medicalReps.update(visit.mrId, { nextVisitOn });
  return logged;
}
