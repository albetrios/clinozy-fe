import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
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
 * The Offering drawer's write on the shared drawer save (KICKOFF §6.0 States,
 * §6.11): the price rules first (H:5507) — an offer price above the price, or
 * a lowest price above what is billed, opens step 1 with its toast — then the
 * write. A taken name (`conflict`, `S:1739`) outlines the name. The success
 * toast — "Offering #275 created" / "Offering #273 saved" — is the write's own.
 */
export function useOfferingSave({
  form,
  offeringId,
  onField,
  onDone,
}: UseOfferingSaveOptions) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const create = useCreateOffering({ notifyOnError: false });
  const update = useUpdateOffering({ notifyOnError: false });

  return useDrawerSave<OfferingFormValues, OfferingSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    toastId: 'offering-save-failed',
    check: (values) => {
      const problem = offeringPriceProblem(values);
      return problem
        ? {
            fields: [problem.field],
            message: t(OFFERING_DRAWER_KEYS.toasts[problem.rule]),
          }
        : null;
    },
    onConflict: (error) => {
      const message = mapApiError(error);
      form.setError('name', { type: 'server', message });
      onField('name');
      notify.error(message);
    },
    onField: (field) => onField(field as keyof OfferingFormValues),
    write: async () => {
      const input = offeringInputOf(form.getValues());
      if (offeringId) {
        return {
          kind: 'saved',
          offering: await update.mutateAsync({ id: offeringId, patch: input }),
        };
      }
      return { kind: 'created', offering: await create.mutateAsync(input) };
    },
    onDone,
  });
}
