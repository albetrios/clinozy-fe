import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { expiryTone } from '@/shared/api/clinic/medicine-stock.ts';
import type { MedicineRow } from '@/shared/api/clinic/medicines-contracts.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerStepper,
} from '@/shared/components/DrawerField/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { useReturnExpiringStock } from '../../../shared/hooks/useMedicalFlows/index.ts';
import { useSupplierCatalogue } from '../../../shared/hooks/useMedicalLists/index.ts';
import { useMedicalDrawerAccess } from '../../../shared/medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.expiring;

/** Props of {@link ExpiringReturnDrawer}. */
export interface ExpiringReturnDrawerProps {
  /** The medicine whose expiring batch goes back; the drawer is open while one is set. */
  medicine: MedicineRow | null;
  onClose: () => void;
  testId?: string;
}

/** The batch that expires first, with its stock and purchase rate. */
function expiringBatch(medicine: MedicineRow) {
  const nearest = medicine.nearest;
  if (!nearest) return null;
  const batch = medicine.batches.find((row) => row.batchNo === nearest.batchNo);
  return batch ? { ...batch, daysLeft: nearest.daysLeft } : null;
}

/** This medicine's suppliers, cheapest first, each "Bought at ₹123" (`medical.md:301`). */
function useSupplierOptions(medicine: MedicineRow): PickerOption[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const names = new Map(
    (useSupplierCatalogue().data ?? []).map((row) => [row.id, row.name]),
  );
  return [...medicine.supplierRates]
    .sort((a, b) => a.rate - b.rate)
    .flatMap((rate) => {
      const name = names.get(rate.supplierId);
      if (!name) return [];
      return [
        {
          key: rate.supplierId,
          label: name,
          sub: t(K.boughtAt, { amount: formatPaise(rate.rate) }),
          leading: { kind: 'none' as const },
        },
      ];
    });
}

/** One opening of the drawer on an expiring batch. */
function ExpiringSession({
  medicine,
  onClose,
  testId,
}: {
  medicine: MedicineRow;
  onClose: () => void;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const { readOnly } = useMedicalDrawerAccess(true);
  const options = useSupplierOptions(medicine);
  const supplierFieldId = useId();
  const qtyFieldId = useId();
  const batch = expiringBatch(medicine);
  // The cheapest supplier until one is picked, and the whole batch (`medical.md:301–302`).
  const [picked, setPicked] = useState<string | null>(null);
  const supplierId = picked ?? options[0]?.key ?? null;
  const [qty, setQty] = useState(batch?.qty ?? 0);
  const returnStock = useReturnExpiringStock({
    successMessage: (result) =>
      t(K.saved, {
        count: result.qty,
        amount: formatPaise(result.credit),
        supplier: result.supplierName,
      }),
  });
  if (!batch) return null;
  const supplierName = options.find((option) => option.key === supplierId)?.label ?? '';
  const credit = qty * batch.purchaseRate;
  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub, {
        medicine: medicine.name,
        batch: batch.batchNo,
        expiry: batch.expiry,
      })}
      badges={[
        {
          id: 'credit',
          label: t(K.badges.credit, { amount: formatPaise(credit) }),
          tone: 'sage',
        },
        {
          id: 'days',
          label: t(K.badges.daysLeft, { count: batch.daysLeft }),
          tone: expiryTone(batch.daysLeft),
        },
      ]}
      tone={SECTION_TONES.medical}
      summary={supplierName ? t(K.summary, { supplier: supplierName }) : ''}
      readOnly={readOnly}
      saveLabel={t(K.save)}
      onSave={() => {
        if (!supplierId || qty <= 0) return;
        returnStock.mutate(
          { medicineId: medicine.id, batchNo: batch.batchNo, supplierId, qty },
          { onSuccess: onClose },
        );
      }}
      saveState={returnStock.isPending ? 'saving' : 'idle'}
      testId={testId}
    >
      <DrawerFieldGrid>
        <DrawerField span="full" label={t(K.supplier)} htmlFor={supplierFieldId} required>
          <Picker
            id={supplierFieldId}
            label={t(K.supplier)}
            options={options}
            value={supplierId}
            onChange={(id) => {
              if (id) setPicked(id);
            }}
            placeholder={t(MEDICAL_DRAWER_KEYS.pickers.searchSupplier)}
            disabled={readOnly}
            size="md"
            testId={`${testId}-supplier`}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.quantity)} htmlFor={qtyFieldId}>
          <DrawerStepper
            id={qtyFieldId}
            value={qty}
            onValueChange={setQty}
            min={1}
            max={batch.qty}
            suffix={t(K.of, { count: batch.qty })}
            label={t(K.quantity)}
            disabled={readOnly}
            testId={`${testId}-qty`}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.creditNote)}>
          <DrawerInfo testId={`${testId}-credit`}>{formatPaise(credit)}</DrawerInfo>
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}

/**
 * Return expiring stock (KICKOFF §6.7 Drawers; `medical.md:297–309`;
 * H:5414–5417) — component state over Medicines, no URL (Appendix F), the
 * everyday 680px,
 * one section "Return to supplier": the medicine's expiring batch goes back to
 * one of its suppliers (the cheapest by default, "Bought at ₹123"), as many
 * packs as the batch holds or fewer, for a credit of qty × the batch's rate.
 * "Return & take credit" lowers the batch and what the room owes that
 * supplier, and adds a credit row to its Account: "3 returned · ₹369 credit
 * from Akshar Medicines".
 */
export function ExpiringReturnDrawer({
  medicine,
  onClose,
  testId,
}: ExpiringReturnDrawerProps) {
  const { session } = useDrawerSession(medicine !== null);
  if (!medicine) return null;
  return (
    <ExpiringSession
      key={`${session}-${medicine.id}`}
      medicine={medicine}
      onClose={onClose}
      testId={testId ?? MEDICAL_DRAWER_TEST_IDS.expiring}
    />
  );
}
