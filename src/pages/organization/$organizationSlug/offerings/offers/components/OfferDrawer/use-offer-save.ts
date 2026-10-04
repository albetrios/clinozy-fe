import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateOffer, useUpdateOffer } from '@/shared/hooks/useOffers/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { OFFER_DRAWER_KEYS, OFFER_DRAWER_NS } from './offer-drawer.constants.ts';
import { type OfferFormValues, offerInputOf, offerProblem } from './offer-form.ts';

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER: readonly (keyof OfferFormValues)[] = [
  'name',
  'code',
  'kind',
  'value',
  'tone',
  'offeringIds',
  'branchIds',
  'startsOn',
  'endsOn',
  'note',
  'live',
];

/** Options of {@link useOfferSave}. */
export interface UseOfferSaveOptions {
  form: UseFormReturn<OfferFormValues>;
  /** The offer an edit saves; a create has none. */
  offerId: string | null;
  /** Open the step that holds a field — the one a check or the server named. */
  onField: (field: keyof OfferFormValues) => void;
  /** The save went through: the drawer closes (D28). */
  onDone: () => void;
}

/**
 * The Offer drawer's write on the shared drawer save (KICKOFF §6.11): its rules
 * first (H:5521) — "Set the discount" / "Set the amount" / "Set the free
 * sessions" for a value of nothing, "Ends before it starts" — then the write.
 * A taken code (`conflict`, `S:1740`) outlines the code. The success toast —
 * "<name> created · applies automatically" / "<name> saved" — is the write's own.
 */
export function useOfferSave({ form, offerId, onField, onDone }: UseOfferSaveOptions) {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const create = useCreateOffer({ notifyOnError: false });
  const update = useUpdateOffer({ notifyOnError: false });

  return useDrawerSave<OfferFormValues, OfferRecord>({
    form,
    fieldOrder: FIELD_ORDER,
    toastId: 'offer-save-failed',
    check: (values) => {
      const problem = offerProblem(values);
      if (!problem) return null;
      return {
        fields: [problem.field],
        message:
          problem.rule === 'value'
            ? t(OFFER_DRAWER_KEYS.toasts.value[values.kind])
            : t(OFFER_DRAWER_KEYS.toasts.endsBeforeStart),
      };
    },
    onConflict: (error) => {
      const message = mapApiError(error);
      form.setError('code', { type: 'server', message });
      onField('code');
      notify.error(message);
    },
    onField: (field) => onField(field as keyof OfferFormValues),
    write: async () => {
      const input = offerInputOf(form.getValues());
      return offerId
        ? update.mutateAsync({ id: offerId, patch: input })
        : create.mutateAsync(input);
    },
    onDone,
  });
}
