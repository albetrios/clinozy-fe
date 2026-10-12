import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { resetFormInPlace } from './reset-form-in-place.ts';

/** How a record is read again: its detail query's key and fetcher. */
export interface EditingRecordRead<TRecord> {
  queryKey: QueryKey;
  queryFn: () => Promise<TRecord>;
}

/** Options of {@link useEditingRecord}. */
export interface UseEditingRecordOptions<TRecord, TValues extends FieldValues> {
  /** The record the drawer opened on; `null` for a new one, which has nothing to reload. */
  record: TRecord | null;
  form: UseFormReturn<TValues>;
  /** The form's values for a record — what the form starts over on after a reload. */
  formOf: (record: TRecord) => TValues;
  /** The record's detail read in the active organization. */
  read: (record: TRecord, organizationId: string | null) => EditingRecordRead<TRecord>;
}

/**
 * An edit drawer's record, kept in step with a reload: a save refused as stale (`409
 * record_changed`, the toast's "Reload") reads the record again past the cache and starts the
 * form over on what was saved — in place ({@link resetFormInPlace}), so every input shows the
 * value the next save sends. A read that fails says why and leaves the drawer as it was.
 */
export function useEditingRecord<TRecord, TValues extends FieldValues>({
  record: opened,
  form,
  formOf,
  read,
}: UseEditingRecordOptions<TRecord, TValues>) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const [record, setRecord] = useState(opened);
  const reload = async () => {
    if (!record) return;
    try {
      const fresh = await queryClient.query({
        ...read(record, organizationId),
        staleTime: 0,
      });
      setRecord(fresh);
      resetFormInPlace(form, formOf(fresh));
    } catch (error) {
      notifyError(error);
    }
  };
  return { record, reload };
}
