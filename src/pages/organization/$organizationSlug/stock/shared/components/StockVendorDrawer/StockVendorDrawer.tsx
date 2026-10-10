import { useId, useRef, useState } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';

import { useStockDrawerAccess } from '../../hooks/useStockAccess/index.ts';
import type { StockVendorRecord, StockVendorRow } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import { STOCK_NAME_MAX } from '../../stock-records-contracts.ts';
import { StockDeleteConfirm, vendorDeleteBlock } from '../StockDeleteConfirm/index.ts';
import {
  useRefreshStockVendors,
  useVendorSave,
  vendorFormOf,
  type VendorFormValues,
} from './use-vendor-save.ts';

const K = STOCK_DRAWER_KEYS.vendor;

/** Two light fields: 560px (`clinic-stock.md:283`). */
const CONTENT_PROFILE = { fieldCount: 2 } as const;

/** What every use of the drawer passes. */
interface StockVendorDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Stacked on another drawer: "Back" · "Add vendor", and the vendor is a quick one. */
  stacked?: boolean;
  /** The saved vendor — a stacked child hands it to the field that asked. */
  onSaved?: (vendor: StockVendorRecord) => void;
  testId?: string;
}

/** Props of {@link StockVendorDrawer}: New clinic vendor (named from a picker), or Edit once loaded. */
export type StockVendorDrawerProps = StockVendorDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { name?: string } }
    | { mode: 'edit'; vendor: StockVendorRow | undefined }
  );

/**
 * The red Delete and its confirm: only while nothing is owed (`vendor_has_dues`),
 * judged on the vendor's latest read. A confirm that closes without deleting —
 * kept, or refused because a purchase owes them since — reads the vendor again.
 */
function useVendorDelete(vendor: StockVendorRow | null, allowed: boolean) {
  const refresh = useRefreshStockVendors();
  const [deleting, setDeleting] = useState(false);
  const deleted = useRef(false);
  const deletable = allowed && vendor !== null && vendorDeleteBlock(vendor) === null;
  const closeConfirm = () => {
    setDeleting(false);
    // A deleted vendor's read would only answer 404 while the drawer closes.
    if (vendor && !deleted.current) refresh(vendor.id);
  };
  return {
    deleting,
    onDelete: deletable ? () => setDeleting(true) : undefined,
    closeConfirm,
    markDeleted: () => {
      deleted.current = true;
    },
  };
}

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
  /** The vendor's latest read (edit); its figures decide Delete. */
  vendor: StockVendorRow | null;
  prefill?: { name?: string };
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { readOnly, canDelete } = useStockDrawerAccess(vendor !== null);
  const idPrefix = `stock-vendor-${useId().replace(/:/g, '')}`;
  const form = useForm<VendorFormValues>({
    defaultValues: vendorFormOf(vendor, prefill?.name),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const phone = field('phone');
  const { saveState, save, record } = useVendorSave({
    form,
    vendor,
    stacked,
    onDone: (saved) => (onSaved ? onSaved(saved) : onClose()),
  });
  const removal = useVendorDelete(vendor ?? record, canDelete && !stacked);

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(record ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.stock}
        summary={values.name.trim()}
        readOnly={readOnly}
        stacked={stacked}
        saveLabel={t(record ? STOCK_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={removal.onDelete}
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
      {record ? (
        <StockDeleteConfirm
          target={
            removal.deleting
              ? { kind: 'vendor', id: record.id, name: record.name, from: 'drawer' }
              : null
          }
          onClose={removal.closeConfirm}
          onDeleted={() => {
            removal.markDeleted();
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * New / Edit clinic vendor (KICKOFF §6.8 Drawers; `clinic-stock.md:174–185`,
 * `S:81–83`) on the shared record drawer, 560px, on clinozy-be: Name* (prefilled
 * with the picker's text) and a "+91" mobile. New writes `POST
 * /app/stock-vendors` — a quick vendor (`is_quick`) when stacked on an item or a
 * purchase, where it reads "Back" · "Add vendor" and hands the new vendor back
 * to the Supplier field; "Vendor Ankit Traders added". Editing (Q-K1, AMBER: its
 * title is ours) saves only what changed with the read's `updated_at` — a stale
 * save offers "Reload" — and offers Delete while nothing is owed. The server's
 * field errors land on their fields; a name another vendor has outlines Name.
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
