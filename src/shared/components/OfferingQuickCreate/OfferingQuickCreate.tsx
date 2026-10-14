import { type ReactNode, useId, useState } from 'react';
import {
  Controller,
  useForm,
  type UseFormReturn,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MONEY_SCALE, numberFromText } from '@/lib/number-text.ts';
import {
  OFFERING_CATEGORY_VALUES,
  type OfferingCategory,
} from '@/shared/api/app/app-schema.ts';
import {
  isOfferingNameTaken,
  OFFERING_DEFAULTS,
  type OfferingRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { OFFERING_CATEGORY_TONES, SECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerNumberInput,
  DrawerStepBody,
  DrawerStepper,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RECORD_DRAWER_KEYS } from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useCreateOffering } from '@/shared/hooks/useOfferings/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  OFFERING_QUICK_CREATE_KEYS,
  OFFERING_QUICK_CREATE_NS,
  OFFERING_QUICK_CREATE_TEST_ID,
} from './offering-quick-create.constants.ts';

const K = OFFERING_QUICK_CREATE_KEYS;
const F = K.fields;

/** The form: the name as typed, the length in minutes, the category, the price in rupees as typed. */
interface QuickOfferingValues {
  name: string;
  durationMin: number;
  category: OfferingCategory;
  price: string;
}

/** The form's own limits (`offerings.md:116–120`, as the full drawer's). */
const LIMITS = { name: 60, money: 7, durationMin: 480 } as const;

/** The contract's names the form spells differently. */
const SERVER_FIELDS = { durationMinutes: 'durationMin' } as const;

/** Four fields, none heavy: the light 560px (`offerings.md:165`). */
const CONTENT_PROFILE = { fieldCount: 4 } as const;

/** The three steps the single section splits into (H:3816–3823). */
type QuickStepId = 'offering' | 'details' | 'payment';

/** The field each step holds first — a save opens the step of the field it stops on. */
const FIELD_STEPS: Readonly<Record<keyof QuickOfferingValues, QuickStepId>> = {
  name: 'offering',
  durationMin: 'details',
  category: 'details',
  price: 'payment',
};

/** Props of {@link OfferingQuickCreate}. */
export interface OfferingQuickCreateProps {
  /** The stacked child's `open` (`useStackedDrawer().isOpen`). */
  open: boolean;
  /** What was typed in the picker that opened it — the Name (`useStackedDrawer().query`). */
  query?: string;
  /** Back, ×, the backdrop or Esc — only the child closes (§6.0). */
  onClose: () => void;
  /** The new offering — the parent field takes it (`useStackedDrawer().complete`, `S:1739`). */
  onCreated: (offering: OfferingRecord) => void;
}

/** A new form: the picker's text as the Name, 30 min, Treatment, no price — never a copy of a row. */
function emptyValues(query: string | undefined): QuickOfferingValues {
  return {
    name: (query ?? '').trim().slice(0, LIMITS.name),
    durationMin: OFFERING_DEFAULTS.durationMin,
    category: OFFERING_DEFAULTS.category,
    price: '',
  };
}

/** The steps' bodies: Name · Duration and Category · Price. */
function useStepBodies(
  form: UseFormReturn<QuickOfferingValues>,
  idPrefix: string,
): Record<QuickStepId, ReactNode> {
  const { t } = useTranslation(OFFERING_QUICK_CREATE_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const duration = field('durationMin');
  const price = field('price');
  const testId = OFFERING_QUICK_CREATE_TEST_ID;
  return {
    offering: (
      <DrawerFieldGrid>
        <DrawerField
          span="half"
          stretch={false}
          label={t(F.name)}
          htmlFor={name.id}
          required
          error={name.error}
        >
          <DrawerInput
            {...name.control}
            {...form.register('name')}
            aria-required="true"
            maxLength={LIMITS.name}
            placeholder={t(F.namePlaceholder)}
            autoComplete="off"
            data-testid={`${testId}-name`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    ),
    details: (
      <DrawerFieldGrid>
        <DrawerField
          span="half"
          stretch={false}
          label={t(F.duration)}
          htmlFor={duration.id}
        >
          <Controller
            control={form.control}
            name="durationMin"
            render={({ field: control }) => (
              <DrawerStepper
                id={duration.id}
                label={t(F.duration)}
                value={control.value}
                onValueChange={control.onChange}
                max={LIMITS.durationMin}
                suffix={t(F.minutesUnit)}
                testId={`${testId}-duration`}
              />
            )}
          />
        </DrawerField>
        <DrawerField label={t(F.category)}>
          <Controller
            control={form.control}
            name="category"
            render={({ field: control }) => (
              <DrawerChips
                label={t(F.category)}
                options={OFFERING_CATEGORY_VALUES.map((category) => ({
                  value: category,
                  label: t(APP_KEYS.offerings.categories[category]),
                  tone: OFFERING_CATEGORY_TONES[category],
                }))}
                value={control.value}
                onChange={(next) => {
                  if (next) control.onChange(next);
                }}
                testId={`${testId}-category`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>
    ),
    payment: (
      <DrawerFieldGrid>
        <DrawerField
          span="half"
          stretch={false}
          label={t(F.price)}
          htmlFor={price.id}
          required
          error={price.error}
        >
          <Controller
            control={form.control}
            name="price"
            render={({ field: control }) => (
              <DrawerNumberInput
                {...price.control}
                aria-required="true"
                value={control.value}
                onValueChange={control.onChange}
                onBlur={control.onBlur}
                prefix={t(RECORD_DRAWER_KEYS.currency)}
                placeholder="0"
                maxLength={LIMITS.money}
                data-testid={`${testId}-price`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>
    ),
  };
}

/** The step heads: each step's peek and its gap ("Missing: Price"). */
function useStepHeads(values: QuickOfferingValues) {
  const { t } = useTranslation(OFFERING_QUICK_CREATE_NS);
  const formatPaise = usePaiseFormat();
  const name = values.name.trim();
  const minutes = t(F.minutes, { minutes: values.durationMin });
  const category = t(APP_KEYS.offerings.categories[values.category]);
  const paise = numberFromText(values.price, MONEY_SCALE);
  const price = paise > 0 ? formatPaise(paise) : undefined;
  return {
    offering: {
      peek: [{ kind: 'value' as const, label: t(F.name), value: name }],
      missing: name ? [] : [t(F.name)],
    },
    details: {
      peek: [
        { kind: 'value' as const, label: t(F.duration), value: minutes },
        {
          kind: 'value' as const,
          label: t(F.category),
          value: category,
          tone: OFFERING_CATEGORY_TONES[values.category],
        },
      ],
      missing: [],
    },
    payment: {
      peek: [{ kind: 'value' as const, label: t(F.price), value: price }],
      missing: price ? [] : [t(F.price)],
    },
  } satisfies Record<QuickStepId, Omit<DrawerStep, 'id' | 'title' | 'content'>>;
}

/** One opening: the form, its steps and its write. */
function QuickCreateSession({
  open,
  query,
  onClose,
  onCreated,
}: OfferingQuickCreateProps) {
  const { t } = useTranslation(OFFERING_QUICK_CREATE_NS);
  const idPrefix = `offering-quick-${useId().replace(/:/g, '')}`;
  const form = useForm<QuickOfferingValues>({ defaultValues: emptyValues(query) });
  const watched = useWatch({ control: form.control });
  const values = { ...form.getValues(), ...watched } as QuickOfferingValues;
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('offering');
  const create = useCreateOffering({
    notifyOnError: false,
    successMessage: (offering) => t(K.toasts.added, { name: offering.name }),
  });

  const { saveState, save } = useDrawerSave<QuickOfferingValues, OfferingRecord>({
    form,
    fieldOrder: ['name', 'durationMin', 'category', 'price'],
    serverFields: SERVER_FIELDS,
    toastId: 'offering-quick-create-failed',
    onField: (name) => setOpenStep(FIELD_STEPS[name as keyof QuickOfferingValues]),
    // A name another offering has (any case): on the Name, in the server's words.
    onConflict: (error) => {
      const message = mapApiError(error);
      if (isOfferingNameTaken(error)) {
        form.setError('name', { type: 'server', message });
        setOpenStep('offering');
      }
      notify.error(message);
    },
    // A fresh record on clinozy-be (`POST /app/offerings`): the defaults fill the rest —
    // every branch, one session, GST at the category's rate (H:4070, §7.3).
    write: () =>
      create.mutateAsync({
        fields: {
          ...OFFERING_DEFAULTS,
          name: form.getValues('name').trim(),
          price: numberFromText(form.getValues('price'), 1, 2),
          durationMin: form.getValues('durationMin'),
          category: form.getValues('category'),
        },
      }),
    onDone: onCreated,
  });

  const bodies = useStepBodies(form, idPrefix);
  const heads = useStepHeads(values);
  const steps: DrawerStep[] = (['offering', 'details', 'payment'] as const).map((id) => ({
    id,
    title: t(K.steps[id]),
    ...heads[id],
    content: <DrawerStepBody readOnly={false}>{bodies[id]}</DrawerStepBody>,
  }));

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub)}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.offerings}
      steps={steps}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      onMissing={(stepId) =>
        notify.warning(t(stepId === 'offering' ? K.toasts.name : K.toasts.price))
      }
      stacked
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={OFFERING_QUICK_CREATE_TEST_ID}
    />
  );
}

/**
 * The stacked "New offering" (KICKOFF §6.11; `offerings.md:114–127, 159–171,
 * 255–262`): a 560px child drawer over the Invoice drawer, opened from the
 * line picker's "New offering · “Hydra facial”" (component state through
 * `useStackedDrawer`, no URL — `S:116`). Three working steps — "Offering"
 * (Name, prefilled from the picker) → "Details" (Duration 30, Category
 * Treatment) → "Payment" (Price) — and "Back" · "Add offering". "Add a name" /
 * "Enter the price" open the step with the gap. The write is a fresh offering on
 * clinozy-be (`POST /app/offerings`, `offering:create` — the Invoice drawer offers
 * "New offering" only with it) with the defaults; "Offering Hydra facial added",
 * the child closes and `onCreated` hands the offering to the invoice line. A name
 * another offering has answers on the Name. Esc, Back, × and the backdrop close
 * only the child (§6.0). Wired into the Invoice drawer at L-40.
 */
export function OfferingQuickCreate(props: OfferingQuickCreateProps) {
  const { session } = useDrawerSession(props.open);
  return <QuickCreateSession key={session} {...props} />;
}
