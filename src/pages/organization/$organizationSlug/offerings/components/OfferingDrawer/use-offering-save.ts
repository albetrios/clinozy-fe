import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  isOfferingNameTaken,
  type OfferingRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import {
  useCreateOffering,
  useUpdateOffering,
} from '@/shared/hooks/useOfferings/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { OFFERING_DRAWER_KEYS, OFFERING_DRAWER_NS } from './offering-drawer.constants.ts';
import {
  offeringFieldsOf,
  type OfferingFormValues,
  offeringPriceProblem,
  offeringPricesOf,
} from './offering-form.ts';
import { offeringRefusalOnForm } from './offering-refusal.ts';

const K = OFFERING_DRAWER_KEYS.toasts;

/** The failed save's toast id — a second failure replaces it. */
const SAVE_TOAST_ID = 'offering-save-failed';

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER: readonly (keyof OfferingFormValues)[] = [
  'name',
  'category',
  'tone',
  'branchIds',
  'price',
  'offerPrice',
  'sessions',
  'gstPercent',
  'isGstInclusive',
  'minPrice',
  'durationMinutes',
  'validityDays',
  'searchTerms',
  'description',
  'isActive',
];

/** The most search terms and branches an offering takes (the API's `≤ 20`). */
const LIST_LIMIT = 20;

/**
 * A refusal names one search term or branch by its place (`body.search_terms/3` →
 * `searchTerms.3`): the form holds each list as one field.
 */
const SERVER_FIELDS: Readonly<Record<string, keyof OfferingFormValues>> =
  Object.fromEntries(
    Array.from({ length: LIST_LIMIT }, (_, index) => [
      [`searchTerms.${index}`, 'searchTerms'],
      [`branchIds.${index}`, 'branchIds'],
    ]).flat(),
  );

/** What a save ended with: the new offering, or the saved one. */
export type OfferingSaveOutcome =
  | { kind: 'created'; offering: OfferingRecord }
  | { kind: 'saved'; offering: OfferingRecord };

/** Options of {@link useOfferingSave}. */
export interface UseOfferingSaveOptions {
  form: UseFormReturn<OfferingFormValues>;
  /** The offering an edit saves, as last read (its `updated_at` guards the save); a create has none. */
  record: OfferingRecord | null;
  /** The member holds `offering:lower_price:read`: the lowest price is theirs to see and set. */
  canSeeFloor: boolean;
  /** Open the step that holds a field — the one a check or the server named. */
  onField: (field: keyof OfferingFormValues) => void;
  /** Someone saved the offering meanwhile (`409 record_changed`): read it again. */
  onStale?: () => void;
  /** The save went through; `another` when it was "Create & add another". */
  onDone: (outcome: OfferingSaveOutcome, another: boolean) => void;
}

/**
 * The Offering drawer's write on the shared drawer save (KICKOFF §6.0 States,
 * §6.11): the price rules first (H:5507) — an offer price above the price, or a
 * lowest price above what is billed, opens its step with its toast — then the
 * write: `POST /app/offerings`, or `PATCH` with only what changed and the read's
 * `updated_at`. A taken name (`409 offering_name_taken`) outlines the name; a
 * stale save (`409 record_changed`) toasts with Reload (`onStale`); the server's
 * field refusals land on their fields — a lowest price the member cannot see on
 * the price they typed (gap 7). The success toast — "Offering #8 created" /
 * "Offering #5 saved" — is the write's own.
 */
export function useOfferingSave({
  form,
  record,
  canSeeFloor,
  onField,
  onStale,
  onDone,
}: UseOfferingSaveOptions) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const create = useCreateOffering({ notifyOnError: false });
  const update = useUpdateOffering({ notifyOnError: false });

  const writeOffering = async (
    values: OfferingFormValues,
  ): Promise<OfferingSaveOutcome> => {
    const fields = offeringFieldsOf(values, { canSeeFloor });
    if (record) {
      return { kind: 'saved', offering: await update.mutateAsync({ record, fields }) };
    }
    return { kind: 'created', offering: await create.mutateAsync({ fields }) };
  };

  return useDrawerSave<OfferingFormValues, OfferingSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: SAVE_TOAST_ID,
    check: (values) => {
      const problem = offeringPriceProblem(values);
      return problem ? { fields: [problem.field], message: t(K[problem.rule]) } : null;
    },
    onConflict: (error) => {
      const message = mapApiError(error);
      if (isOfferingNameTaken(error)) {
        form.setError('name', { type: 'server', message });
        onField('name');
      }
      notify.error(message, { id: SAVE_TOAST_ID });
    },
    onStale,
    onField: (field) => onField(field as keyof OfferingFormValues),
    write: async () => {
      const values = form.getValues();
      try {
        return await writeOffering(values);
      } catch (error) {
        throw offeringRefusalOnForm(error, {
          canSeeFloor,
          hasOfferPrice: offeringPricesOf(values).offerPrice !== null,
          messages: {
            belowFloor: t(K.offerBelowFloor),
            floorNeedsPermission: t(K.floorNeedsPermission),
          },
        });
      }
    },
    onDone,
  });
}
