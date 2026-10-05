import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  CLINIC_PAGE_SIZE,
  compareText,
  createFixtureCollection,
  definedFields,
  FIXTURE_ACTOR_ID,
  FIXTURE_ORGANIZATION_ID,
  recordFixtureChange,
  refuseUnknownIds,
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

  it('stamps updatedAt on an edit, and leaves it alone for a marker that is no edit', async () => {
    let clock = NOW;
    const collection = createFixtureCollection<Thing>({
      resource: 'Thing',
      seed: () => [thing(1)],
      now: () => clock,
    });
    clock = new Date('2026-10-03T06:00:00Z');
    const marked = await collection.update(
      thing(1).id,
      { name: 'Read' },
      { stamp: false },
    );
    expect(marked.updatedAt).toBe(NOW.toISOString());
    const edited = await collection.update(thing(1).id, { name: 'Edited' });
    expect(edited.updatedAt).toBe(clock.toISOString());
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

  it('names a row by the id the caller derives: a live twin is a 409, a removed one gives way', async () => {
    const collection = things();
    const id = '00000000-0000-4000-8000-0000000000aa';
    const created = await collection.create({ name: 'Named' }, { id });
    expect(created.id).toBe(id);
    expect((await collection.get(id)).name).toBe('Named');

    const twin = await collection
      .create({ name: 'Twin' }, { id })
      .catch((caught: unknown) => caught);
    expect(isHttpError(twin) && twin.status === 409).toBe(true);

    await collection.remove(id, 'mistake', null);
    await collection.create({ name: 'Again' }, { id });
    expect((await collection.get(id)).name).toBe('Again');
    expect(collection.snapshot((row) => row.id === id)).toHaveLength(1);
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

describe('the write helpers', () => {
  it('keeps only the fields a caller set — an explicit undefined never wipes a default', () => {
    expect(
      definedFields({ name: 'Peel', note: undefined, price: 0, tags: null }),
    ).toEqual({ name: 'Peel', price: 0, tags: null });
  });

  it('orders text by code point', () => {
    expect(['b', 'a', 'c'].sort(compareText)).toEqual(['a', 'b', 'c']);
    expect(compareText('2026-10-03', '2026-10-03')).toBe(0);
  });

  it('answers a 422 on the field when an id names no record', () => {
    const known = [{ id: 'a' }, { id: 'b' }];
    expect(() => refuseUnknownIds('ownerId', ['a', 'b'], known, 'Pick')).not.toThrow();
    const error = (() => {
      try {
        refuseUnknownIds('ownerId', ['a', 'z'], known, 'Pick someone on the team');
      } catch (caught) {
        return caught;
      }
      return null;
    })();
    expect(isHttpError(error) && error.status === 422).toBe(true);
    expect(isHttpError(error) && error.data).toMatchObject({
      error: { code: 'validation', fields: { ownerId: ['Pick someone on the team'] } },
    });
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

describe('records without a seq', () => {
  type Note = Omit<Thing, 'seq'> & { seq?: number };
  const note = (index: number): Note => {
    const row: Note = thing(index);
    delete row.seq;
    return row;
  };

  it('numbers creates only for an entity whose rows carry a seq', async () => {
    const notes = createFixtureCollection<Note>({
      resource: 'Note',
      seed: () => [note(1), note(2)],
      now: () => NOW,
    });
    expect(await notes.create({ name: 'New' })).not.toHaveProperty('seq');
    const empty = createFixtureCollection<Thing>({ resource: 'Thing', seed: () => [] });
    expect((await empty.create({ name: 'First' })).seq).toBe(1);
    const unsequenced = createFixtureCollection<Note>({
      resource: 'Note',
      seed: () => [],
      sequenced: false,
    });
    expect(await unsequenced.create({ name: 'First' })).not.toHaveProperty('seq');
  });
});

describe('validateClinicInput — trimmed values, every field', () => {
  it('answers a 422 with each field’s messages, or the parsed value', () => {
    const schema = z.object({
      title: z.string().trim().min(1),
      count: z.number().max(3),
    });
    expect(validateClinicInput(schema, { title: ' Hi ', count: 1 })).toEqual({
      title: 'Hi',
      count: 1,
    });
    let error: unknown;
    try {
      validateClinicInput(schema, { title: '', count: 9 });
    } catch (caught) {
      error = caught;
    }
    expect(isHttpError(error) && error.status).toBe(422);
    expect(
      isHttpError(error) && (error.data as { error: { fields: object } }).error.fields,
    ).toEqual({ title: [expect.any(String)], count: [expect.any(String)] });
  });
});

describe('recordFixtureChange', () => {
  it('reverses one operation’s updates and creates, newest first', async () => {
    const collection = things();
    const change = recordFixtureChange();
    await change.update(collection, thing(1).id, { name: 'Renamed' });
    await change.update(collection, thing(1).id, { name: 'Renamed again' });
    const created = await change.create(collection, { name: 'Extra' });
    expect(collection.snapshot()).toHaveLength(121);

    await change.reverse();
    expect((await collection.get(thing(1).id)).name).toBe('Thing 1');
    expect(collection.snapshot((row) => row.id === created.id)).toEqual([]);
  });
});
