import { HttpError } from '@/shared/errors/HttpError.ts';

import type { ClinicCommon, DeleteReason } from './clinic-schema.ts';

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
export const CLINIC_PAGE_SIZE = 50;

/** Wire shape of every clinic list read. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** The fixture organisation until the API serves the real one. */
export const FIXTURE_ORGANIZATION_ID = '00000000-0000-4000-8000-0000000c1a10';
/** The fixture actor (`createdById`) until the API knows the signed-in user. */
export const FIXTURE_ACTOR_ID = '00000000-0000-4000-8000-0000000a0001';

type Row = ClinicCommon & { id: string; seq?: number };

/** An error shaped like clinozy-be's envelope, so `mapApiError` / `mapValidationErrors` read it. */
export function clinicHttpError(
  status: 403 | 404 | 409 | 422,
  code: string,
  detail: string,
  fields?: Record<string, string[]>,
): HttpError {
  return new HttpError(detail, status, '/fixtures', 'FIXTURE', {
    error: { type: 'request_error', code, detail, ...(fields ? { fields } : {}) },
  });
}

/** A list read: server-side filter and sort, and the cursor of the page to fetch. */
export interface ListQuery<T> {
  where?: (row: T) => boolean;
  sort?: (a: T, b: T) => number;
  cursor?: string | null;
}

/** What a create sends: the entity minus its server-set fields. */
export type CreateInput<T> = Omit<T, keyof ClinicCommon | 'id' | 'seq'>;

/** One entity's fixture server: the reads and writes clinozy-be will answer. */
export interface FixtureCollection<T extends Row> {
  readonly resource: string;
  /** Live (not deleted) rows, synchronously — for joins and derived reads. */
  snapshot(where?: (row: T) => boolean): T[];
  list(query?: ListQuery<T>): Promise<CursorPage<T>>;
  get(id: string): Promise<T>;
  create(input: CreateInput<T>): Promise<T>;
  update(id: string, patch: Partial<CreateInput<T>>): Promise<T>;
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
}): FixtureCollection<T> {
  const now = options.now ?? (() => new Date());
  let rows: T[] | null = null;
  const all = (): T[] => {
    rows ??= options.seed().map(clone);
    return rows;
  };
  const find = (id: string): T => {
    const row = all().find((candidate) => candidate.id === id);
    if (!row) throw clinicHttpError(404, 'not_found', `${options.resource} not found`);
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
      const end = start + CLINIC_PAGE_SIZE;
      return {
        items: rowsInView.slice(start, end).map(clone),
        nextCursor: end < rowsInView.length ? String(end) : null,
      };
    },
    async get(id) {
      const row = find(id);
      if (row.deletedAt !== null) {
        throw clinicHttpError(404, 'not_found', `${options.resource} not found`);
      }
      return clone(row);
    },
    async create(input) {
      const stamp = now().toISOString();
      const seqs = all().map((row) => row.seq ?? 0);
      const row = {
        ...input,
        id: crypto.randomUUID(),
        seq: Math.max(0, ...seqs) + 1,
        organizationId: FIXTURE_ORGANIZATION_ID,
        createdAt: stamp,
        updatedAt: stamp,
        createdById: FIXTURE_ACTOR_ID,
        deletedAt: null,
        deleteReason: null,
        deleteNote: null,
      } as unknown as T;
      all().push(row);
      return clone(row);
    },
    async update(id, patch) {
      const row = find(id);
      if (row.deletedAt !== null) {
        throw clinicHttpError(404, 'not_found', `${options.resource} not found`);
      }
      Object.assign(row, patch, { updatedAt: now().toISOString() });
      return clone(row);
    },
    async remove(id, reason, note) {
      const row = find(id);
      if (reason === 'other' && !note?.trim()) {
        throw clinicHttpError(422, 'validation', 'Add a short note for "Other"', {
          note: ['Add a short note for "Other"'],
        });
      }
      Object.assign(row, {
        deletedAt: now().toISOString(),
        deleteReason: reason,
        deleteNote: note?.trim() || null,
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
