import { type ReactNode, type Ref, type RefObject, useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { RxCatalog } from '@/shared/api/app/prescriptions-contracts.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { QuickLine } from '@/shared/components/QuickLine/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  type ItemsColumn,
  ItemsField,
  ItemsPickerCell,
  ItemsQtyCell,
  type ItemsRowContext,
} from '@/shared/forms/ItemsField/index.ts';
import { ClipboardList } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import {
  emptyRxLine,
  RX_PLACES,
  rxDaysIn,
  type RxFormLine,
  type RxFormValues,
  rxQtyFor,
  typedText,
  typedValue,
} from './rx-form.ts';
import { RxDaysCell, RxDoseCell, RxWhenCell } from './rx-item-cells.tsx';
import { RxMedicineCell } from './rx-medicine-cell.tsx';
import { type ReadableRxPadLine, withRxPadLines } from './rx-pad.ts';
import { RxPadPanel } from './rx-pad-panel.tsx';
import { useRxLabels } from './use-rx-labels.ts';
import { useRxQuickLine } from './use-rx-quick-line.ts';

const K = RX_KEYS;

/** The Rx Pad's state, held by the drawer (its Esc closes the Pad first). */
export interface RxPadState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The Rx Pad's elements, held by the drawer. */
export interface RxPadRefs {
  /** The open Pad's root. */
  panelRef: RefObject<HTMLElement | null>;
  /** The toggle beside Browse — the focus goes back to it when the Pad closes. */
  toggleRef: RefObject<HTMLButtonElement | null>;
}

/** Props of {@link RxMedicinesField}. */
export interface RxMedicinesFieldProps {
  form: UseFormReturn<RxFormValues>;
  /** The form's lines as they stand (the drawer watches them). */
  items: RxFormValues['items'];
  catalog: RxCatalog | undefined;
  readOnly: boolean;
  /** The Rx Pad beside Browse (feat-prescription-composer §6.4); none without it. */
  pad?: RxPadState;
  /** The Pad's root and its toggle (with `pad`). */
  padPanelRef?: Ref<HTMLElement>;
  padToggleRef?: RefObject<HTMLButtonElement | null>;
  /** The patient's allergies — the Pad marks a line that matches one. */
  allergies?: readonly string[] | null;
  /** The quick line's input — a new prescription's drawer focuses it on open. */
  quickLineRef?: Ref<HTMLInputElement>;
  /** The drawer focuses the line on open: that focus keeps its suggestions closed. */
  focusOnOpen?: boolean;
  /** A line under a row's note: the allergy warning (change-prescription-writing D7). */
  rowFooter?: (row: ItemsRowContext<RxFormValues, 'items'>) => ReactNode;
}

/** "Pad" beside Browse: opens and closes the Rx Pad under the quick line. */
function RxPadToggle({
  pad,
  controls,
  toggleRef,
}: {
  pad: RxPadState;
  controls: string;
  toggleRef: Ref<HTMLButtonElement> | undefined;
}) {
  const { t } = useTranslation(RX_NS);
  return (
    <Button
      ref={toggleRef}
      type="button"
      variant={pad.open ? 'default' : 'outline'}
      aria-pressed={pad.open}
      aria-controls={pad.open ? controls : undefined}
      title={t(K.pad.toggleHint)}
      onClick={() => pad.onOpenChange(!pad.open)}
      data-testid={`${RX_TEST_IDS.pad}-toggle`}
      className={cn(
        'h-11 gap-1.5 shadow-none',
        pad.open ? 'border-primary border' : 'text-foreground-soft hover:border-disabled',
      )}
    >
      <ClipboardList aria-hidden="true" className="size-3.75" />
      <span className="max-sm:sr-only">{t(K.pad.toggle)}</span>
    </Button>
  );
}

/**
 * The item rows' columns (change-prescription-writing §6.1) — Medicine (its
 * source pill) · Dose (one-tap times and the ⌄) · Days · Meal · Where · Qty —
 * and the quantity recompute: days × doses a day whenever the dose or the
 * days change (a note's own days count while Days is empty).
 */
function useRxColumns({
  form,
  catalog,
  readOnly,
}: Pick<RxMedicinesFieldProps, 'form' | 'catalog' | 'readOnly'>) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const medicines = catalog?.medicines ?? [];

  const recompute = (
    rowName: `items.${number}`,
    line: Pick<RxFormLine, 'dose' | 'days' | 'remarks'>,
  ) => {
    const days = line.days ?? rxDaysIn(line.remarks, labels.dayWords);
    const qty = rxQtyFor(line.dose, days);
    if (qty !== null) form.setValue(`${rowName}.qty`, qty, { shouldDirty: true });
  };

  const placeOptions = (current: string): PickerOption[] => {
    const typed = typedText(current);
    // No tone dot: the place's word keeps the cell's room (1280px, the sidekick beside it).
    const leading = { kind: 'none' } as const;
    return [
      ...RX_PLACES.map((place) => ({
        key: place.key,
        label: t(K.places[place.key]),
        leading,
      })),
      ...(typed !== null ? [{ key: current, label: typed, leading }] : []),
    ];
  };

  const columns: ItemsColumn<RxFormValues, 'items'>[] = [
    {
      id: 'medicine',
      header: t(K.items.medicine),
      track: 'minmax(176px,1.5fr)',
      cell: (row) => (
        <RxMedicineCell form={form} row={row} medicines={medicines} readOnly={readOnly} />
      ),
    },
    {
      id: 'dose',
      header: t(K.items.dose),
      track: 'minmax(124px,auto)',
      cell: (row) => (
        <RxDoseCell<RxFormValues>
          {...row.bind('dose')}
          readOnly={readOnly}
          onValue={(dose) => recompute(row.name, { ...row.row, dose })}
        />
      ),
    },
    {
      id: 'days',
      header: t(K.items.days),
      track: '100px',
      cell: (row) => (
        <RxDaysCell<RxFormValues>
          {...row.bind('days')}
          readOnly={readOnly}
          onValue={(days) => recompute(row.name, { ...row.row, days })}
        />
      ),
    },
    {
      id: 'meal',
      header: t(K.items.meal),
      track: 'minmax(138px,.9fr)',
      cell: (row) => (
        <RxWhenCell<RxFormValues> {...row.bind('when')} readOnly={readOnly} />
      ),
    },
    {
      id: 'where',
      header: t(K.items.where),
      track: 'minmax(108px,.8fr)',
      cell: (row) => (
        <ItemsPickerCell<RxFormValues>
          {...row.bind('where')}
          options={placeOptions(row.row.where)}
          placeholder={t(K.items.where)}
          createLabel={t(K.items.use)}
          autoCreate
          clearable
          onCreate={(query) => {
            const text = query.trim().slice(0, 40);
            if (text)
              form.setValue(`${row.name}.where`, typedValue(text), { shouldDirty: true });
          }}
          disabled={readOnly}
        />
      ),
    },
    {
      id: 'qty',
      header: t(K.items.qty),
      track: '92px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell<RxFormValues>
          {...row.bind('qty')}
          min={1}
          max={999}
          readOnly={readOnly}
        />
      ),
    },
  ];
  return { columns, recompute };
}

/**
 * Step 2 "Medicines" (H:4806–4807; `patient-file.md:111–112`;
 * change-prescription-writing §6.1): the quick line, Browse and the Pad above
 * the item rows — Medicine (the store's with its stock, or an outside name) ·
 * Dose (one-tap times, the ⌄ for the common doses, SOS and more tablets) ·
 * Days · Meal · Where (14 places, or typed: "Use") · Qty · × — each with its
 * dashed note line and, for a line that matches an allergy, its warning;
 * "+ Add medicine". The table keeps one row.
 */
export function RxMedicinesField({
  form,
  items,
  catalog,
  readOnly,
  pad,
  padPanelRef,
  padToggleRef,
  allergies = null,
  quickLineRef,
  focusOnOpen = false,
  rowFooter,
}: RxMedicinesFieldProps) {
  const { t } = useTranslation(RX_NS);
  const quickLine = useRxQuickLine(form, catalog, items);
  const { columns, recompute } = useRxColumns({ form, catalog, readOnly });
  const padId = useId();
  // The Pad adds its lines as the quick line adds one: a blank row first, the last dosage.
  const addPadLines = (lines: readonly ReadableRxPadLine[]) => {
    form.setValue('items', withRxPadLines(form.getValues('items'), lines), {
      shouldDirty: true,
    });
    notify.success(t(K.pad.added, { count: lines.length }));
  };
  const toolbar = readOnly ? undefined : (
    <div className="flex flex-col gap-2.5">
      <QuickLine
        {...quickLine}
        inputRef={quickLineRef}
        quietFirstFocus={focusOnOpen}
        trailing={
          pad ? (
            <RxPadToggle pad={pad} controls={padId} toggleRef={padToggleRef} />
          ) : undefined
        }
      />
      {pad?.open ? (
        <RxPadPanel
          id={padId}
          catalog={catalog?.medicines ?? []}
          allergies={allergies}
          onAdd={addPadLines}
          onClose={() => {
            pad.onOpenChange(false);
            padToggleRef?.current?.focus();
          }}
          panelRef={padPanelRef}
        />
      ) : null}
    </div>
  );

  return (
    <ItemsField<RxFormValues, 'items'>
      control={form.control}
      name="items"
      label={t(K.items.label)}
      columns={columns}
      newRow={emptyRxLine}
      addLabel={t(K.items.addMedicine)}
      minRows={1}
      readOnly={readOnly}
      note={{
        key: 'remarks',
        placeholder: t(K.items.note),
        maxLength: 200,
        // A note's own days count only while Days is empty.
        onChange: (value, row) => recompute(row.name, { ...row.row, remarks: value }),
      }}
      rowFooter={rowFooter}
      toolbar={toolbar}
      testId="rx-items"
    />
  );
}
