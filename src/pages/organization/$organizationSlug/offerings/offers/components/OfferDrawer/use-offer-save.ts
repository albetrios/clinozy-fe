import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { fetchOffer, offerQueryKeys } from '@/shared/api/app/offerings-api.ts';
import {
  isOfferCodeInUse,
  type OfferRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { HttpError, isHttpError } from '@/shared/errors/HttpError.ts';
import { readValidationEntries } from '@/shared/errors/map-validation-errors.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { useCreateOffer, useUpdateOffer } from '@/shared/hooks/useOffers/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { OFFER_DRAWER_KEYS, OFFER_DRAWER_NS } from './offer-drawer.constants.ts';
import {
  offerFieldsOf,
  offerFormOf,
  type OfferFormValues,
  offerProblem,
} from './offer-form.ts';

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

/** The API's fields the form names differently (`is_active` is the Status toggle). */
const SERVER_FIELDS = { isActive: 'live' } as const;

/** An offering's public id inside a server message ("off_… is not an active offering"). */
const OFFERING_ID_IN_TEXT = /\boff_[a-z0-9]{21}\b/;

/** Whether a validation entry is about the offer's offerings (`offering_ids`, any request part). */
const isOfferingsField = (field: string) => /(?:^|\.)offering_ids(?:\/|$)/.test(field);

/**
 * A refusal with each "off_… is not an active offering" (O12; OFFERINGS-M5 names the id) worded
 * by the offering's name — "Research Peel is no longer active — remove it or pick another" — so
 * the picker says which one. Any other error comes back as it was.
 */
function withOfferingNames(
  error: unknown,
  inactive: (offeringId: string) => string | null,
): unknown {
  if (!isHttpError(error) || error.status !== 400) return error;
  let changed = false;
  const worded = readValidationEntries(error.data).map((entry) => {
    if (!isOfferingsField(entry.field)) return entry;
    const offeringId = OFFERING_ID_IN_TEXT.exec(entry.message)?.[0];
    const message = offeringId ? inactive(offeringId) : null;
    if (message === null) return entry;
    changed = true;
    return { ...entry, message };
  });
  if (!changed) return error;
  const data = error.data as { error?: object } | undefined;
  return new HttpError(error.message, error.status, error.url, error.method, {
    ...data,
    error: { ...data?.error, errors: worded },
  });
}

/**
 * An edit's offer, kept in step with a reload: a save refused as stale (`409 record_changed`)
 * offers "Reload", which reads the offer again (`GET /app/offers/:offer_id`), restarts the form
 * on what was saved and refreshes the list.
 */
function useEditingOffer(
  offer: OfferRecord | null,
  form: UseFormReturn<OfferFormValues>,
) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const [record, setRecord] = useState(offer);
  const reload = async () => {
    if (!record) return;
    const fresh = await queryClient.query({
      queryKey: offerQueryKeys.detail(organizationId, record.id),
      queryFn: () => fetchOffer(record.id),
      staleTime: 0,
    });
    setRecord(fresh);
    // In place: every input shows what was saved, not what was typed (`resetFormInPlace`).
    resetFormInPlace(form, offerFormOf(fresh));
    await queryClient.invalidateQueries({
      queryKey: offerQueryKeys.list(organizationId),
    });
  };
  return { record, reload };
}

/** Options of {@link useOfferSave}. */
export interface UseOfferSaveOptions {
  form: UseFormReturn<OfferFormValues>;
  /** The offer an edit saves, as read; a create has none. */
  offer: OfferRecord | null;
  /** An offering's name by id — the catalogue's — for a refusal that names its id. */
  nameOf: (offeringId: string) => string | undefined;
  /** Open the step that holds a field — the one a check or the server named. */
  onField: (field: keyof OfferFormValues) => void;
  /** The save went through: the drawer closes (D28). */
  onDone: () => void;
}

/**
 * The Offer drawer's write on the shared drawer save (KICKOFF §6.11): its rules
 * first (H:5521) — "Set the discount" / "Set the amount" / "Set the free
 * sessions" for a value of nothing, "Ends before it starts" — then the write:
 * `POST /app/offers`, or `PATCH /app/offers/:offer_id` with only what changed
 * and the read's `updated_at`. A taken code (`409 offer_code_in_use`) outlines
 * the code; a stale save (`409 record_changed`) toasts with "Reload", which
 * reads the offer again; the server's field errors land on their fields — an
 * offering no longer active by its name. The success toast — "<name> created ·
 * applies automatically" / "<name> saved" — is the write's own.
 */
export function useOfferSave({
  form,
  offer,
  nameOf,
  onField,
  onDone,
}: UseOfferSaveOptions) {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const create = useCreateOffer({ notifyOnError: false });
  const update = useUpdateOffer({ notifyOnError: false });
  const { record, reload } = useEditingOffer(offer, form);
  const inactive = (offeringId: string) => {
    const name = nameOf(offeringId);
    return name === undefined
      ? null
      : t(OFFER_DRAWER_KEYS.toasts.offeringInactive, { name });
  };

  return useDrawerSave<OfferFormValues, OfferRecord>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
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
      if (isOfferCodeInUse(error)) {
        form.setError('code', { type: 'server', message });
        onField('code');
      }
      notify.error(message, { id: 'offer-save-failed' });
    },
    onStale: record ? () => void reload() : undefined,
    onField: (field) => onField(field as keyof OfferFormValues),
    write: async () => {
      const fields = offerFieldsOf(form.getValues());
      try {
        return record
          ? await update.mutateAsync({ record, fields })
          : await create.mutateAsync({ fields });
      } catch (error) {
        throw withOfferingNames(error, inactive);
      }
    },
    onDone,
  });
}
