import type { z } from 'zod';

import { HttpError } from '@/shared/errors/HttpError.ts';

import type { AppCommon, DeleteReason } from './app-schema.ts';

/**
 * The fixture "server" behind every clinic api module (D6: fixtures first,
 * each call marked `REPLACE_WITH_API`). One in-memory collection per entity,
 * seeded from the prototype, answering the way clinozy-be will per
 * `schema-routes.md` › Operations: cursor pages of 50, per-org `seq` ids,
 * server-set audit fields, soft delete with a reason, restore for Undo, and
 * errors in the API's envelope — so swapping in the real API changes no UI.
 * No artificial latency or failure rate (D15).
 */

/** The contract's list page size. */
export const APP_PAGE_SIZE = 50;

/** Wire shape of every clinic list read. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** The fixture organisation until the API serves the real one. */
export const FIXTURE_ORGANIZATION_ID = '00000000-0000-4000-8000-0000000c1a10';
/** The fixture actor (`createdById`) until the API knows the signed-in user. */
export const FIXTURE_ACTOR_ID = '00000000-0000-4000-8000-0000000a0001';

type Row = AppCommon & { id: string; seq?: number };

/** An error shaped like clinozy-be's envelope, so `mapApiError` / `mapValidationErrors` read it. */
export function appHttpError(
  status: 403 | 404 | 409 | 422,
  code: string,
  detail: string,
  fields?: Record<string, string[]>,
): HttpError {
  return new HttpError(detail, status, '/fixtures', 'FIXTURE', {
    error: { type: 'request_error', code, detail, ...(fields ? { fields } : {}) },
  });
}

/**
 * Validate a write's input the way clinozy-be does: the parsed value, or a 422
 * `validation` error whose `fields` name each failing path (`offerPrice`,
 * `branchIds.0`; a whole-object rule under `root`, react-hook-form's form-level
 * key) — the shape `mapValidationErrors` reads. The detail is the first
 * message, so a toast names the first problem.
 */
export function validateAppInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String).join('.') || 'root';
    fields[path] = [...(fields[path] ?? []), issue.message];
  }
  const first = parsed.error.issues[0]?.message ?? 'Invalid input';
  throw appHttpError(422, 'validation', first, fields);
}

/** The fields a caller actually set — an explicit `undefined` never wipes a default. */
export function definedFields<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** `a` before `b` → negative; plain code-point order (ISO dates, machine values). */
export const compareText = (a: string, b: string) => Number(a > b) - Number(a < b);

/**
 * One cursor page of rows a read has already searched, filtered and ordered —
 * the fixture cursor is an offset into them (D7, pages of 50).
 */
export function cursorPageOf<T>(
  rows: readonly T[],
  cursor: string | null,
): CursorPage<T> {
  const start = cursor ? Number(cursor) : 0;
  const end = start + APP_PAGE_SIZE;
  return {
    items: rows.slice(start, end),
    nextCursor: end < rows.length ? String(end) : null,
  };
}

/** `compare` run in the asked direction — ascending unless `desc`. */
export function directedCompare<T>(
  compare: (a: T, b: T) => number,
  order: 'asc' | 'desc' | undefined,
): (a: T, b: T) => number {
  const direction = order === 'desc' ? -1 : 1;
  return (a, b) => direction * compare(a, b);
}

/** Whether any of `fields` contains the search `q`, case folded; an empty search matches. */
export function searchMatches(q: string | undefined, fields: readonly string[]): boolean {
  const needle = (q ?? '').trim().toLowerCase();
  return !needle || fields.some((field) => field.toLowerCase().includes(needle));
}

/**
 * A 422 on `field` when one of `ids` names no record in `known` — a foreign
 * key the server would refuse.
 */
export function refuseUnknownIds(
  field: string,
  ids: readonly string[],
  known: readonly { id: string }[],
  message: string,
): void {
  const knownIds = new Set(known.map((row) => row.id));
  if (ids.some((id) => !knownIds.has(id))) {
    throw appHttpError(422, 'validation', message, { [field]: [message] });
  }
}

/** A list read: server-side filter and sort, and the cursor of the page to fetch. */
interface ListQuery<T> {
  where?: (row: T) => boolean;
  sort?: (a: T, b: T) => number;
  cursor?: string | null;
}

/** What a create sends: the entity minus its server-set fields. */
export type CreateInput<T> = Omit<T, keyof AppCommon | 'id' | 'seq'>;

/** One entity's fixture server: the reads and writes clinozy-be will answer. */
export interface FixtureCollection<T extends Row> {
  readonly resource: string;
  /** Live (not deleted) rows, synchronously — for joins and derived reads. */
  snapshot(where?: (row: T) => boolean): T[];
  list(query?: ListQuery<T>): Promise<CursorPage<T>>;
  /**
   * One row by id — a 404 when it is unknown or deleted, unless
   * `includeDeleted` asks for a deleted one too (a restore's own checks).
   */
  get(id: string, options?: { includeDeleted?: boolean }): Promise<T>;
  /**
   * A new row. `id` names a record whose identity the server derives — a rule
   * task's, the same on every load, so a reload or a shared link finds it: a
   * live row with that id is a 409, a removed one (an undone create) gives way
   * to the new row. Omitted, the server mints one.
   */
  create(input: CreateInput<T>, options?: { id?: string }): Promise<T>;
  /**
   * Merge a patch into a live row. `stamp: false` leaves `updatedAt` alone — for
   * a per-viewer marker (a read receipt) that is no edit of the record.
   */
  update(
    id: string,
    patch: Partial<CreateInput<T>>,
    options?: { stamp?: boolean },
  ): Promise<T>;
  /** Soft delete with the confirm's reason; `restore` undoes it. */
  remove(id: string, reason: DeleteReason, note: string | null): Promise<T>;
  restore(id: string): Promise<T>;
  /** Forget every change and reseed (tests). */
  reset(): void;
}

const clone = <T>(value: T): T => structuredClone(value);

/** One entity's fixture collection, seeded lazily on first use. */
export function createFixtureCollection<T extends Row>(options: {
  resource: string;
  seed: () => readonly T[];
  now?: () => Date;
  /**
   * Whether the entity carries a per-org `seq`, so a create numbers it.
   * Omitted, it follows the seed — rows with a `seq` (or no rows at all) mean
   * yes — so a created Task or LeadMessage never gains a field its contract
   * lacks.
   */
  sequenced?: boolean;
}): FixtureCollection<T> {
  const now = options.now ?? (() => new Date());
  let rows: T[] | null = null;
  const all = (): T[] => {
    rows ??= options.seed().map(clone);
    return rows;
  };
  const sequenced = (): boolean =>
    options.sequenced ?? all().every((row) => typeof row.seq === 'number');
  const find = (id: string): T => {
    const row = all().find((candidate) => candidate.id === id);
    if (!row) throw appHttpError(404, 'not_found', `${options.resource} not found`);
    return row;
  };
  const live = (where?: (row: T) => boolean) =>
    all().filter((row) => row.deletedAt === null && (!where || where(row)));

  return {
    resource: options.resource,
    snapshot: (where) => live(where).map(clone),
    async list(query = {}) {
      const rowsInView = live(query.where);
      if (query.sort) rowsInView.sort(query.sort);
      // The fixture cursor is an offset; the real one is opaque — callers only pass it back.
      const start = query.cursor ? Number(query.cursor) : 0;
      const end = start + APP_PAGE_SIZE;
      return {
        items: rowsInView.slice(start, end).map(clone),
        nextCursor: end < rowsInView.length ? String(end) : null,
      };
    },
    async get(id, { includeDeleted = false } = {}) {
      const row = find(id);
      if (row.deletedAt !== null && !includeDeleted) {
        throw appHttpError(404, 'not_found', `${options.resource} not found`);
      }
      return clone(row);
    },
    async create(input, { id = crypto.randomUUID() } = {}) {
      const stamp = now().toISOString();
      const seqs = all().map((row) => row.seq ?? 0);
      const named = all().findIndex((candidate) => candidate.id === id);
      if (named >= 0 && all()[named]?.deletedAt === null) {
        throw appHttpError(409, 'conflict', `${options.resource} already exists`);
      }
      const row = {
        ...input,
        id,
        ...(sequenced() ? { seq: Math.max(0, ...seqs) + 1 } : {}),
        organizationId: FIXTURE_ORGANIZATION_ID,
        createdAt: stamp,
        updatedAt: stamp,
        createdById: FIXTURE_ACTOR_ID,
        deletedAt: null,
        deleteReason: null,
        deleteNote: null,
      } as unknown as T;
      if (named >= 0) all().splice(named, 1, row);
      else all().push(row);
      return clone(row);
    },
    async update(id, patch, { stamp = true } = {}) {
      const row = find(id);
      if (row.deletedAt !== null) {
        throw appHttpError(404, 'not_found', `${options.resource} not found`);
      }
      Object.assign(row, patch, stamp ? { updatedAt: now().toISOString() } : {});
      return clone(row);
    },
    async remove(id, reason, note) {
      const row = find(id);
      if (reason === 'other' && !note?.trim()) {
        throw appHttpError(422, 'validation', 'Add a short note for "Other"', {
          note: ['Add a short note for "Other"'],
        });
      }
      Object.assign(row, {
        deletedAt: now().toISOString(),
        deleteReason: reason,
        deleteNote: (note?.trim() ?? '') || null,
      });
      return clone(row);
    },
    async restore(id) {
      const row = find(id);
      Object.assign(row, { deletedAt: null, deleteReason: null, deleteNote: null });
      return clone(row);
    },
    reset() {
      rows = null;
    },
  };
}

/**
 * The writes of one server operation, recorded so a single Undo reverses them
 * all: an update restores the fields it changed, a create is soft-deleted.
 */
export interface FixtureChange {
  update<T extends Row>(
    collection: FixtureCollection<T>,
    id: string,
    patch: Partial<CreateInput<T>>,
  ): Promise<T>;
  create<T extends Row>(
    collection: FixtureCollection<T>,
    input: CreateInput<T>,
    options?: { id?: string },
  ): Promise<T>;
  /** Reverse every recorded write, newest first. */
  reverse(): Promise<void>;
}

/** Start recording one operation's writes. */
export function recordFixtureChange(): FixtureChange {
  const undo: Array<() => Promise<unknown>> = [];
  return {
    async update(collection, id, patch) {
      const before = await collection.get(id);
      const restore = Object.fromEntries(
        Object.keys(patch).map((field) => [field, before[field as keyof typeof before]]),
      ) as typeof patch;
      undo.push(() => collection.update(id, restore));
      return collection.update(id, patch);
    },
    async create(collection, input, options) {
      const row = await collection.create(input, options);
      undo.push(() => collection.remove(row.id, 'mistake', null));
      return row;
    },
    async reverse() {
      for (const step of [...undo].reverse()) await step();
    },
  };
}
