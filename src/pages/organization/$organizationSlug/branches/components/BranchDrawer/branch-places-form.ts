import { useCallback, useEffect, useState } from 'react';
import type { FieldValues, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';

import { appToday, localDateOf } from '@/shared/api/app/app-time.ts';
import { BRANCH_PLACE_LIMITS } from '@/shared/api/app/branch-places-contracts.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { BRANCHES_KEYS } from '../../branches.constants.ts';

const K = BRANCHES_KEYS.drawer.places;

/**
 * An add or rename row's one field (KICKOFF §5 Places & days: RHF + Zod per row): a room's or
 * machine's name, 1–60 characters once trimmed. Messages are `branches` keys the row reads out.
 */
export const placeNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, K.nameMissing)
    .max(BRANCH_PLACE_LIMITS.name, K.nameTooLong),
});

/** A new holiday: its date, then its label (1–60 characters once trimmed). */
export const holidaySchema = z.object({
  date: z
    .string()
    .nullable()
    .refine((date) => Boolean(date), K.dateMissing),
  label: z
    .string()
    .trim()
    .min(1, K.labelMissing)
    .max(BRANCH_PLACE_LIMITS.label, K.labelTooLong),
});

/** The holiday row's starting values: no date, no label. */
export const EMPTY_HOLIDAY: z.input<typeof holidaySchema> = { date: null, label: '' };

/** Who may do what in "Places & days" — the `branch:*` codes, as the server checks them. */
export interface BranchPlacesAccess {
  /** `branch:create` — the add rows. */
  canAdd: boolean;
  /** `branch:update` — rename, and the on / off switch (shown, disabled, without it). */
  canEdit: boolean;
  /** `branch:delete` — Remove, with its Undo. */
  canRemove: boolean;
}

/** Nothing but reading: the access a member without any `branch:*` write has. */
export const READ_ONLY_PLACES: BranchPlacesAccess = {
  canAdd: false,
  canEdit: false,
  canRemove: false,
};

/** A row editor tells the drawer whether it holds unsaved text (its key, and whether it does). */
export type PlaceDraftReport = (key: string, dirty: boolean) => void;

/**
 * Which row editors hold text not yet saved — the drawer's "Discard changes?" asks for them too
 * (Standing deviation "Dirty close": only unsaved edits ask). An editor that closes reports clean.
 */
export function usePlaceDrafts() {
  const [drafts, setDrafts] = useState<ReadonlySet<string>>(() => new Set());
  const report = useCallback<PlaceDraftReport>((key, dirty) => {
    setDrafts((current) => {
      if (current.has(key) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  return { dirty: drafts.size > 0, report };
}

/** Report a row editor's unsaved state up, and clean once it closes. */
export function useReportDraft(key: string, dirty: boolean, report: PlaceDraftReport) {
  useEffect(() => {
    report(key, dirty);
  }, [key, dirty, report]);
  useEffect(() => () => report(key, false), [key, report]);
}

/**
 * What a refused row write shows. Someone else's change first (`409 record_changed`): the
 * server's reason as a toast, and the list read again. A reasonless 409 is a name (or day) the
 * branch already has: `onTaken` says so at the field. A 400 naming a field the row holds
 * outlines it there; anything else is one toast.
 */
export function reportRowWriteFailure(
  error: unknown,
  {
    onTaken,
    fields = {},
    setFieldError,
    onStale,
  }: {
    onTaken: () => void;
    /** The server's field names (as the error mapper spells them) → the row's own. */
    fields?: Readonly<Record<string, string>>;
    setFieldError?: (field: string, message: string) => void;
    onStale?: () => void;
  },
): void {
  const reason = apiErrorReason(error);
  if (reason === 'record_changed') {
    notifyError(error);
    onStale?.();
    return;
  }
  if (isHttpError(error) && error.status === 409 && !reason) {
    onTaken();
    return;
  }
  let shown = false;
  const collect: UseFormSetError<FieldValues> = (name, { message }) => {
    const field = fields[name];
    if (field && message && setFieldError) {
      setFieldError(field, message);
      shown = true;
    }
  };
  mapValidationErrors(error, collect);
  if (!shown) notifyError(error);
}

/**
 * Marks an open rename row: Esc there cancels the rename, and the branch drawer lets it — it does
 * not close (`isInlineEditEscape`, the drawer's `onEscapeKeyDown`).
 */
export const INLINE_EDIT_ATTRIBUTE = 'data-inline-edit';

/** Whether an Esc began inside an open rename row — the row takes it, not the drawer. */
export function isInlineEditEscape(event: KeyboardEvent): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest(`[${INLINE_EDIT_ATTRIBUTE}]`) !== null
  );
}

/** A list's rows: hairlines between them, none after the last. */
export const PLACE_ROW_CLASS =
  'border-b-muted flex min-h-11 min-w-0 items-center gap-2.5 border-b py-1.5 last:border-b-0';

/**
 * A holiday's day as the rows say it — "Sun, 8 Nov", with the year when it is not this one.
 * Civil dates: the clinic's calendar day, never shifted by the viewer's zone.
 */
export function useHolidayDay() {
  const { formatDate } = useLocaleFormat();
  const [thisYear] = useState(() => appToday().slice(0, 4));
  return useCallback(
    (date: string) =>
      formatDate(
        localDateOf(date),
        {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          ...(date.startsWith(thisYear) ? {} : { year: 'numeric' }),
        },
        { civilDay: true },
      ),
    [formatDate, thisYear],
  );
}
