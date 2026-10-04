import { useId, useState } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { StockVendor } from '@/shared/api/clinic/clinic-schema.ts';
import {
  phoneDigitsOf,
  phoneIsInvalid,
  storedPhoneOf,
} from '@/shared/clinic/clinic-phone-field.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerPhoneInput,
  DrawerStepBody,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  PATIENT_DRAWER_KEYS,
  PATIENT_DRAWER_NS,
} from '@/shared/components/PatientDrawer/patient-drawer.constants.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';

import { useStockDrawerAccess } from '../../hooks/useStockAccess/index.ts';
import {
  useCreateStockVendor,
  useUpdateStockVendor,
} from '../../hooks/useStockWrites/index.ts';
import type { StockVendorRow } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import { STOCK_NAME_MAX, type StockVendorInput } from '../../stock-records-contracts.ts';
import { StockDeleteConfirm } from '../StockDeleteConfirm/index.ts';

const K = STOCK_DRAWER_KEYS.vendor;

/** Two light fields: 560px (`clinic-stock.md:283`). */
const CONTENT_PROFILE = { fieldCount: 2 } as const;

/** The form: the vendor's name and its mobile's digits. */
interface VendorFormValues {
  name: string;
  phone: string;
}

/** What every use of the drawer passes. */
interface StockVendorDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Stacked on another drawer: "Back" · "Add vendor". */
  stacked?: boolean;
  /** The saved vendor — a stacked child hands it to the field that asked. */
  onSaved?: (vendor: StockVendor) => void;
  testId?: string;
}

/** Props of {@link StockVendorDrawer}: New clinic vendor (named from a picker), or Edit once loaded. */
export type StockVendorDrawerProps = StockVendorDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { name?: string } }
    | { mode: 'edit'; vendor: StockVendorRow | undefined }
  );

/** The contract's fields for a form. */
const inputOf = (values: VendorFormValues): StockVendorInput => ({
  name: values.name.trim(),
  phone: storedPhoneOf(values.phone),
});

/** One opening of the drawer: the form and its save. */
function VendorSession({
  open,
  onClose,
  vendor,
  prefill,
  stacked = false,
  onSaved,
  testId,
}: StockVendorDrawerBaseProps & {
  vendor: StockVendorRow | null;
  prefill?: { name?: string };
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tPatient } = useTranslation(PATIENT_DRAWER_NS);
  const { readOnly, canDelete } = useStockDrawerAccess(vendor !== null);
  const idPrefix = `stock-vendor-${useId().replace(/:/g, '')}`;
  const form = useForm<VendorFormValues>({
    defaultValues: vendor
      ? { name: vendor.name, phone: phoneDigitsOf(vendor.phone) }
      : { name: (prefill?.name ?? '').trim().slice(0, STOCK_NAME_MAX), phone: '' },
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [deleting, setDeleting] = useState(false);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const phone = field('phone');

  const create = useCreateStockVendor({
    notifyOnError: false,
    successMessage: (saved) => t(K.added, { name: saved.name }),
  });
  const update = useUpdateStockVendor({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const { saveState, save } = useDrawerSave<VendorFormValues, StockVendor>({
    form,
    fieldOrder: ['name', 'phone'],
    toastId: 'stock-vendor-save-failed',
    check: (current) => {
      if (!current.name.trim()) {
        return { fields: ['name'], message: t(STOCK_DRAWER_KEYS.addName) };
      }
      return phoneIsInvalid(current.phone)
        ? { fields: ['phone'], message: tPatient(PATIENT_DRAWER_KEYS.mobileInvalid) }
        : null;
    },
    onField: () => undefined,
    write: () => {
      const input = inputOf(form.getValues());
      return vendor
        ? update.mutateAsync({ id: vendor.id, patch: input })
        : create.mutateAsync(input);
    },
    onDone: (saved) => (onSaved ? onSaved(saved) : onClose()),
  });

  // Delete only while nothing is owed (Q-K1, as Medical's suppliers).
  const deletable = canDelete && !stacked && vendor !== null && vendor.payable === 0;

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(vendor ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.stock}
        summary={values.name.trim()}
        readOnly={readOnly}
        stacked={stacked}
        saveLabel={t(vendor ? STOCK_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={deletable ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={testId}
      >
        <DrawerStepBody readOnly={readOnly}>
          <DrawerFieldGrid>
            <DrawerField
              span="half"
              stretch={false}
              label={t(K.fields.name)}
              htmlFor={name.id}
              required
              error={name.error}
            >
              <DrawerInput
                {...name.control}
                {...form.register('name')}
                aria-required="true"
                maxLength={STOCK_NAME_MAX}
                autoComplete="off"
                data-testid={`${testId}-name`}
              />
            </DrawerField>
            <DrawerField
              span="half"
              label={t(K.fields.phone)}
              hint={t(K.fields.phoneHint)}
              htmlFor={phone.id}
              error={phone.error}
            >
              <Controller
                control={form.control}
                name="phone"
                render={({ field: control }) => (
                  <DrawerPhoneInput
                    {...phone.control}
                    value={control.value}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                    data-testid={`${testId}-phone`}
                  />
                )}
              />
            </DrawerField>
          </DrawerFieldGrid>
        </DrawerStepBody>
      </RecordDrawer>
      {vendor ? (
        <StockDeleteConfirm
          target={
            deleting
              ? { kind: 'vendor', id: vendor.id, name: vendor.name, from: 'drawer' }
              : null
          }
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}

/**
 * New / Edit clinic vendor (KICKOFF §6.8 Drawers; `clinic-stock.md:174–185`,
 * `S:81–83`) on the shared record drawer, 560px: Name* (prefilled with the
 * picker's text) and a "+91" mobile. "Vendor Ankit Traders added"; stacked on
 * an item or a purchase it reads "Back" · "Add vendor" and hands the new
 * vendor back to the Supplier field. Editing (Q-K1, AMBER: its title is ours)
 * offers Delete once nothing is due.
 */
export function StockVendorDrawer(props: StockVendorDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const testId = props.testId ?? STOCK_DRAWER_TEST_IDS.vendor;
  if (props.mode === 'edit' && !props.vendor) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={t(STOCK_DRAWER_KEYS.records.vendor)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const vendor = props.mode === 'edit' ? (props.vendor ?? null) : null;
  return (
    <VendorSession
      key={`${session}-${vendor?.id ?? 'new'}`}
      {...props}
      vendor={vendor}
      prefill={props.mode === 'create' ? props.prefill : undefined}
      testId={testId}
    />
  );
}
