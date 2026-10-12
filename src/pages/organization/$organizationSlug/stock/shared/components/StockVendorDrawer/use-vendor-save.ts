import { useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  phoneDigitsOf,
  phoneIsInvalid,
  storedPhoneOf,
} from '@/shared/app/app-phone-field.ts';
import {
  PATIENT_DRAWER_KEYS,
  PATIENT_DRAWER_NS,
} from '@/shared/components/PatientDrawer/patient-drawer.constants.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import {
  type EditingRecordRead,
  useEditingRecord,
} from '@/shared/hooks/useEditingRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  useCreateStockVendor,
  useUpdateStockVendor,
} from '../../hooks/useStockWrites/index.ts';
import { fetchStockVendor, stockQueryKeys } from '../../stock-api.ts';
import type { StockVendorRecord, StockVendorRow } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { STOCK_NAME_MAX, type StockVendorInput } from '../../stock-records-contracts.ts';

/*
 * What the clinic vendor drawer does with clinozy-be's answers to a save: a
 * field the API names goes on its field (the phone's "Use +91 and ten
 * digits"), a name another vendor has goes on Name with the room's words, and a
 * save over someone else's (`409 record_changed`) reads the vendor again.
 */

const K = STOCK_DRAWER_KEYS.vendor;

/** The failed save's toast — one per drawer, so a second failure replaces it. */
const TOAST_ID = 'stock-vendor-save-failed';

/** The form: the vendor's name and its mobile's digits. */
export interface VendorFormValues {
  name: string;
  phone: string;
}

/** The form for a saved vendor, or a new one named from the picker's text. */
export function vendorFormOf(
  vendor: Pick<StockVendorRecord, 'name' | 'phone'> | null,
  prefillName = '',
): VendorFormValues {
  return vendor
    ? { name: vendor.name, phone: phoneDigitsOf(vendor.phone) }
    : { name: prefillName.trim().slice(0, STOCK_NAME_MAX), phone: '' };
}

/** The contract's fields for the form as it stands. */
const vendorInputOf = (values: VendorFormValues): StockVendorInput => ({
  name: values.name.trim(),
  phone: storedPhoneOf(values.phone),
});

/**
 * How an Edit clinic vendor drawer reads its vendor again — a save refused as
 * stale (the toast's "Reload") — past the cache (`GET /app/stock-vendors/:id`),
 * for `useEditingRecord`.
 */
const readStockVendor = (
  vendor: StockVendorRow,
  organizationId: string | null,
): EditingRecordRead<StockVendorRow> => ({
  queryKey: stockQueryKeys.vendor(organizationId, vendor.id),
  queryFn: () => fetchStockVendor(vendor.id),
});

/** Options of {@link useVendorSave}. */
export interface UseVendorSaveOptions {
  form: UseFormReturn<VendorFormValues>;
  /** The vendor an edit saves, as read; a create has none. */
  vendor: StockVendorRow | null;
  /** Stacked on a purchase or an item: the new vendor is a quick one (`is_quick`). */
  stacked: boolean;
  /** The save went through, with the saved vendor. */
  onDone: (saved: StockVendorRecord) => void;
}

/**
 * New / Edit clinic vendor's write on the shared drawer save: "Add a name" and
 * "Enter a 10-digit mobile" first, then `POST /app/stock-vendors` (`is_quick`
 * when stacked from a picker) or `PATCH /app/stock-vendors/:id` with only what
 * changed and the read's `updated_at`. "Vendor Ankit Traders added" / "Vendor
 * saved"; a name already taken outlines Name; a stale save offers "Reload".
 */
export function useVendorSave({ form, vendor, stacked, onDone }: UseVendorSaveOptions) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tPatient } = useTranslation(PATIENT_DRAWER_NS);
  // The vendor the save guards with its `updated_at`; "Reload" starts the form over on the
  // vendor as saved, in place.
  const { record, reload } = useEditingRecord({
    record: vendor,
    form,
    formOf: vendorFormOf,
    read: readStockVendor,
  });
  const create = useCreateStockVendor({
    notifyOnError: false,
    successMessage: (saved) => t(K.added, { name: saved.name }),
  });
  const update = useUpdateStockVendor({
    notifyOnError: false,
    successMessage: t(K.saved),
  });

  const onConflict = (error: HttpError) => {
    if (apiErrorReason(error) !== 'record_already_exists') {
      notifyError(error, { id: TOAST_ID });
      return;
    }
    const message = t(K.nameTaken);
    form.setError('name', { type: 'server', message });
    notify.error(message, { id: TOAST_ID });
  };

  const drawerSave = useDrawerSave<VendorFormValues, StockVendorRecord>({
    form,
    fieldOrder: ['name', 'phone'],
    toastId: TOAST_ID,
    check: (current) => {
      if (!current.name.trim()) {
        return { fields: ['name'], message: t(STOCK_DRAWER_KEYS.addName) };
      }
      return phoneIsInvalid(current.phone)
        ? { fields: ['phone'], message: tPatient(PATIENT_DRAWER_KEYS.mobileInvalid) }
        : null;
    },
    onConflict,
    onStale: record ? () => void reload() : undefined,
    // One step: nothing to open.
    onField: () => undefined,
    write: () => {
      const input = vendorInputOf(form.getValues());
      return record
        ? update.mutateAsync({ record, input })
        : create.mutateAsync({ ...input, isQuick: stacked });
    },
    onDone,
  });
  return { ...drawerSave, record };
}

/**
 * Read a vendor's figures again after a delete confirm closes without deleting
 * — a refusal (`409 vendor_has_dues`) means a purchase owes them since the list
 * was read: the Vendors list, its footer and, given an id, the vendor's own
 * read, so Payable and Delete show what is true now.
 */
export function useRefreshStockVendors() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return (vendorId?: string) => {
    const keys = [
      stockQueryKeys.vendorLists(organizationId),
      [...stockQueryKeys.summaries(organizationId), 'vendors'],
      ...(vendorId ? [stockQueryKeys.vendor(organizationId, vendorId)] : []),
    ];
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}
