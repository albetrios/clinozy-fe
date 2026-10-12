import { useState } from 'react';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import {
  apiErrorReason,
  mapApiError,
  notifyError,
} from '@/shared/errors/errorHandler.ts';
import { type HttpError, isHttpError } from '@/shared/errors/HttpError.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import { notify } from '@/shared/notify/index.ts';

/** A rule the form breaks before anything is sent: the fields it names and its toast. */
export interface DrawerSaveProblem<TValues extends FieldValues> {
  fields: readonly FieldPath<TValues>[];
  message: string;
}

/** Options of {@link useDrawerSave}. */
export interface UseDrawerSaveOptions<TValues extends FieldValues, TOutcome> {
  form: UseFormReturn<TValues>;
  /** The form's fields in the drawer's order — a server error opens the first one it names. */
  fieldOrder: readonly FieldPath<TValues>[];
  /** The contract's names the form spells differently (`followUpAt` → `followUpDate`). */
  serverFields?: Readonly<Record<string, FieldPath<TValues>>>;
  /** The client rules, checked before the write; `null` lets it through. */
  check?: (values: TValues) => DrawerSaveProblem<TValues> | null;
  /**
   * The server refused with a conflict (409, e.g. a taken name or mobile): the
   * screen shows it its own way. Without it a conflict reads as any refusal.
   */
  onConflict?: (error: HttpError) => void;
  /**
   * The record changed since the drawer loaded it (`409 record_changed`, sent when the save
   * carries `expected_updated_at`): load it again. Given, the failure toast offers "Reload".
   */
  onStale?: () => void;
  /** Open the step that holds a field — the one a check or the server named. */
  onField: (field: FieldPath<TValues>) => void;
  /** The write itself: create or update, and whatever follows it. */
  write: (another: boolean) => Promise<TOutcome>;
  /** The write went through; `another` when it was "Save & add another". */
  onDone: (outcome: TOutcome, another: boolean) => void;
  /** The failed save's toast id — one per drawer, so a second failure replaces it. */
  toastId: string;
}

/**
 * A record drawer's save and its outcomes (KICKOFF §6.0 States, §3.5 Footer).
 * The screen's client rules run first: a broken one outlines its fields, opens
 * the first one's step and toasts. Then the write, with "Saving…" holding
 * every exit. A `validation` error outlines its fields, opens the first one's
 * step and toasts its message; a stale save (`record_changed`) toasts in our words with "Reload"
 * (`onStale`); a `conflict` goes to the screen; another
 * refusal toasts the server's reason. A dropped connection — or a server
 * failure — keeps the draft with "Not saved · your changes are kept", "Retry
 * save", and a toast whose "Retry" saves again. On success the state stays
 * "saving": the drawer closes on the outcome, and nothing may leave first.
 */
export function useDrawerSave<TValues extends FieldValues, TOutcome>({
  form,
  fieldOrder,
  serverFields = {},
  check,
  onConflict,
  onStale,
  onField,
  write,
  onDone,
  toastId,
}: UseDrawerSaveOptions<TValues, TOutcome>) {
  const { t } = useTranslation([RECORD_DRAWER_NS, ERRORS_NS]);
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');

  const refused = (error: unknown) => {
    setSaveState('idle');
    if (apiErrorReason(error) === 'record_changed') {
      // Someone else saved first: our own words (the server's detail names a user id and a
      // time — `mapApiError` maps the reason), and a way to load what they saved.
      notifyError(error, {
        id: toastId,
        ...(onStale && {
          action: {
            label: t(ERRORS_KEYS.api.reload, { ns: ERRORS_NS }),
            onClick: onStale,
          },
        }),
      });
      return;
    }
    if (onConflict && isHttpError(error) && error.status === 409) {
      onConflict(error);
      return;
    }
    const named: string[] = [];
    mapValidationErrors<TValues>(error, (name, option) => {
      const field = serverFields[name] ?? (name as FieldPath<TValues>);
      form.setError(field, option);
      named.push(field);
    });
    const first = fieldOrder.find((field) => named.includes(field));
    if (first) onField(first);
    const message = first ? form.getFieldState(first).error?.message : undefined;
    notify.error(message ?? mapApiError(error));
  };

  const save = async (another = false): Promise<void> => {
    const problem = check?.(form.getValues());
    if (problem) {
      for (const field of problem.fields) {
        form.setError(field, { type: 'client', message: problem.message });
      }
      const [first] = problem.fields;
      if (first) onField(first);
      notify.warning(problem.message);
      return;
    }
    form.clearErrors();
    setSaveState('saving');
    try {
      onDone(await write(another), another);
    } catch (error) {
      if (isHttpError(error) && error.status < 500) {
        refused(error);
        return;
      }
      setSaveState('failed');
      notify.error(t(RECORD_DRAWER_KEYS.saveFailed, { ns: RECORD_DRAWER_NS }), {
        id: toastId,
        action: {
          label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }),
          onClick: () => void save(another),
        },
      });
    }
  };

  return { saveState, save };
}
