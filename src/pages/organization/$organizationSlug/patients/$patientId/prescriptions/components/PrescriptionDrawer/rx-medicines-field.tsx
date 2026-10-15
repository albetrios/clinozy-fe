import { type ReactNode, type Ref, type RefObject, useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { RxCatalog } from '@/shared/api/app/prescriptions-contracts.ts';
import { QuickLine } from '@/shared/components/QuickLine/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  type ItemsColumn,
  ItemsField,
  ItemsQtyCell,
  type ItemsRowContext,
} from '@/shared/forms/ItemsField/index.ts';
import { ClipboardList } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import {
  emptyRxLine,
  namedRxLines,
  rxDaysIn,
  type RxFormLine,
  type RxFormValues,
  rxIsSkinLine,
  rxQtyFor,
  rxSharedDays,
  withRxDaysForAll,
} from './rx-form.ts';
import { RxAllDays, RxDoseCell, RxLineRail } from './rx-item-cells.tsx';
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
 * The item rows (change-prescription-one-click D3): line 1 — Medicine (its
 * source pill) · Dose (the time chips, ×2, SOS) · Qty — and the rail under
 * it — Days · When · Where, a chip each; with the quantity recompute: days ×
 * doses a day whenever the dose or the days change (a note's own days count
 * while Days is empty).
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

  const set = <K extends 'days' | 'when' | 'where'>(
    rowName: `items.${number}`,
    key: K,
    value: RxFormLine[K],
  ) => form.setValue(`${rowName}.${key}`, value as never, { shouldDirty: true });

  const columns: ItemsColumn<RxFormValues, 'items'>[] = [
    {
      id: 'medicine',
      header: t(K.items.medicine),
      track: 'minmax(200px,1fr)',
      cell: (row) => (
        <RxMedicineCell form={form} row={row} medicines={medicines} readOnly={readOnly} />
      ),
    },
    {
      id: 'dose',
      header: t(K.items.dose),
      // Fixed, not `auto`: each row is a grid of its own, and the header lines up only with a set track.
      track: 'minmax(0,384px)',
      cell: (row) => (
        <RxDoseCell<RxFormValues>
          {...row.bind('dose')}
          readOnly={readOnly}
          onValue={(dose) => recompute(row.name, { ...row.row, dose })}
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
  // The line's second row (D3): how long, when, where — a chip each.
  const rowDetail = (row: ItemsRowContext<RxFormValues, 'items'>) =>
    row.row.medicineName.trim() === '' ? null : (
      <RxLineRail
        days={row.row.days}
        when={row.row.when}
        where={row.row.where}
        skin={rxIsSkinLine(row.row, medicines)}
        readOnly={readOnly}
        onDays={(days) => {
          set(row.name, 'days', days);
          recompute(row.name, { ...row.row, days });
        }}
        onWhen={(when) => set(row.name, 'when', when)}
        onWhere={(where) => set(row.name, 'where', where)}
        testId="rx-items"
      />
    );
  return { columns, recompute, rowDetail };
}

/**
 * Step 2 "Medicines" (H:4806–4807; `patient-file.md:111–112`;
 * change-prescription-one-click): the quick line, Browse and the Pad above the
 * item rows, and "Same days for all" once two medicines are written. Each row
 * — Medicine (the store's with its stock, or an outside name) · Dose (chips) ·
 * Qty · × — has its rail of Days · When · Where chips, its dashed note line
 * and, for a line that matches an allergy, its warning; "+ Add medicine". No
 * everyday choice needs a dropdown. The table keeps one row.
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
  const { columns, recompute, rowDetail } = useRxColumns({ form, catalog, readOnly });
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
      {namedRxLines(items).length > 1 ? (
        <RxAllDays
          days={rxSharedDays(items)}
          onDays={(days) =>
            form.setValue('items', withRxDaysForAll(form.getValues('items'), days), {
              shouldDirty: true,
            })
          }
          testId="rx-items-all-days"
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
      rowDetail={rowDetail}
      rowFooter={rowFooter}
      toolbar={toolbar}
      testId="rx-items"
    />
  );
}
