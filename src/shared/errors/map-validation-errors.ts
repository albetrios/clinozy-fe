import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ValidationError } from '@/shared/errors/AppError.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

/** Read per-field validation messages from a clinozy-be error body. */
function readFieldErrors(data: unknown): Record<string, string[]> | null {
  if (!data || typeof data !== 'object') return null;
  const body = data as {
    error?: { fields?: unknown; field_errors?: unknown };
    errors?: unknown;
  };
  const nested = body.error?.fields ?? body.error?.field_errors ?? body.errors;
  if (!nested || typeof nested !== 'object') return null;

  // Field names come straight off the wire, so they are attacker-influenced in principle.
  // A null-prototype accumulator means a payload carrying `__proto__` (or `constructor`)
  // writes an ordinary own property instead of reaching the prototype chain — `{}` would
  // have let `out['__proto__'] = […]` reassign this object's prototype.
  const out = Object.create(null) as Record<string, string[]>;
  for (const [field, value] of Object.entries(nested as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const messages = value.filter((m): m is string => typeof m === 'string');
      if (messages.length > 0) out[field] = messages;
      continue;
    }
    if (typeof value === 'string') {
      out[field] = [value];
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** clinozy-be's request-part prefixes on a validation field (`querystring.limit`, `body.items/0/rate`). */
const REQUEST_PART_PREFIX = /^(?:body|querystring|params|headers)\./;

/**
 * A validation field as the form names it: the request part dropped, `/` path steps as dots,
 * each snake_case segment in camelCase — `body.items/0/discount_percent` → `items.0.discountPercent`.
 * A form that spells a field differently maps the result itself (`useDrawerSave`'s `serverFields`).
 */
export function formFieldOf(serverField: string): string {
  return serverField
    .replace(REQUEST_PART_PREFIX, '')
    .split(/[/.]/)
    .filter((segment) => segment !== '')
    .map((segment) =>
      segment.replaceAll(/_([a-z0-9])/g, (_match, letter: string) =>
        letter.toUpperCase(),
      ),
    )
    .join('.');
}

/** One entry of clinozy-be's validation list (`error.errors[]`), as the wire names its field. */
export interface ValidationEntry {
  /** The field as sent — `body.items/0/rate`, `min_price`; {@link formFieldOf} names it for a form. */
  field: string;
  message: string;
}

/** Whether a listed value is a validation entry: an object with a string field and message. */
function isValidationEntry(entry: unknown): entry is ValidationEntry {
  if (!entry || typeof entry !== 'object') return false;
  const { field, message } = entry as { field?: unknown; message?: unknown };
  return typeof field === 'string' && typeof message === 'string';
}

/**
 * clinozy-be's validation list — `error.errors[]` of `400 { error: { type: 'validation_error',
 * errors: [{ field, message }] } }` — as sent: the entries themselves (fields not renamed),
 * anything that is not a `{ field, message }` pair skipped; empty when the body has no list.
 * For a screen that reads or rewords the server's entries; a form takes them through
 * {@link mapValidationErrors}.
 */
export function readValidationEntries(data: unknown): ValidationEntry[] {
  if (!data || typeof data !== 'object') return [];
  const list = (data as { error?: { errors?: unknown } }).error?.errors;
  return Array.isArray(list) ? list.filter(isValidationEntry) : [];
}

/**
 * clinozy-be's validation answer ({@link readValidationEntries}) as form fields and their
 * messages (first message per field kept).
 */
function readValidationList(data: unknown): Record<string, string[]> | null {
  const out = Object.create(null) as Record<string, string[]>;
  for (const { field, message } of readValidationEntries(data)) {
    if (field === '') continue;
    const name = formFieldOf(field);
    if (name === '') continue;
    out[name] = [...(out[name] ?? []), message];
  }
  return Object.keys(out).length > 0 ? out : null;
}

function applyFields<T extends FieldValues>(
  fields: Record<string, string[]>,
  setError: UseFormSetError<T>,
): boolean {
  let applied = false;
  for (const [field, messages] of Object.entries(fields)) {
    const message = messages[0];
    if (!message) continue;
    setError(field as Path<T>, { type: 'server', message });
    applied = true;
  }
  return applied;
}

/**
 * Map a validation failure onto react-hook-form field errors: clinozy-be's `400` with its
 * `errors[]` list (fields named as the form names them, {@link formFieldOf}), a `422` with a
 * field map, or a client {@link ValidationError}. Returns `true` when at least one field error
 * was applied.
 */
export function mapValidationErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (error instanceof ValidationError) {
    return applyFields(error.fieldErrors, setError);
  }

  if (isHttpError(error) && error.status === 400) {
    const fields = readValidationList(error.data);
    return fields ? applyFields(fields, setError) : false;
  }

  if (isHttpError(error) && error.status === 422) {
    const fields = readFieldErrors(error.data);
    return fields ? applyFields(fields, setError) : false;
  }

  return false;
}
