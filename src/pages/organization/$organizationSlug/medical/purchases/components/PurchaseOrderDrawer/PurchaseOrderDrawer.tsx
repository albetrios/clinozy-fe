import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useMedicineCatalogue } from '@/shared/hooks/useMedicines/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  MedicalFlowConfirm,
  type MedicalFlowTarget,
} from '../../../shared/components/MedicalFlowConfirm/index.ts';
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
} from '../../../shared/hooks/useMedicalFlows/index.ts';
import { useSupplierCatalogue } from '../../../shared/hooks/useMedicalLists/index.ts';
import {
  type MedicalPickers,
  useMedicalPickers,
} from '../../../shared/hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../../shared/hooks/useMedicalStack/index.ts';
import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import { useMedicalDrawerAccess } from '../../../shared/medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import { rateMessage } from './order-medicine.ts';
import {
  linesMissingRate,
  newOrderForm,
  orderFormOf,
  orderInputOf,
  orderServerFields,
  orderTotal,
  pickedLines,
  type PurchaseOrderFormValues,
  reorderLines,
  reorderSupplier,
  typedMedicineName,
} from './purchase-order-form.ts';
import {
  ItemsFields,
  OrderFields,
  type OrderFieldsProps,
} from './PurchaseOrderFields.tsx';

const K = MEDICAL_DRAWER_KEYS.purchaseOrder;

/** Item rows: 840px (`medical.md:334`). */
const CONTENT_PROFILE = { fieldCount: 7, hasItems: true } as const;

/** A new order's prefill: `?supplier=` and "Reorder low stock"'s `?reorder=low` (`S:57`). */
export interface PurchaseOrderPrefill {
  supplierId?: string;
  reorder?: 'low';
}

/** What every use of the drawer passes. */
interface PurchaseOrderDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a cancel. */
  onClose: () => void;
  /** Opens a supplier or medicine on top for "New supplier / medicine · “q”". */
  openChild?: OpenMedicalChild;
  testId?: string;
}

/** Props of {@link PurchaseOrderDrawer}: New purchase order, or an Ordered one to edit. */
export type PurchaseOrderDrawerProps = PurchaseOrderDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: PurchaseOrderPrefill }
    | { mode: 'edit'; order: PurchaseOrderRow | undefined }
  );

/** The step that holds a field the save stopped on. */
const stepOfField = (field: string) =>
  field.startsWith('lines') || field.startsWith('items') ? 'items' : 'order';

/** The step cards: Order → Items (`medical.md:434`). */
function useSteps(
  body: OrderFieldsProps,
  values: PurchaseOrderFormValues,
  supplierName: string | undefined,
): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const picked = pickedLines(values.lines);
  const billNo = values.billNo.trim();
  return [
    {
      id: 'order',
      title: t(K.steps.order),
      summary: drawerStepSummary([supplierName, billNo], notFilled),
      peek: [
        { kind: 'value', label: t(K.fields.supplier), value: supplierName ?? '' },
        { kind: 'value', label: t(K.fields.billNo), value: billNo },
      ],
      missing: values.supplierId ? [] : [t(K.fields.supplier)],
      content: (
        <DrawerStepBody readOnly={body.readOnly}>
          <OrderFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'items',
      title: t(K.steps.items),
      summary:
        picked.length > 0
          ? t(K.fields.peek, {
              count: picked.length,
              amount: formatPaise(orderTotal(values.lines)),
            })
          : notFilled,
      content: <ItemsFields {...body} />,
    },
  ];
}

/**
 * The order's save — past the Order step's "Pick a supplier", which the drawer
 * asks first: every picked line's rate, each cell red with "Enter the purchase
 * rate" and the toast naming the medicine (validated before submit, §7.3);
 * "Purchase order saved".
 */
function useOrderSave({
  form,
  order,
  setOpenStep,
  onClose,
}: {
  form: UseFormReturn<PurchaseOrderFormValues>;
  order: PurchaseOrderRow | null;
  setOpenStep: (step: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const medicines = useMedicineCatalogue().data ?? [];
  const create = useCreatePurchaseOrder({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const update = useUpdatePurchaseOrder({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  return useDrawerSave<PurchaseOrderFormValues, PurchaseOrderRow>({
    form,
    fieldOrder: ['supplierId', 'billNo', 'date', 'lines'],
    serverFields: orderServerFields(form.getValues('lines')),
    toastId: 'purchase-order-save-failed',
    check: (current) => {
      form.clearErrors('lines');
      const missing = linesMissingRate(current.lines);
      if (missing.length === 0) return null;
      for (const index of missing) {
        form.setError(`lines.${index}.rate`, {
          type: 'client',
          message: t(K.fields.enterRate),
        });
      }
      setOpenStep('items');
      const names = missing.map((index) => {
        const medicineId = current.lines[index]?.medicineId ?? null;
        return (
          medicines.find((row) => row.id === medicineId)?.name ??
          typedMedicineName(medicineId) ??
          undefined
        );
      });
      return { fields: [], message: rateMessage(names, t) };
    },
    onField: (field) => setOpenStep(stepOfField(field)),
    write: () => {
      const input = orderInputOf(form.getValues());
      return order
        ? update.mutateAsync({ record: order, input })
        : create.mutateAsync(input);
    },
    onDone: () => onClose(),
  });
}

/** What a session opens with: the saved order, or a new one — reordered when asked. */
function useInitialForm(
  order: PurchaseOrderRow | null,
  prefill: PurchaseOrderPrefill | undefined,
): PurchaseOrderFormValues {
  const medicines = useMedicineCatalogue().data ?? [];
  const suppliers = useSupplierCatalogue().data ?? [];
  if (order) return orderFormOf(order);
  if (prefill?.reorder === 'low') {
    const supplierId = reorderSupplier(medicines) ?? suppliers[0]?.id ?? null;
    return newOrderForm(supplierId, reorderLines(medicines, supplierId));
  }
  // Prefilled with the first supplier (`medical.md:258`).
  return newOrderForm(prefill?.supplierId ?? suppliers[0]?.id ?? null);
}

/** One opening of the drawer: the form, its steps and its save. */
function OrderSession({
  open,
  onClose,
  order,
  prefill,
  openChild,
  pickers,
  testId,
}: PurchaseOrderDrawerBaseProps & {
  order: PurchaseOrderRow | null;
  prefill?: PurchaseOrderPrefill;
  pickers: MedicalPickers;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const { readOnly, canDelete } = useMedicalDrawerAccess(order !== null);
  const medicines = useMedicineCatalogue().data ?? [];
  const suppliers = useSupplierCatalogue().data ?? [];
  const idPrefix = `purchase-order-${useId().replace(/:/g, '')}`;
  const form = useForm<PurchaseOrderFormValues>({
    defaultValues: useInitialForm(order, prefill),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState(
    prefill?.reorder === 'low' ? 'items' : 'order',
  );
  const [cancelling, setCancelling] = useState<MedicalFlowTarget | null>(null);
  const { saveState, save } = useOrderSave({ form, order, setOpenStep, onClose });

  const supplierName = suppliers.find((row) => row.id === values.supplierId)?.name;
  const steps = useSteps(
    { form, idPrefix, readOnly, pickers, openChild, testId },
    values,
    supplierName,
  );
  const total = formatPaise(orderTotal(values.lines));

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(order ? K.title.edit : K.title.create)}
        tag={order ? `#${order.seq}` : undefined}
        sub={t(K.sub)}
        quickFill={[
          {
            id: 'reorder',
            label: t(K.quickFill.reorder),
            tone: 'butter',
            onSelect: () => {
              form.setValue(
                'lines',
                reorderLines(medicines, form.getValues('supplierId')),
                {
                  shouldDirty: true,
                },
              );
              setOpenStep('items');
            },
          },
        ]}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.medical}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(t(K.pickSupplier))}
        summary={total}
        readOnly={readOnly}
        saveLabel={t(order ? MEDICAL_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        deleteLabel={t(K.cancelOrder)}
        onDelete={
          order && canDelete
            ? () =>
                setCancelling({
                  kind: 'cancelOrder',
                  id: order.id,
                  seq: order.seq,
                  record: total,
                })
            : undefined
        }
        dirty={isDirty}
        testId={testId}
      />
      <MedicalFlowConfirm
        target={cancelling}
        onClose={() => setCancelling(null)}
        onDone={onClose}
      />
    </>
  );
}

/**
 * New / Edit purchase order (KICKOFF §6.7 Drawers; `medical.md:254–267`;
 * H:5387–5394) on the shared record drawer, 840px: "Order" — Supplier* (the
 * first one unless `?supplier=` names it; "Add supplier “q”" or "New supplier"
 * on top), Invoice no., Order date — then "Items": each medicine, its qty, free
 * units and purchase rate, with the amount and the total. "⚡ Reorder low
 * stock" fills every medicine at or below its reorder level up to its fill-up
 * level at the supplier's rate (`?reorder=low` opens on it, at the supplier
 * most of them buy from). An Ordered order edits here, with the red "Cancel
 * order" (Admin); received and paid orders open their view instead.
 */
export function PurchaseOrderDrawer(props: PurchaseOrderDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const pickers = useMedicalPickers();
  const catalogue = useMedicineCatalogue();
  const suppliers = useSupplierCatalogue();
  const testId = props.testId ?? MEDICAL_DRAWER_TEST_IDS.purchaseOrder;
  const prefill = props.mode === 'create' ? props.prefill : undefined;
  // A new order's supplier and "Reorder low stock" wait for the lists they read.
  const waiting =
    props.mode === 'create' &&
    (!suppliers.data || (prefill?.reorder === 'low' && !catalogue.data));
  if ((props.mode === 'edit' && !props.order) || waiting) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(props.mode === 'edit' ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.purchaseOrder)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const order = props.mode === 'edit' ? (props.order ?? null) : null;
  return (
    <OrderSession
      key={`${session}-${order?.id ?? 'new'}`}
      open={props.open}
      onClose={props.onClose}
      openChild={props.openChild}
      order={order}
      prefill={prefill}
      pickers={pickers}
      testId={testId}
    />
  );
}
