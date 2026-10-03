import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  CLINIC_PAGE_SIZE,
  createFixtureCollection,
  FIXTURE_ACTOR_ID,
  FIXTURE_ORGANIZATION_ID,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import type { ClinicCommon } from './clinic-schema.ts';

type Thing = ClinicCommon & { id: string; seq: number; name: string };

const NOW = new Date('2026-10-03T05:00:00Z');

function thing(seq: number): Thing {
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    seq,
    name: `Thing ${seq}`,
    organizationId: FIXTURE_ORGANIZATION_ID,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    createdById: FIXTURE_ACTOR_ID,
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
  };
}

const things = () =>
  createFixtureCollection<Thing>({
    resource: 'Thing',
    seed: () => Array.from({ length: 120 }, (_, index) => thing(index + 1)),
    now: () => NOW,
  });

describe('fixture collection', () => {
  it('pages by the contract size with a cursor until the last page', async () => {
    const collection = things();
    const first = await collection.list();
    expect(first.items).toHaveLength(CLINIC_PAGE_SIZE);
    const second = await collection.list({ cursor: first.nextCursor });
    const third = await collection.list({ cursor: second.nextCursor });
    expect(third.items).toHaveLength(20);
    expect(third.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items, ...third.items].map((t) => t.id)).size,
    ).toBe(120);
  });

  it('filters and sorts on the server side', async () => {
    const page = await things().list({
      where: (row) => row.seq % 2 === 0,
      sort: (a, b) => b.seq - a.seq,
    });
    expect(page.items[0]?.seq).toBe(120);
    expect(page.items.every((row) => row.seq % 2 === 0)).toBe(true);
  });

  it('creates with the next seq and server-set audit fields', async () => {
    const created = await things().create({ name: 'New' });
    expect(created.seq).toBe(121);
    expect(created.createdAt).toBe(NOW.toISOString());
    expect(created.deletedAt).toBeNull();
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('soft-deletes with a reason, hides the row, and restores it for Undo', async () => {
    const collection = things();
    const target = thing(7).id;
    const removed = await collection.remove(target, 'duplicate', null);
    expect(removed.deleteReason).toBe('duplicate');
    expect(collection.snapshot((row) => row.id === target)).toHaveLength(0);
    await expect(collection.get(target)).rejects.toSatisfy(
      (error) => isHttpError(error) && error.status === 404,
    );
    await collection.restore(target);
    expect((await collection.get(target)).deletedAt).toBeNull();
  });

  it('refuses "Other" without a note, as a validation error on the note field', async () => {
    const error = await things()
      .remove(thing(3).id, 'other', '  ')
      .catch((caught: unknown) => caught);
    expect(isHttpError(error) && error.status === 422).toBe(true);
    expect(
      isHttpError(error) && (error.data as { error: { fields: object } }).error.fields,
    ).toHaveProperty('note');
  });

  it('never hands out its own rows (mutating a result changes nothing)', async () => {
    const collection = things();
    const row = await collection.get(thing(1).id);
    row.name = 'mutated';
    expect((await collection.get(thing(1).id)).name).toBe('Thing 1');
  });

  it('reset reseeds', async () => {
    const collection = things();
    await collection.create({ name: 'Extra' });
    collection.reset();
    expect(collection.snapshot()).toHaveLength(120);
  });

  it('invents no seq for an entity without a display id', async () => {
    type Plain = ClinicCommon & { id: string; name: string };
    const plain = createFixtureCollection<Plain>({
      resource: 'Plain',
      seed: () => [],
      now: () => NOW,
      sequenced: false,
    });
    const created = await plain.create({ name: 'No number' });
    expect(created).not.toHaveProperty('seq');
    expect(created.name).toBe('No number');
  });
});

describe('validateClinicInput', () => {
  const schema = z
    .object({ name: z.string().min(1, 'Add a name'), tags: z.array(z.uuid()) })
    .strict();

  it('hands back the parsed input', () => {
    expect(validateClinicInput(schema, { name: 'Peel', tags: [] })).toEqual({
      name: 'Peel',
      tags: [],
    });
  });

  it('answers a 422 naming each failing path, the first message as the detail', () => {
    const error = (() => {
      try {
        validateClinicInput(schema, { name: '', tags: ['not-a-uuid'] });
      } catch (caught) {
        return caught;
      }
      return null;
    })();
    expect(isHttpError(error) && error.status === 422).toBe(true);
    const body = isHttpError(error)
      ? (error.data as { error: { code: string; detail: string; fields: object } }).error
      : null;
    expect(body?.code).toBe('validation');
    expect(body?.detail).toBe('Add a name');
    expect(body?.fields).toEqual({
      name: ['Add a name'],
      'tags.0': [expect.any(String)],
    });
  });
});
