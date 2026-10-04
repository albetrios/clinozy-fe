import { useId, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { MedicalRep } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerPhoneInput,
  DrawerStepBody,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import {
  PATIENT_DRAWER_KEYS,
  PATIENT_DRAWER_NS,
} from '@/shared/components/PatientDrawer/patient-drawer.constants.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
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
import { notify } from '@/shared/notify/index.ts';

import {
  useCreateMedicalRep,
  useUpdateMedicalRep,
} from '../../hooks/useMedicalPartners/index.ts';
import {
  type MedicalPickers,
  useMedicalPickers,
} from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import type { MrRow } from '../../medical-contracts.ts';
import {
  phoneDigitsOf,
  phoneIsInvalid,
  storedPhoneOf,
  useLiveValues,
  useMedicalDrawerAccess,
} from '../../medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import type { MedicalRepInput } from '../../medical-partners-contracts.ts';
import { useMedicalDates } from '../MedicalCells/medical-dates.ts';
import { MedicalDeleteConfirm } from '../MedicalDeleteConfirm/index.ts';
import { MedicalPartnerPicker } from '../MedicalPartnerPicker/index.ts';

const K = MEDICAL_DRAWER_KEYS.mr;

/** Four light fields: 560px (`medical.md:336`). */
const CONTENT_PROFILE = { fieldCount: 4 } as const;

const NAME_MAX = 120;

/** "Next visit" offers today and the next 120 days (`medical.md:230`). */
const NEXT_VISIT_DAYS = 120;

/** The form: the MR's name, their mobile's digits, the next visit, the makers they represent. */
interface MrFormValues {
  name: string;
  phone: string;
  nextVisitOn: string | null;
  manufacturerIds: string[];
}

/** What every use of the drawer passes. */
interface MrDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Stacked on another drawer: "Back", "Add MR", no "full details" of its own. */
  stacked?: boolean;
  /** The saved record — a stacked child hands it to the field that asked. */
  onSaved?: (rep: MedicalRep) => void;
  /** Opens a manufacturer on top for "full details"; a stacked drawer passes none. */
  openChild?: OpenMedicalChild;
  testId?: string;
}

/** Props of {@link MrDrawer}: New MR, or Edit MR once loaded. */
export type MrDrawerProps = MrDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { name?: string } }
    | { mode: 'edit'; mr: MrRow | undefined }
  );

/** A new MR's form: the picker's text as the name. */
function emptyForm(prefill: { name?: string } = {}): MrFormValues {
  return {
    name: (prefill.name ?? '').trim().slice(0, NAME_MAX),
    phone: '',
    nextVisitOn: null,
    manufacturerIds: [],
  };
}

/** A saved MR's form. */
function formOf(mr: MrRow): MrFormValues {
  return {
    name: mr.name,
    phone: phoneDigitsOf(mr.phone),
    nextVisitOn: mr.nextVisitOn,
    manufacturerIds: [...mr.manufacturerIds],
  };
}

/** The contract's fields for a form. */
function inputOf(values: MrFormValues): MedicalRepInput {
  return {
    name: values.name.trim(),
    phone: storedPhoneOf(values.phone),
    nextVisitOn: values.nextVisitOn,
    manufacturerIds: values.manufacturerIds,
  };
}

/** What the steps' bodies read. */
interface BodyProps {
  form: UseFormReturn<MrFormValues>;
  idPrefix: string;
  testId: string;
  pickers: MedicalPickers;
  openChild?: OpenMedicalChild;
}

/** MR: Name* · Phone · Next visit (`medical.md:228–230`). */
function MrFields({ form, idPrefix, testId }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const [today] = useState(() => clinicToday());
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const phone = field('phone');
  const next = field('nextVisitOn');
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
      <DrawerField span="third" label={t(K.fields.nextVisit)} htmlFor={next.id}>
        <Controller
          control={form.control}
          name="nextVisitOn"
          render={({ field: control }) => (
            <DrawerDatePicker
              id={next.id}
              label={t(K.fields.nextVisit)}
              value={control.value}
              onChange={control.onChange}
              today={today}
              testId={`${testId}-next-visit`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** A date dropdown of today and the next 120 days, clearable. */
function DrawerDatePicker({
  id,
  label,
  value,
  onChange,
  today,
  testId,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (date: string | null) => void;
  today: string;
  testId: string;
}) {
  return (
    <DatePicker
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      today={today}
      min={today}
      past={0}
      future={NEXT_VISIT_DAYS}
      clearable
      size="md"
      testId={testId}
    />
  );
}

/** REPRESENTS: the makers they represent, any number (`medical.md:231`). */
function RepresentsFields({ form, idPrefix, testId, pickers, openChild }: BodyProps) {
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

/** The two step cards, with what each peeks while closed. */
function useSteps(
  body: BodyProps,
  values: MrFormValues,
  readOnly: boolean,
): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const dates = useMedicalDates();
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const name = values.name.trim();
  const phone = storedPhoneOf(values.phone);
  const phoneText = phone ? formatClinicPhone(phone) : '';
  const next = values.nextVisitOn ? dates.day(values.nextVisitOn) : '';
  const byId = new Map(body.pickers.manufacturers.map((option) => [option.key, option]));
  const makers = values.manufacturerIds.flatMap((id) => {
    const option = byId.get(id);
    return option ? [{ label: option.label, tone: option.tone }] : [];
  });
  return [
    {
      id: 'mr',
      title: t(K.steps.mr),
      summary: [name, phoneText, next].filter(Boolean).join(' · ') || notFilled,
      peek: [
        { kind: 'value', label: t(K.fields.name), value: name },
        { kind: 'value', label: t(K.fields.phone), value: phoneText },
        { kind: 'value', label: t(K.fields.nextVisit), value: next },
      ],
      missing: name ? [] : [t(K.fields.name)],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <MrFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'represents',
      title: t(K.steps.represents),
      summary:
        makers
          .map((maker) => maker.label)
          .slice(0, 4)
          .join(' · ') || notFilled,
      peek: [{ kind: 'multi', label: t(K.fields.manufacturers), values: makers }],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <RepresentsFields {...body} />
        </DrawerStepBody>
      ),
    },
  ];
}

/** One opening of the drawer: the form, its steps and its save. */
function MrSession({
  open,
  onClose,
  mr,
  prefill,
  stacked = false,
  onSaved,
  openChild,
  testId,
}: MrDrawerBaseProps & {
  mr: MrRow | null;
  prefill?: { name?: string };
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tPatient } = useTranslation(PATIENT_DRAWER_NS);
  const idPrefix = `mr-${useId().replace(/:/g, '')}`;
  const { readOnly, canDelete } = useMedicalDrawerAccess(mr !== null);
  const pickers = useMedicalPickers();
  const form = useForm<MrFormValues>({
    defaultValues: mr ? formOf(mr) : emptyForm(prefill),
  });
  const values = useLiveValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('mr');
  const [deleting, setDeleting] = useState(false);

  const create = useCreateMedicalRep({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const update = useUpdateMedicalRep({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const { saveState, save } = useDrawerSave<MrFormValues, MedicalRep>({
    form,
    fieldOrder: ['name', 'phone', 'nextVisitOn', 'manufacturerIds'],
    toastId: 'mr-save-failed',
    check: (current) =>
      phoneIsInvalid(current.phone)
        ? { fields: ['phone'], message: tPatient(PATIENT_DRAWER_KEYS.mobileInvalid) }
        : null,
    onField: (field) => setOpenStep(field === 'manufacturerIds' ? 'represents' : 'mr'),
    write: () => {
      const input = inputOf(form.getValues());
      return mr
        ? update.mutateAsync({ id: mr.id, patch: input })
        : create.mutateAsync(input);
    },
    onDone: (record) => (onSaved ? onSaved(record) : onClose()),
  });

  const steps = useSteps(
    { form, idPrefix, testId, pickers, openChild },
    values,
    readOnly,
  );
  const summary = values.name.trim();

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(mr ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.medical}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(t(MEDICAL_DRAWER_KEYS.addName))}
        summary={summary}
        readOnly={readOnly}
        stacked={stacked}
        saveLabel={t(mr ? MEDICAL_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={canDelete && !stacked ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={testId}
      />
      {mr ? (
        <MedicalDeleteConfirm
          target={
            deleting ? { kind: 'mr', id: mr.id, name: mr.name, record: summary } : null
          }
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}

/**
 * New / Edit MR (KICKOFF §6.7 Drawers; `medical.md:224–237`) on the shared
 * record drawer, 560px: "MR" — Name*, a "+91" mobile, the next visit (today
 * and the next 120 days) — then "Represents", the makers they represent
 * (pickable, quick-added or created in full on top). "MR saved"; edit adds
 * Delete. Stacked on another drawer it reads "Back" · "Add MR" and hands the
 * new MR back.
 */
export function MrDrawer(props: MrDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = props.testId ?? MEDICAL_DRAWER_TEST_IDS.mr;
  if (props.mode === 'edit' && !props.mr) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.mr)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const mr = props.mode === 'edit' ? (props.mr ?? null) : null;
  return (
    <MrSession
      key={`${session}-${mr?.id ?? 'new'}`}
      {...props}
      mr={mr}
      prefill={props.mode === 'create' ? props.prefill : undefined}
      testId={testId}
    />
  );
}
