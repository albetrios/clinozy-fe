import { useId, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerNumberInput,
  DrawerQuickChips,
  DrawerStepBody,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { useLogStockMovement } from '../../hooks/useStockWrites/index.ts';
import type { StockItemRow, StockMovementRecord } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import {
  exceedsStock,
  hasMeasure,
  quantityMilliOf,
  type QuantityMode,
  quickQuantities,
  startQuantity,
  stockAfter,
  TREATMENTS,
  treatmentTone,
} from '../../stock-movement.ts';
import {
  STOCK_MOVEMENT_INPUT_TYPES,
  type StockMovementInputType,
} from '../../stock-records-contracts.ts';
import { fromMilli, STOCK_MOVEMENT_TONES, toMilli } from '../../stock-units.ts';
import { useMovementRefusal, useMovementUndo } from './use-movement-outcome.ts';

const K = STOCK_DRAWER_KEYS.movement;

/**
 * Five light fields: 560px (`clinic-stock.md:240`) — the remark is a short
 * area, not the heavy kind that widens a drawer.
 */
const CONTENT_PROFILE = { fieldCount: 5 } as const;

/** The longest remark the drawer takes — the API's 280 less the measured figure it carries. */
const NOTE_MAX = 200;

/** The form: the type, the quantity as typed and what it counts, what it was for, a remark. */
interface MovementFormValues {
  type: StockMovementInputType;
  quantity: string;
  mode: QuantityMode;
  usedFor: string | null;
  note: string;
}

/** Props of {@link StockMovementDrawer}. */
export interface StockMovementDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The item the row action or the Use popover opened it for. */
  item: StockItemRow | null;
  /** The row action's type: Use / Log usage… → Used, Receive stock → Received, Adjust count → Adjust. */
  type: StockMovementInputType;
  testId?: string;
}

/** The sign a summary shows (`IS_MT`, H:3727): − out, + in, ± for a count. */
const SIGNS: Readonly<Record<StockMovementInputType, string>> = {
  used: '−',
  damaged: '−',
  returned: '−',
  received: '+',
  adjust: '±',
};

/** "Log usage" / "Receive stock" / "Adjust stock" — switching the type retitles the drawer. */
const titleKey = (type: StockMovementInputType) => {
  if (type === 'received') return K.title.received;
  return type === 'adjust' ? K.title.adjust : K.title.used;
};

/** The form a row action opens: Adjust prefills the current stock, the rest one unit. */
function formFor(item: StockItemRow, type: StockMovementInputType): MovementFormValues {
  return {
    type,
    quantity: type === 'adjust' ? String(fromMilli(item.qtyMilli)) : '1',
    mode: 'unit',
    usedFor: null,
    note: '',
  };
}

/** What every step body reads: the form and the root test id. */
interface StepProps {
  form: UseFormReturn<MovementFormValues>;
  testId: string;
}

/** A step body with typed fields: their DOM ids derive from the prefix. */
interface TypedStepProps extends StepProps {
  idPrefix: string;
}

/** What the step bodies read: MOVEMENT also reads the item. */
interface BodyProps extends TypedStepProps {
  item: StockItemRow;
}

/** MOVEMENT: Type · Quantity (with its quick chips) · Measure in (`clinic-stock.md:130–132`). */
function MovementFields({ form, item, idPrefix, testId }: BodyProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const values = useFormValues(form);
  const quantity = useDrawerFieldIds(form, idPrefix)('quantity');
  const unitLabel = words.unit(item.unit);
  const measureLabel = item.measureUnit ? words.measure(item.measureUnit) : '';
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.fields.type)}>
        <Controller
          control={form.control}
          name="type"
          render={({ field: control }) => (
            <DrawerChips
              label={t(K.fields.type)}
              options={STOCK_MOVEMENT_INPUT_TYPES.map((type) => ({
                value: type,
                label: words.movementType(type).label,
                tone: STOCK_MOVEMENT_TONES[type],
              }))}
              value={control.value}
              onChange={(value) => {
                if (!value) return;
                control.onChange(value);
                // A count starts from what the shelf holds; the rest from one.
                form.setValue(
                  'quantity',
                  value === 'adjust' ? String(fromMilli(item.qtyMilli)) : '1',
                );
                form.setValue('mode', 'unit');
                // Only a use says what it was for (`used_for`).
                if (value !== 'used') form.setValue('usedFor', null);
              }}
              testId={`${testId}-type`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(values.type === 'adjust' ? K.fields.counted : K.fields.quantity)}
        hint={t(K.fields.decimals)}
        htmlFor={quantity.id}
        required={values.type !== 'adjust'}
        error={quantity.error}
      >
        <div className="flex flex-col gap-2">
          <Controller
            control={form.control}
            name="quantity"
            render={({ field: control }) => (
              <DrawerNumberInput
                {...quantity.control}
                value={control.value}
                onValueChange={control.onChange}
                onBlur={control.onBlur}
                suffix={values.mode === 'measure' ? measureLabel : unitLabel}
                decimals={values.mode === 'measure' ? 2 : 3}
                maxLength={8}
                data-testid={`${testId}-quantity`}
              />
            )}
          />
          <DrawerQuickChips
            label={t(values.type === 'adjust' ? K.fields.counted : K.fields.quantity)}
            options={quickQuantities(values.mode, item, 'drawer').map((value) => ({
              value,
              label: words.figure(value),
            }))}
            value={Number.parseFloat(values.quantity) || null}
            onChange={(value) =>
              form.setValue('quantity', String(value), { shouldDirty: true })
            }
            testId={`${testId}-quick`}
          />
        </div>
      </DrawerField>
      {hasMeasure(item) ? (
        <DrawerField span="half" label={t(K.fields.measureIn)}>
          <Controller
            control={form.control}
            name="mode"
            render={({ field: control }) => (
              <DrawerChips
                label={t(K.fields.measureIn)}
                options={[
                  { value: 'unit' as const, label: unitLabel },
                  {
                    value: 'measure' as const,
                    label: t(K.fields.measureOption, {
                      measure: measureLabel,
                      unit: unitLabel,
                      contents: words.amount(
                        fromMilli(item.sizePerUnit ?? 0),
                        measureLabel,
                      ),
                    }),
                  },
                ]}
                value={control.value}
                onChange={(value) => {
                  if (!value) return;
                  control.onChange(value);
                  form.setValue('quantity', String(startQuantity(value, item)));
                }}
                testId={`${testId}-mode`}
              />
            )}
          />
        </DrawerField>
      ) : null}
    </DrawerFieldGrid>
  );
}

/** DETAILS: Used for — optional, one at a time, a use's only (`clinic-stock.md:133`). */
function DetailsFields({ form, testId }: StepProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.fields.usedFor)} hint={t(K.fields.optional)}>
        <Controller
          control={form.control}
          name="usedFor"
          render={({ field: control }) => (
            <DrawerChips
              label={t(K.fields.usedFor)}
              options={TREATMENTS.map((treatment) => ({
                value: treatment.name,
                label: t(STOCK_DRAWER_KEYS.treatments[treatment.key]),
                tone: treatmentTone(treatment),
              }))}
              value={control.value}
              onChange={control.onChange}
              clearable
              testId={`${testId}-used-for`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** NOTES: Remark — "Patient, batch or reason" (`clinic-stock.md:134`). */
function NotesFields({ form, idPrefix, testId }: TypedStepProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const note = useDrawerFieldIds(form, idPrefix)('note');
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.fields.remark)} htmlFor={note.id} error={note.error}>
        <DrawerTextarea
          {...note.control}
          {...form.register('note')}
          rows={2}
          maxLength={NOTE_MAX}
          placeholder={t(K.fields.remarkPlaceholder)}
          data-testid={`${testId}-note`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** One opening of the drawer for one item: the form, its steps and its save. */
function MovementSession({
  open,
  onClose,
  item,
  type,
  undo,
  testId,
}: Omit<StockMovementDrawerProps, 'item' | 'testId'> & {
  item: StockItemRow;
  /** The saved movement's toast with its Undo — the drawer's, which outlives this opening. */
  undo: (message: string, movement: StockMovementRecord) => void;
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const words = useStockWords();
  const idPrefix = `stock-movement-${useId().replace(/:/g, '')}`;
  const form = useForm<MovementFormValues>({ defaultValues: formFor(item, type) });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('movement');
  const log = useLogStockMovement({ notifyOnError: false });
  const refusal = useMovementRefusal();

  const qtyMilli = quantityMilliOf(values.quantity, values.mode, item);
  const after = stockAfter(values.type, item, qtyMilli);
  const typeLabel = words.movementType(values.type);
  const unitOrMeasure =
    values.mode === 'measure' && item.measureUnit
      ? words.measure(item.measureUnit)
      : words.unit(item.unit);
  const typed = words.amount(Number.parseFloat(values.quantity) || 0, unitOrMeasure);

  const { saveState, save } = useDrawerSave<MovementFormValues, StockMovementRecord>({
    form,
    fieldOrder: ['type', 'quantity', 'mode', 'usedFor', 'note'],
    onConflict: (error) => notify.error(refusal(error)),
    toastId: 'stock-movement-save-failed',
    check: (current) => {
      const milli = quantityMilliOf(current.quantity, current.mode, item);
      if (current.type !== 'adjust' && milli === 0) {
        return { fields: ['quantity'], message: t(K.enterQuantity) };
      }
      if (exceedsStock(current.type, item, milli)) {
        return {
          fields: ['quantity'],
          message: t(K.onlyInStock, { quantity: words.quantity(item, item.qtyMilli) }),
        };
      }
      return null;
    },
    onField: (field) => {
      if (field === 'usedFor') setOpenStep('details');
      else if (field === 'note') setOpenStep('notes');
      else setOpenStep('movement');
    },
    write: () => {
      const current = form.getValues();
      const measured =
        current.mode === 'measure' && item.measureUnit
          ? words.amount(
              Number.parseFloat(current.quantity) || 0,
              words.measure(item.measureUnit),
            )
          : '';
      return log.mutateAsync({
        itemId: item.id,
        type: current.type,
        quantityMilli: quantityMilliOf(current.quantity, current.mode, item),
        usedFor: current.type === 'used' ? current.usedFor : null,
        note: [measured, current.note.trim()].filter(Boolean).join(' · ') || null,
      });
    },
    // "Used saved · 2 tube left" — what is left is the server's (`quantity_after`).
    onDone: (movement) => {
      undo(
        t(K.saved, {
          type: words.movementType(movement.kind).label,
          quantity: words.units(item, movement.afterMilli),
        }),
        movement,
      );
      onClose();
    },
  });

  const body = { form, item, idPrefix, testId };
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const treatment = TREATMENTS.find((entry) => entry.name === values.usedFor);
  const details: DrawerStep = {
    id: 'details',
    title: t(K.steps.details),
    summary: treatment ? t(STOCK_DRAWER_KEYS.treatments[treatment.key]) : notFilled,
    peek: [
      {
        kind: 'value',
        label: t(K.fields.usedFor),
        value: treatment ? t(STOCK_DRAWER_KEYS.treatments[treatment.key]) : '',
      },
    ],
    content: (
      <DrawerStepBody readOnly={false}>
        <DetailsFields {...body} />
      </DrawerStepBody>
    ),
  };
  const steps: DrawerStep[] = [
    {
      id: 'movement',
      title: t(K.steps.movement),
      summary: [typeLabel.label, typed].join(' · '),
      peek: [
        {
          kind: 'value',
          label: t(K.fields.type),
          value: typeLabel.label,
          tone: typeLabel.tone ?? undefined,
        },
        {
          kind: 'value',
          label: t(values.type === 'adjust' ? K.fields.counted : K.fields.quantity),
          value: typed,
        },
      ],
      content: (
        <DrawerStepBody readOnly={false}>
          <MovementFields {...body} />
        </DrawerStepBody>
      ),
    },
    // Details (Used for) is a use's alone — the API takes `used_for` on `used` only.
    ...(values.type === 'used' ? [details] : []),
    {
      id: 'notes',
      title: t(K.steps.notes),
      summary: values.note.trim() || notFilled,
      peek: [{ kind: 'value', label: t(K.fields.remark), value: values.note.trim() }],
      content: (
        <DrawerStepBody readOnly={false}>
          <NotesFields {...body} />
        </DrawerStepBody>
      ),
    },
  ];

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(titleKey(values.type))}
      sub={t(
        K.sub,
        isolateValues({ name: item.name, quantity: words.quantity(item, item.qtyMilli) }),
      )}
      badges={[
        { id: 'type', label: typeLabel.label, tone: typeLabel.tone ?? undefined },
        {
          id: 'after',
          label: t(K.after, { quantity: words.quantity(item, after) }),
          tone: after <= toMilli(item.minQty) ? 'butter' : undefined,
        },
      ]}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.stock}
      steps={steps}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      summary={t(K.summary, {
        name: item.name,
        change: `${SIGNS[values.type]}${typed}`,
      })}
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={testId}
    />
  );
}

/**
 * Log usage / Receive stock / Adjust stock (KICKOFF §6.8 Drawers;
 * `clinic-stock.md:126–140, 233–245`) on the shared record drawer, 560px,
 * component state (no URL): "Movement" — Type (switching it retitles the
 * drawer), Quantity or, for Adjust, the counted quantity with its quick chips,
 * and "Measure in" for an item with contents — "Details" (Used for, a use's
 * only) and "Notes" (Remark). The badges say the type and the stock after it
 * ("After: 2 tube · 60 g", butter at or below the minimum) — a preview; the
 * saved balance is the server's. "Save movement" posts it (`POST
 * /app/stock-items/:id/movements`; a measured figure rides in the remark) —
 * "Used saved · 2 tube left" + Undo, which reverts it as "Logged by mistake".
 * Someone having used some since is said in the room's words.
 */
export function StockMovementDrawer({
  item,
  testId = STOCK_DRAWER_TEST_IDS.movement,
  ...props
}: StockMovementDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const undo = useMovementUndo();
  if (!item) return null;
  return (
    <MovementSession
      key={`${session}-${item.id}-${props.type}`}
      {...props}
      item={item}
      undo={undo}
      testId={testId}
    />
  );
}
