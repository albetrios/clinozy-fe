import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Supplier } from '@/shared/api/clinic/clinic-schema.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import {
  phoneDigitsOf,
  phoneIsInvalid,
  storedPhoneOf,
} from '@/shared/clinic/clinic-phone-field.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerInput,
  DrawerPhoneInput,
  DrawerStepBody,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import {
  PATIENT_DRAWER_KEYS,
  PATIENT_DRAWER_NS,
} from '@/shared/components/PatientDrawer/patient-drawer.constants.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
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
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useCreateSupplier,
  useSupplierAccount,
  useUpdateSupplier,
} from '../../hooks/useMedicalPartners/index.ts';
import {
  type MedicalPickers,
  useMedicalPickers,
} from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import type { SupplierRow } from '../../medical-contracts.ts';
import { textOrNull, useMedicalDrawerAccess } from '../../medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import type { SupplierInput } from '../../medical-partners-contracts.ts';
import { MedicalDeleteConfirm } from '../MedicalDeleteConfirm/index.ts';
import { MedicalPartnerPicker } from '../MedicalPartnerPicker/index.ts';
import { SupplierAccountRows } from './SupplierAccountRows.tsx';

const K = MEDICAL_DRAWER_KEYS.supplier;

/** A new supplier: four light fields, 560px (`medical.md:336`). */
const CREATE_PROFILE = { fieldCount: 4 } as const;
/** Editing adds the Account rows: an items table, 840px. */
const EDIT_PROFILE = { fieldCount: 6, hasItems: true } as const;

const NAME_MAX = 120;
const GST_MAX = 20;

/** The form: the agency's name, its mobile's digits, its GSTIN, the makers it distributes. */
interface SupplierFormValues {
  name: string;
  phone: string;
  gstNumber: string;
  manufacturerIds: string[];
}

/** What a New supplier opens with: the picker's text, and the makers it came from. */
export interface SupplierPrefill {
  name?: string;
  manufacturerIds?: readonly string[];
}

/** What every use of the drawer passes. */
interface SupplierDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Stacked on another drawer: "Back", "Add supplier", no "full details" of its own. */
  stacked?: boolean;
  /** The saved record — a stacked child hands it to the field that asked. */
  onSaved?: (supplier: Supplier) => void;
  /** Opens a manufacturer on top for "full details"; a stacked drawer passes none. */
  openChild?: OpenMedicalChild;
  /** Quick fill's "New purchase order" (edit): a new order for this supplier. */
  onNewOrder?: (supplierId: string) => void;
  /**
   * Quick fill's "Pay ₹827" (edit, while something is due; Q-M1): Send payment
   * on the supplier's oldest open bill. Passed only to members who may pay.
   */
  onPay?: (supplier: SupplierRow) => void;
  testId?: string;
}

/** Props of {@link SupplierDrawer}: New supplier, or Edit supplier once loaded. */
export type SupplierDrawerProps = SupplierDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: SupplierPrefill }
    | { mode: 'edit'; supplier: SupplierRow | undefined }
  );

/** A new supplier's form. */
function emptyForm(prefill: SupplierPrefill = {}): SupplierFormValues {
  return {
    name: (prefill.name ?? '').trim().slice(0, NAME_MAX),
    phone: '',
    gstNumber: '',
    manufacturerIds: [...(prefill.manufacturerIds ?? [])],
  };
}

/** A saved supplier's form. */
function formOf(supplier: SupplierRow): SupplierFormValues {
  return {
    name: supplier.name,
    phone: phoneDigitsOf(supplier.phone),
    gstNumber: supplier.gstNumber ?? '',
    manufacturerIds: [...supplier.manufacturerIds],
  };
}

/** The contract's fields for a form. */
function inputOf(values: SupplierFormValues): SupplierInput {
  return {
    name: values.name.trim(),
    phone: storedPhoneOf(values.phone),
    gstNumber: textOrNull(values.gstNumber),
    manufacturerIds: values.manufacturerIds,
  };
}

/** What the steps' bodies read. */
interface BodyProps {
  form: UseFormReturn<SupplierFormValues>;
  idPrefix: string;
  testId: string;
  pickers: MedicalPickers;
  openChild?: OpenMedicalChild;
}

/** SUPPLIER: Agency name* · Phone · GST number (`medical.md:194–196`). */
function SupplierFields({ form, idPrefix, testId }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const phone = field('phone');
  const gst = field('gstNumber');
  return (
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
          maxLength={NAME_MAX}
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
      <DrawerField span="third" label={t(K.fields.gst)} htmlFor={gst.id}>
        <DrawerInput
          {...gst.control}
          {...form.register('gstNumber')}
          capitalize={false}
          maxLength={GST_MAX}
          autoComplete="off"
          data-testid={`${testId}-gst`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** DISTRIBUTES: the makers it supplies, pick any (`medical.md:197`). */
function DistributesFields({ form, idPrefix, testId, pickers, openChild }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const makers = field('manufacturerIds');
  return (
    <DrawerFieldGrid>
      <DrawerField
        label={t(K.fields.manufacturers)}
        hint={t(K.fields.manufacturersHint)}
        htmlFor={makers.id}
      >
        <Controller
          control={form.control}
          name="manufacturerIds"
          render={({ field: control }) => (
            <MedicalPartnerPicker
              kind="manufacturer"
              multiple
              id={makers.id}
              label={t(K.fields.manufacturers)}
              value={control.value}
              onChange={control.onChange}
              pickers={pickers}
              openChild={openChild}
              testId={`${testId}-manufacturers`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** "₹827 · 5 days" / "Nothing due", "1 order · ₹4,236" / "No orders yet". */
function useAccountWords(supplier: SupplierRow) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  return {
    payable:
      supplier.payable > 0
        ? t(K.fields.payableValue, {
            amount: formatPaise(supplier.payable),
            count: supplier.ageingDays ?? 0,
          })
        : t(K.fields.nothingDue),
    orders:
      supplier.orderCount > 0
        ? t(K.fields.ordersValue, {
            count: supplier.orderCount,
            amount: formatPaise(supplier.orderTotal),
          })
        : t(K.fields.noOrders),
  };
}

/** ACCOUNT (edit): what is owed and ordered, then every order and credit (`medical.md:198–200`). */
function AccountFields({ supplier, testId }: { supplier: SupplierRow; testId: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const words = useAccountWords(supplier);
  const account = useSupplierAccount(supplier.id);
  return (
    <DrawerFieldGrid>
      <DrawerField span="half" label={t(K.fields.payable)}>
        <DrawerInfo testId={`${testId}-payable`}>{words.payable}</DrawerInfo>
      </DrawerField>
      <DrawerField span="half" label={t(K.fields.orders)}>
        <DrawerInfo testId={`${testId}-orders`}>{words.orders}</DrawerInfo>
      </DrawerField>
      <DrawerField>
        <SupplierAccountRows rows={account.data ?? []} testId={`${testId}-account`} />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** The labels of the picked makers, with their tones. */
function makerPills(pickers: MedicalPickers, ids: readonly string[]) {
  const byId = new Map(pickers.manufacturers.map((option) => [option.key, option]));
  return ids.flatMap((id) => {
    const option = byId.get(id);
    return option ? [{ label: option.label, tone: option.tone }] : [];
  });
}

/** The step cards — Supplier → Distributes, and Account when editing. */
function useSteps(
  body: BodyProps,
  values: SupplierFormValues,
  supplier: SupplierRow | null,
  readOnly: boolean,
): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const name = values.name.trim();
  const phone = storedPhoneOf(values.phone);
  const phoneText = phone ? formatClinicPhone(phone) : '';
  const gst = values.gstNumber.trim();
  const makers = makerPills(body.pickers, values.manufacturerIds);
  const steps: DrawerStep[] = [
    {
      id: 'supplier',
      title: t(K.steps.supplier),
      summary: drawerStepSummary([name, phoneText, gst], notFilled),
      peek: [
        { kind: 'value', label: t(K.fields.name), value: name },
        { kind: 'value', label: t(K.fields.phone), value: phoneText },
        { kind: 'value', label: t(K.fields.gst), value: gst },
      ],
      missing: name ? [] : [t(K.fields.name)],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <SupplierFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'distributes',
      title: t(K.steps.distributes),
      summary:
        makers
          .map((maker) => maker.label)
          .slice(0, 4)
          .join(' · ') || notFilled,
      peek: [{ kind: 'multi', label: t(K.fields.manufacturers), values: makers }],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <DistributesFields {...body} />
        </DrawerStepBody>
      ),
    },
  ];
  if (supplier) {
    steps.push({
      id: 'account',
      title: t(K.steps.account),
      content: <AccountFields supplier={supplier} testId={body.testId} />,
    });
  }
  return steps;
}

/** The step that holds a field the save stopped on. */
const stepOfField = (field: string) =>
  field === 'manufacturerIds' ? 'distributes' : 'supplier';

/**
 * The header's Quick fill (edit; `medical.md:203`): "⚡ New purchase order"
 * (sky) and, while the supplier is owed money, "⚡ Pay ₹827" (sage) — Send
 * payment on its oldest open bill (Q-M1).
 */
function quickFillOf(
  supplier: SupplierRow | null,
  actions: Pick<SupplierDrawerBaseProps, 'onNewOrder' | 'onPay'>,
  t: TFunction,
  formatPaise: (paise: number) => string,
): QuickFillItem[] | undefined {
  if (!supplier) return undefined;
  const { onNewOrder, onPay } = actions;
  const items: QuickFillItem[] = [];
  if (onNewOrder) {
    items.push({
      id: 'new-order',
      label: t(K.quickFill.newOrder),
      tone: 'sky',
      onSelect: () => onNewOrder(supplier.id),
    });
  }
  if (onPay && supplier.payable > 0 && supplier.oldestOpenBill) {
    items.push({
      id: 'pay',
      label: t(K.quickFill.pay, { amount: formatPaise(supplier.payable) }),
      tone: 'sage',
      onSelect: () => onPay(supplier),
    });
  }
  return items.length > 0 ? items : undefined;
}

/** One opening of the drawer: the form, its steps and its save. */
function SupplierSession({
  open,
  onClose,
  supplier,
  prefill,
  stacked = false,
  onSaved,
  openChild,
  onNewOrder,
  onPay,
  testId,
}: SupplierDrawerBaseProps & {
  supplier: SupplierRow | null;
  prefill?: SupplierPrefill;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tPatient } = useTranslation(PATIENT_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const idPrefix = `supplier-${useId().replace(/:/g, '')}`;
  const { readOnly, canDelete } = useMedicalDrawerAccess(supplier !== null);
  const pickers = useMedicalPickers();
  const form = useForm<SupplierFormValues>({
    defaultValues: supplier ? formOf(supplier) : emptyForm(prefill),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('supplier');
  const [deleting, setDeleting] = useState(false);

  const create = useCreateSupplier({ notifyOnError: false, successMessage: t(K.saved) });
  const update = useUpdateSupplier({ notifyOnError: false, successMessage: t(K.saved) });
  const { saveState, save } = useDrawerSave<SupplierFormValues, Supplier>({
    form,
    fieldOrder: ['name', 'phone', 'gstNumber', 'manufacturerIds'],
    toastId: 'supplier-save-failed',
    check: (current) =>
      phoneIsInvalid(current.phone)
        ? { fields: ['phone'], message: tPatient(PATIENT_DRAWER_KEYS.mobileInvalid) }
        : null,
    onField: (field) => setOpenStep(stepOfField(field)),
    write: () => {
      const input = inputOf(form.getValues());
      return supplier
        ? update.mutateAsync({ id: supplier.id, patch: input })
        : create.mutateAsync(input);
    },
    onDone: (record) => (onSaved ? onSaved(record) : onClose()),
  });

  const steps = useSteps(
    { form, idPrefix, testId, pickers, openChild },
    values,
    supplier,
    readOnly,
  );
  const summary = values.name.trim();
  const deletable =
    canDelete &&
    !stacked &&
    supplier !== null &&
    supplier.payable === 0 &&
    !supplier.hasOpenOrder;

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(supplier ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        quickFill={
          stacked
            ? undefined
            : quickFillOf(supplier, { onNewOrder, onPay }, t, formatPaise)
        }
        content={supplier ? EDIT_PROFILE : CREATE_PROFILE}
        tone={SECTION_TONES.medical}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(t(MEDICAL_DRAWER_KEYS.addName))}
        summary={summary}
        readOnly={readOnly}
        stacked={stacked}
        saveLabel={t(supplier ? MEDICAL_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={deletable ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={testId}
      />
      {supplier ? (
        <MedicalDeleteConfirm
          target={
            deleting
              ? {
                  kind: 'supplier',
                  id: supplier.id,
                  name: supplier.name,
                  record: summary,
                }
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
 * New / Edit supplier (KICKOFF §6.7 Drawers; `medical.md:190–206`) on the
 * shared record drawer: "Supplier" — Agency name*, a "+91" mobile, the GSTIN —
 * then "Distributes", the makers it supplies (pickable, quick-added or created
 * in full on top). Editing widens to 840px for "Account": what it is owed and
 * for how long, its orders, and every order and credit as rows; Quick fill
 * offers "New purchase order". Delete only with nothing due and no order left
 * to settle; "Supplier saved". Stacked on another drawer it reads "Back" ·
 * "Add supplier" and hands the new supplier back.
 */
export function SupplierDrawer(props: SupplierDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = props.testId ?? MEDICAL_DRAWER_TEST_IDS.supplier;
  if (props.mode === 'edit' && !props.supplier) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.supplier)}
        content={EDIT_PROFILE}
        testId={testId}
      />
    );
  }
  const supplier = props.mode === 'edit' ? (props.supplier ?? null) : null;
  return (
    <SupplierSession
      key={`${session}-${supplier?.id ?? 'new'}`}
      {...props}
      supplier={supplier}
      prefill={props.mode === 'create' ? props.prefill : undefined}
      testId={testId}
    />
  );
}
