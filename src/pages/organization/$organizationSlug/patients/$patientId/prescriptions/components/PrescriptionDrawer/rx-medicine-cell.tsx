import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { RxCatalogMedicine } from '@/shared/api/app/prescriptions-contracts.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { type PickerOption, PickerTrigger } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  ItemsPickerCell,
  type ItemsRowContext,
} from '@/shared/forms/ItemsField/index.ts';
import { ArrowUpRight, Package } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  rxFormLineOf,
  type RxFormValues,
  type RxLineSource,
  rxLineSource,
  rxQtyFor,
  rxStoreMedicineFor,
} from './rx-form.ts';
import { useRxLabels } from './use-rx-labels.ts';

const K = RX_KEYS;

/** A typed name's longest (the contract's `medicine_name`). */
const NAME_MAX_LENGTH = 120;

/** Each source's pill: in stock sage, out of stock blush, no stock read sage, outside slate. */
const SOURCE_TONES: Readonly<Record<Exclude<RxLineSource, 'none'>, Tone>> = {
  stocked: 'sage',
  empty: 'blush',
  store: 'sage',
  outside: 'slate',
};

/** A line's source in words: "24 in your medical store", "Outside medicine — …". */
function useSourceWords() {
  const { t } = useTranslation(RX_NS);
  return (source: RxLineSource, stock: number | null): string => {
    if (source === 'stocked') return t(K.items.source.stocked, { count: stock ?? 0 });
    if (source === 'empty') return t(K.items.source.empty);
    if (source === 'store') return t(K.items.source.store);
    if (source === 'outside') return t(K.items.source.outsideHint);
    return '';
  };
}

/**
 * The source pill inside the Medicine trigger (change-prescription-writing
 * D4): the store's medicine with its stock (a box and "24", sage; "0", blush)
 * or "Outside" (slate) — a name written as text, bought elsewhere.
 */
function RxSourcePill({ source, stock }: { source: RxLineSource; stock: number | null }) {
  const { t } = useTranslation(RX_NS);
  if (source === 'none') return null;
  const outside = source === 'outside';
  return (
    <TonePill
      tone={SOURCE_TONES[source]}
      size="xs"
      aria-hidden="true"
      data-source={source}
      icon={outside ? undefined : <Package className="size-3" />}
      className="ms-auto"
    >
      {outside ? t(K.items.source.outside) : (stock ?? null)}
    </TonePill>
  );
}

/**
 * The medicine list (D4): the store's medicines under "In your medical store"
 * — composition, stock, a blush dot when none is left — then the names this
 * patient was written before under "Outside medicines", and the row's own
 * typed name when the list lacks it.
 */
function useMedicineOptions(medicines: readonly RxCatalogMedicine[]) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const stockOf = (medicine: RxCatalogMedicine) => {
    if (medicine.stock === null) return undefined;
    return medicine.stock > 0
      ? t(K.quick.inStock, { count: medicine.stock })
      : t(K.quick.outOfStock);
  };
  return (current: string): PickerOption<RxCatalogMedicine>[] => {
    const store = medicines
      .filter((medicine) => medicine.medicineId !== null)
      .map((medicine): PickerOption<RxCatalogMedicine> => ({
        key: medicine.name,
        label: medicine.name,
        sub: medicine.composition ?? undefined,
        meta: stockOf(medicine),
        group: t(K.items.groups.store),
        groupTone: 'sage',
        tone: medicine.stock === 0 ? 'blush' : 'sage',
        data: medicine,
      }));
    const outside = medicines
      .filter((medicine) => medicine.medicineId === null)
      .map((medicine): PickerOption<RxCatalogMedicine> => ({
        key: medicine.name,
        label: medicine.name,
        sub: medicine.last
          ? labels.directions(rxFormLineOf(medicine.last, labels.dayWords)) ||
            t(K.items.writtenBefore)
          : t(K.items.writtenBefore),
        group: t(K.items.groups.outside),
        groupTone: 'slate',
        tone: 'slate',
        data: medicine,
      }));
    const known = medicines.some((medicine) => medicine.name === current);
    const typed: PickerOption<RxCatalogMedicine>[] =
      current && !known
        ? [
            {
              key: current,
              label: current,
              group: t(K.items.groups.outside),
              groupTone: 'slate',
              tone: 'slate',
            },
          ]
        : [];
    return [...store, ...outside, ...typed];
  };
}

/** The list's footer (D4): the picked line switched store ↔ outside, when it can be. */
function SourceSwitch({
  form,
  row,
  medicines,
  close,
}: {
  form: UseFormReturn<RxFormValues>;
  row: ItemsRowContext<RxFormValues, 'items'>;
  medicines: readonly RxCatalogMedicine[];
  close: () => void;
}) {
  const { t } = useTranslation(RX_NS);
  const line = row.row;
  if (line.medicineName.trim() === '') return null;
  const store = rxStoreMedicineFor(line, medicines);
  if (line.medicineId === null && !store) return null;
  const toStore = store !== undefined;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        form.setValue(`${row.name}.medicineId`, store?.medicineId ?? null, {
          shouldDirty: true,
        });
        close();
      }}
      data-testid={`${row.testId}-${toStore ? 'to-store' : 'to-outside'}`}
      className="text-detail h-auto w-full justify-start gap-2 px-2 py-1.5 text-start whitespace-normal"
    >
      {toStore ? (
        <Package aria-hidden="true" className="size-3.5 flex-none" />
      ) : (
        <ArrowUpRight aria-hidden="true" className="size-3.5 flex-none" />
      )}
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">
          {t(toStore ? K.items.toStore : K.items.toOutside)}
        </span>
        <span className="text-caption text-muted-foreground font-normal">
          {toStore
            ? (store?.composition ?? t(K.items.source.store))
            : t(K.items.toOutsideHint)}
        </span>
      </span>
    </Button>
  );
}

/** The list's footer for one row, built outside the cell (a render prop, not a nested component). */
function sourceSwitchFooter(
  props: Omit<Parameters<typeof SourceSwitch>[0], 'close'>,
): (close: () => void) => ReactNode {
  return (close) => <SourceSwitch {...props} close={close} />;
}

/**
 * The Medicine cell (H:4807; change-prescription-writing D4): the store's
 * medicines and this patient's outside names, grouped; a new name is added as
 * an outside medicine ("Outside medicine “…”", 120 characters). The trigger
 * names the medicine and its source; the list's footer switches the line store
 * ↔ outside. A first pick takes the patient's last directions for it (H:4807),
 * its days and quantity too.
 */
export function RxMedicineCell({
  form,
  row,
  medicines,
  readOnly,
}: {
  form: UseFormReturn<RxFormValues>;
  row: ItemsRowContext<RxFormValues, 'items'>;
  medicines: readonly RxCatalogMedicine[];
  readOnly: boolean;
}) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const optionsFor = useMedicineOptions(medicines);
  const sourceWords = useSourceWords();
  const line = row.row;
  const { source, stock } = rxLineSource(line, medicines);
  const words = sourceWords(source, stock);

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      {/* The line's number: each medicine reads as its own line (change-prescription-one-line D7). */}
      <span
        aria-hidden="true"
        data-testid={`${row.testId}-number`}
        className="rx-line-number bg-muted text-tiny text-muted-foreground-strong flex size-5 flex-none items-center justify-center rounded-sm font-semibold tabular-nums"
      >
        {row.index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <ItemsPickerCell<RxFormValues, RxCatalogMedicine>
          {...row.bind('medicineName')}
          options={optionsFor(line.medicineName)}
          placeholder={t(K.items.medicine)}
          searchPlaceholder={t(K.items.searchMedicine)}
          createLabel={t(K.items.addOutside)}
          autoCreate
          minWidth={320}
          onCreate={(query) => {
            const name = query.trim().slice(0, NAME_MAX_LENGTH);
            if (!name) return;
            form.setValue(`${row.name}.medicineName`, name, { shouldDirty: true });
            form.setValue(`${row.name}.medicineId`, null, { shouldDirty: true });
          }}
          onPick={(option) => {
            const medicine = option?.data;
            form.setValue(`${row.name}.medicineId`, medicine?.medicineId ?? null, {
              shouldDirty: true,
            });
            if (!(medicine?.last && !line.dose && !line.when)) return;
            const last = rxFormLineOf(medicine.last, labels.dayWords);
            form.setValue(
              row.name,
              {
                ...line,
                ...last,
                medicineName: medicine.name,
                qty: rxQtyFor(last.dose, last.days) ?? last.qty,
                remarks: line.remarks,
              },
              { shouldDirty: true },
            );
          }}
          footer={sourceSwitchFooter({ form, row, medicines })}
          disabled={readOnly}
          renderTrigger={({ placeholder, invalid, describedBy }) => (
            <PickerTrigger
              size="sm"
              inset="compact"
              disabled={readOnly}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={describedBy}
              // The medicine, or the placeholder it shows before one (WCAG 2.5.3 Label in Name).
              aria-label={[row.label, line.medicineName || placeholder, words]
                .filter(Boolean)
                .join(' · ')}
              title={words || undefined}
              data-testid={row.testId}
              data-source={source}
              // 44px on touch, like the line's segments and stepper (change-prescription-touch-picker D3).
              className="rx-medicine-trigger pe-2"
            >
              {line.medicineName ? (
                <>
                  <span dir="auto" className="min-w-0 truncate">
                    {line.medicineName}
                  </span>
                  <RxSourcePill source={source} stock={stock} />
                </>
              ) : (
                <span className={cn('text-muted-foreground truncate')}>
                  {placeholder}
                </span>
              )}
            </PickerTrigger>
          )}
        />
      </div>
    </div>
  );
}
