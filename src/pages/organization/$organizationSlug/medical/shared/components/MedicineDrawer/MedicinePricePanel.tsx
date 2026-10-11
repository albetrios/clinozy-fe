import { useId } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  drawerMarginTone,
  marginPercent,
  mrpSplit,
} from '@/shared/api/app/medicine-stock.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  DrawerField,
  DrawerNumberInput,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group.tsx';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import {
  bestFormRate,
  GST_RATES,
  MEDICINE_FORM_LIMITS,
  type MedicineFormValues,
  mrpPaiseOf,
} from './medicine-form.ts';

const K = MEDICAL_DRAWER_KEYS.medicine.price;

/** One cell of the live split. */
interface SplitCell {
  id: string;
  label: string;
  value: string;
  /** The margin's ink (sage ≥30%, butter ≥15%, else blush). */
  ink?: string;
}

/** Before GST · GST n% · Best buy rate · Margin, from the MRP and the best price (`medical.md:179`). */
function useSplit(values: MedicineFormValues): SplitCell[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const mrp = mrpPaiseOf(values);
  const split = mrpSplit(mrp, values.gstPct);
  const best = bestFormRate(values);
  const margin = marginPercent(mrp, best?.rate);
  const none = '—';
  return [
    {
      id: 'before-gst',
      label: t(K.beforeGst),
      value: mrp > 0 ? formatPaise(split.base) : none,
    },
    {
      id: 'gst',
      label: t(K.gstAmount, { pct: values.gstPct }),
      value: mrp > 0 ? formatPaise(split.gst) : none,
    },
    {
      id: 'best-rate',
      label: t(K.bestBuyRate),
      value: best ? formatPaise(best.rate) : t(K.addSupplierPrice),
    },
    {
      id: 'margin',
      label: t(K.margin),
      value: margin === null ? none : `${margin}%`,
      ink: margin === null ? undefined : TONE_CLASSES[drawerMarginTone(margin)].ink,
    },
  ];
}

/**
 * The medicine drawer's price panel (`medical.md:178–179`; H:2916): the MRP
 * (₹, "incl. GST", eight characters) beside the GST rate as a segmented
 * control (0% · 5% · 12% · 18%), then the live split — Before GST, the GST,
 * the best buy rate (or "Add a supplier price") and the margin in its tone —
 * as cells that fit the row from `md` and scroll sideways below it.
 */
export function MedicinePricePanel({
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
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const mrp = field('mrp');
  const gstLabelId = useId();
  const cells = useSplit(values);

  return (
    <div className="flex flex-col gap-2" data-testid={`${testId}-price`}>
      <div className="flex flex-wrap items-end gap-3">
        <DrawerField
          className="flex-[1_1_200px]"
          label={t(K.mrp)}
          htmlFor={mrp.id}
          required
          error={mrp.error}
        >
          <Controller
            control={form.control}
            name="mrp"
            render={({ field: control }) => (
              <DrawerNumberInput
                {...mrp.control}
                aria-required="true"
                value={control.value}
                onValueChange={control.onChange}
                onBlur={control.onBlur}
                prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
                suffix={t(K.inclGst)}
                placeholder="0"
                maxLength={MEDICINE_FORM_LIMITS.mrp}
                data-testid={`${testId}-mrp`}
              />
            )}
          />
        </DrawerField>
        <div className="flex flex-none flex-col gap-1.5">
          <span
            id={gstLabelId}
            className="text-muted-foreground-strong text-xs leading-[normal] font-medium"
          >
            {t(K.gst)}
          </span>
          <Controller
            control={form.control}
            name="gstPct"
            render={({ field: control }) => (
              <ToggleGroup
                type="single"
                value={String(control.value)}
                onValueChange={(next) => {
                  if (next) control.onChange(Number(next));
                }}
                aria-labelledby={gstLabelId}
                data-testid={`${testId}-gst`}
                className="bg-muted h-9 gap-0.5 rounded-lg p-0.75"
              >
                {GST_RATES.map((rate) => (
                  <ToggleGroupItem
                    key={rate}
                    value={String(rate)}
                    data-testid={`${testId}-gst-${rate}`}
                    className="text-detail text-muted-foreground-strong hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:ring-border h-full min-w-10 rounded-md px-2 font-medium tabular-nums transition-colors duration-120 hover:bg-transparent data-[state=on]:font-semibold data-[state=on]:shadow-xs data-[state=on]:ring-1"
                  >
                    {`${rate}%`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </div>
      </div>
      <div
        data-testid={`${testId}-split`}
        className="bg-border flex snap-x gap-px overflow-x-auto rounded-lg border md:grid md:grid-cols-[repeat(auto-fit,minmax(104px,1fr))] md:overflow-hidden"
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            data-testid={`${testId}-split-${cell.id}`}
            className="bg-canvas flex w-32 min-w-0 flex-none snap-start flex-col gap-px px-2.5 py-1.5 md:w-auto"
          >
            <span className="text-tiny text-muted-foreground truncate">{cell.label}</span>
            <span
              className={cn(
                'text-detail font-semibold tabular-nums',
                cell.ink ?? 'text-foreground',
              )}
            >
              {cell.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
