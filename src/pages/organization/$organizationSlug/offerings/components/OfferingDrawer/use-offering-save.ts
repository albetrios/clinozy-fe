import { useState } from 'react';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import {
  useCreateOffering,
  useUpdateOffering,
} from '@/shared/hooks/useOfferings/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { OFFERING_DRAWER_KEYS, OFFERING_DRAWER_NS } from './offering-drawer.constants.ts';
import {
  type OfferingFormValues,
  offeringInputOf,
  offeringPriceProblem,
} from './offering-form.ts';

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER: readonly (keyof OfferingFormValues)[] = [
  'name',
  'category',
  'tone',
  'branchIds',
  'price',
  'offerPrice',
  'sessions',
  'gstPct',
  'gstInclusive',
  'minPrice',
  'durationMin',
  'validityDays',
  'searchTerms',
  'description',
  'active',
];

/** What a save ended with: the new offering, or the saved one. */
export type OfferingSaveOutcome =
  | { kind: 'created'; offering: OfferingRecord }
  | { kind: 'saved'; offering: OfferingRecord };

/** Options of {@link useOfferingSave}. */
export interface UseOfferingSaveOptions {
  form: UseFormReturn<OfferingFormValues>;
  /** The offering an edit saves; a create has none. */
  offeringId: string | null;
  /** Open the step that holds a field — the one a check or the server named. */
  onField: (field: keyof OfferingFormValues) => void;
  /** The save went through; `another` when it was "Create & add another". */
  onDone: (outcome: OfferingSaveOutcome, another: boolean) => void;
}

/**
 * The Offering drawer's write and its outcomes (KICKOFF §6.0 States, §6.11).
 * The price rules are checked first (H:5507): an offer price above the price,
 * or a lowest price above what is billed, opens step 1 with its toast. A
 * `validation` error outlines its fields, opens the first one's step and
 * toasts its message; a `conflict` (the name is taken, `S:1739`) outlines the
 * name; another refusal toasts the server's reason. A dropped connection (or
 * a server failure) keeps the draft with "Not saved · your changes are kept",
 * "Retry save" and a toast whose "Retry" saves again. The success toast —
 * "Offering #275 created" / "Offering #273 saved" — is the write's own.
 */
export function useOfferingSave({
  form,
  offeringId,
  onField,
  onDone,
}: UseOfferingSaveOptions) {
  const { t } = useTranslation([OFFERING_DRAWER_NS, ERRORS_NS]);
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const create = useCreateOffering({ notifyOnError: false });
  const update = useUpdateOffering({ notifyOnError: false });

  const refused = (error: unknown) => {
    setSaveState('idle');
    const named: (keyof OfferingFormValues)[] = [];
    const applied = mapValidationErrors<OfferingFormValues>(error, (name, option) => {
      form.setError(name as FieldPath<OfferingFormValues>, option);
      named.push(name as keyof OfferingFormValues);
    });
    if (!applied && isHttpError(error) && error.status === 409) {
      // A taken name (`S:1739`): the name carries the server's words.
      form.setError('name', { type: 'server', message: mapApiError(error) });
      named.push('name');
    }
    const first = FIELD_ORDER.find((field) => named.includes(field));
    if (first) onField(first);
    const message = first ? form.getFieldState(first).error?.message : undefined;
    notify.error(message ?? mapApiError(error));
  };

  const failed = (error: unknown, retry: () => void) => {
    if (isHttpError(error) && error.status < 500) {
      refused(error);
      return;
    }
    setSaveState('failed');
    notify.error(t(RECORD_DRAWER_KEYS.saveFailed, { ns: RECORD_DRAWER_NS }), {
      id: 'offering-save-failed',
      action: { label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }), onClick: retry },
    });
  };

  const save = async (another: boolean): Promise<void> => {
    const values = form.getValues();
    const problem = offeringPriceProblem(values);
    if (problem) {
      const message = t(OFFERING_DRAWER_KEYS.toasts[problem.rule]);
      form.setError(problem.field, { type: 'client', message });
      onField(problem.field);
      notify.warning(message);
      return;
    }
    form.clearErrors();
    setSaveState('saving');
    try {
      const input = offeringInputOf(values);
      if (offeringId) {
        const offering = await update.mutateAsync({ id: offeringId, patch: input });
        // The drawer closes on this outcome: "Saving…" holds every exit until it has.
        onDone({ kind: 'saved', offering }, false);
        return;
      }
      const offering = await create.mutateAsync(input);
      onDone({ kind: 'created', offering }, another);
    } catch (error) {
      failed(error, () => void save(another));
    }
  };

  return { saveState, save };
}
