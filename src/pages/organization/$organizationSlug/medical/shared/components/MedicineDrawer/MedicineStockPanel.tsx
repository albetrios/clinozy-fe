import type { CSSProperties } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  MEDICINE_STOCK_HEALTH_TONES,
  medicineStockHealth,
  reorderPacks,
  reorderQuantity,
} from '@/shared/api/app/medicine-stock.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { DrawerStepper } from '@/shared/components/DrawerField/index.ts';
import { Label } from '@/shared/components/ui/label.tsx';
import { useMedicineUnits } from '@/shared/hooks/useMedicineUnits/index.ts';

import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import {
  formStock,
  MEDICINE_FORM_LIMITS,
  type MedicineFormValues,
  stockBarScale,
} from './medicine-form.ts';

const K = MEDICAL_DRAWER_KEYS.medicine.stock;

/** A level's label above its stepper: the 8px square in its zone's ink, then the words. */
function LevelLabel({
  htmlFor,
  ink,
  children,
}: {
  htmlFor: string;
  ink: string;
  children: string;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-muted-foreground-strong gap-1.5 text-xs leading-[normal] font-medium"
    >
      <span aria-hidden="true" className={cn('size-2 rounded-xs bg-current', ink)} />
      {children}
    </Label>
  );
}

/**
 * The panel's words: a medicine sold in whole packs reads as before; a loose-selling one
 * (`unitsPerPack` above 1) shows its stock as packs and loose units, labels the levels as units,
 * and its reorder hint orders whole packs (change-pharmacy-record-fields D5, F6).
 */
function useStockWords(
  values: Pick<MedicineFormValues, 'unitsPerPack' | 'minStock' | 'maxStock'>,
  now: number,
) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const units = useMedicineUnits();
  const perPack = values.unitsPerPack;
  const loose = perPack > 1;
  const min = values.minStock;
  const max = values.maxStock;
  const health = medicineStockHealth(now, min, max);
  const state = t(K.states[health]);
  const stock = units.packs(now, perPack);
  let hint: string;
  if (now > min) {
    hint = loose ? t(K.hintAlertUnits, { count: min }) : t(K.hintAlert, { count: min });
  } else if (loose) {
    const packs = units.packCount(reorderPacks(now, max, perPack));
    hint = t(K.hintOrderPacks, { packs, max });
  } else {
    hint = t(K.hintOrder, { qty: reorderQuantity(now, max), max });
  }
  return {
    health,
    now:
      stock === null ? t(K.now, { count: now, state }) : t(K.nowLoose, { stock, state }),
    reorderAt: t(loose ? K.reorderAtUnits : K.reorderAt),
    fillUpTo: t(loose ? K.fillUpToUnits : K.fillUpTo),
    hint,
    note: loose ? t(K.unitsNote, { perPack: units.perPack(perPack) }) : null,
  };
}

/**
 * The medicine drawer's stock levels (`medical.md:180`; H:2917): the status pill
 * ("8 in stock · Healthy" / "Reorder" / "Overstocked" / "Out"), a bar of the
 * reorder zone (blush) and the healthy zone (sage) with a marker at today's
 * stock (moving in 200ms), and the two steppers — "Reorder at", never above
 * "Fill up to", and "Fill up to", never below it, at most 9,999 — then the
 * hint ("Reorder alert when stock falls to 2." / "Order 10 to fill up to 10.
 * Shows under Stock › Low stock."). On a phone the steppers stack. A
 * loose-selling medicine counts in units: "3 packs + 4 in stock", "Reorder at
 * (units)", "Order 3 packs to fill up to 30 units." and "Counted in units ·
 * 10 per pack" (D5).
 */
export function MedicineStockPanel({
  form,
  values,
  idPrefix,
  testId,
}: {
  form: UseFormReturn<MedicineFormValues>;
  values: MedicineFormValues;
  idPrefix: string;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const now = formStock(values);
  const min = values.minStock;
  const max = values.maxStock;
  const words = useStockWords(values, now);
  const tone = MEDICINE_STOCK_HEALTH_TONES[words.health];
  const at = stockBarScale(now, min, max);
  const zones = {
    '--low': at(min),
    '--ok-width': at(max - min),
    '--fill': at(max),
    '--now': at(now),
  } as CSSProperties;

  return (
    <div
      data-testid={`${testId}-stock`}
      className="bg-background flex flex-col gap-2 rounded-xl border p-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground-strong text-xs font-medium">
          {t(K.title)}
        </span>
        <span
          data-slot="pill"
          data-testid={`${testId}-stock-state`}
          className={cn(
            'ms-auto inline-flex h-5.5 items-center rounded-full px-2 text-xs font-medium tabular-nums',
            TONE_CLASSES[tone].surface,
          )}
        >
          {words.now}
        </span>
      </div>
      <div
        aria-hidden="true"
        data-slot="pill"
        style={zones}
        className="bg-muted relative mt-1.5 mb-3.5 h-2 rounded-full"
      >
        <span
          data-slot="pill"
          className={cn(
            'absolute inset-y-0 start-0 w-(--low) rounded-s-full transition-[width] duration-200',
            TONE_CLASSES.blush.bg,
          )}
        />
        <span
          className={cn(
            'absolute inset-y-0 start-(--low) w-(--ok-width) transition-[inset-inline-start,width] duration-200',
            TONE_CLASSES.sage.bg,
          )}
        />
        <span className="bg-foreground absolute start-(--now) -top-1.25 -ms-px h-4.5 w-0.5 rounded-xs transition-[inset-inline-start] duration-200" />
        <span
          className={cn(
            'text-tiny absolute start-(--low) top-3.5 -translate-x-1/2 tabular-nums rtl:translate-x-1/2',
            TONE_CLASSES.blush.ink,
          )}
        >
          {min}
        </span>
        <span
          className={cn(
            'text-tiny absolute start-(--fill) top-3.5 -translate-x-1/2 tabular-nums rtl:translate-x-1/2',
            TONE_CLASSES.sage.ink,
          )}
        >
          {max}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <div className="flex flex-col gap-1">
          <LevelLabel htmlFor={`${idPrefix}-minStock`} ink={TONE_CLASSES.blush.ink}>
            {words.reorderAt}
          </LevelLabel>
          <Controller
            control={form.control}
            name="minStock"
            render={({ field: control }) => (
              <DrawerStepper
                id={`${idPrefix}-minStock`}
                value={control.value}
                onValueChange={control.onChange}
                min={0}
                max={max}
                decreaseLabel={t(K.decreaseReorder)}
                increaseLabel={t(K.increaseReorder)}
                className="h-8"
                testId={`${testId}-reorder-at`}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <LevelLabel htmlFor={`${idPrefix}-maxStock`} ink={TONE_CLASSES.sage.ink}>
            {words.fillUpTo}
          </LevelLabel>
          <Controller
            control={form.control}
            name="maxStock"
            render={({ field: control }) => (
              <DrawerStepper
                id={`${idPrefix}-maxStock`}
                value={control.value}
                onValueChange={control.onChange}
                min={min}
                max={MEDICINE_FORM_LIMITS.level}
                decreaseLabel={t(K.decreaseFill)}
                increaseLabel={t(K.increaseFill)}
                className="h-8"
                testId={`${testId}-fill-up-to`}
              />
            )}
          />
        </div>
      </div>
      <span
        className="text-muted-foreground text-xs text-pretty"
        data-testid={`${testId}-stock-hint`}
      >
        {words.hint}
        {words.note ? (
          <span className="block" data-testid={`${testId}-stock-units`}>
            {words.note}
          </span>
        ) : null}
      </span>
    </div>
  );
}
