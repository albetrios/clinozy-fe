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
import { useCanHover } from '@/shared/hooks/useCanHover/index.ts';
import { useElementWidth } from '@/shared/hooks/useElementWidth/index.ts';
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
import {
  RxAllDays,
  RxDaysTray,
  RxDirectionsCell,
  RxDoseCell,
  RxNoteLine,
} from './rx-item-cells.tsx';
import { RxMedicineCell } from './rx-medicine-cell.tsx';
import { type ReadableRxPadLine, withRxPadLines } from './rx-pad.ts';
import { RxPadPanel } from './rx-pad-panel.tsx';
import { useRxLabels } from './use-rx-labels.ts';
import { useRxQuickLine } from './use-rx-quick-line.ts';

const K = RX_KEYS;

/**
 * The line's tracks per pointer, set on the table and read by its columns
 * (change-prescription-compact-line D9; change-prescription-touch-quantity
 * D6; change-prescription-one-line): Dose · Days · Meal · Where · Qty —
 * 128 · 200 · 170 · 88px with a mouse, 176 · 284 · 212 · 120px on touch,
 * where every segment is 44px. Declared in `prescription-drawer.css`, which
 * loads with the drawer, not on the first paint (fix-prescription-css-budget D4).
 */
const RX_TRACKS_CLASS = 'rx-tracks';

/**
 * The table width from which Days and Meal · Where are columns of the line
 * (change-prescription-one-line D9): a medicine of about 200px, the tracks
 * above, the ×, the gaps and the padding — 870px with a mouse (1280 beside
 * the Rx check holds them), 1090px on touch. Narrower, both lead the line
 * under the medicine.
 */
const RX_ONE_LINE_FROM = { mouse: 870, touch: 1090 } as const;

/**
 * Whether the table holds a medicine on one line now — measured on the
 * table itself, so the Rx check beside it counts; before the first measure
 * (0) it does.
 */
function useRxOneLine() {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const mouse = useCanHover();
  const from = mouse ? RX_ONE_LINE_FROM.mouse : RX_ONE_LINE_FROM.touch;
  return { measure, oneLine: width === 0 || width >= from };
}

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
      // Its word hides on a phone, so the name stays on the button.
      aria-label={t(K.pad.toggle)}
      title={t(K.pad.toggleHint)}
      onClick={() => pad.onOpenChange(!pad.open)}
      data-testid={`${RX_TEST_IDS.pad}-toggle`}
      className={cn(
        'h-11 gap-1.5 shadow-none',
        pad.open ? 'border-primary border' : 'text-foreground-soft hover:border-disabled',
      )}
    >
      <ClipboardList aria-hidden="true" className="size-3.75" />
      <span className="hidden sm:inline">{t(K.pad.toggle)}</span>
    </Button>
  );
}

/**
 * The item rows (change-prescription-one-line): one numbered line per
 * medicine — Medicine (its source pill) · Dose (`1 0 1`, SOS) · Days · Meal
 * · Where (the two usual picks and More) · Qty — or, on a narrow table, Days
 * and Meal · Where under the medicine; a note under its line when there is
 * one. The quantity follows days × doses a day whenever the dose, the days or
 * a note's own days (while Days is empty) change.
 */
function useRxColumns({
  form,
  catalog,
  readOnly,
  oneLine,
}: Pick<RxMedicinesFieldProps, 'form' | 'catalog' | 'readOnly'> & {
  /** Days and Meal · Where are columns of the line (D9), else under it. */
  oneLine: boolean;
}) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const medicines = catalog?.medicines ?? [];

  const recompute = (rowName: `items.${number}`, line: RxFormLine) => {
    // A tube or a bottle is not counted by the day (D11): its quantity stays as written.
    if (rxIsSkinLine(line, medicines)) return;
    const days = line.days ?? rxDaysIn(line.remarks, labels.dayWords);
    const qty = rxQtyFor(line.dose, days);
    if (qty !== null) form.setValue(`${rowName}.qty`, qty, { shouldDirty: true });
  };

  type Row = ItemsRowContext<RxFormValues, 'items'>;
  const set = <K extends 'days' | 'when' | 'where' | 'dose' | 'remarks'>(
    row: Row,
    key: K,
    value: RxFormLine[K],
  ) => {
    form.setValue(`${row.name}.${key}`, value as never, { shouldDirty: true });
    if (key === 'days' || key === 'dose' || key === 'remarks') {
      recompute(row.name, { ...row.row, [key]: value });
    }
  };

  const daysTray = (row: Row, inColumn: boolean) => (
    <RxDaysTray
      days={row.row.days}
      onDays={(days) => set(row, 'days', days)}
      readOnly={readOnly}
      testId={inColumn ? row.testId : 'rx-items-days'}
      showLabel={!inColumn}
    />
  );
  const directions = (row: Row, inColumn: boolean) => (
    <RxDirectionsCell
      line={row.row}
      skin={rxIsSkinLine(row.row, medicines)}
      readOnly={readOnly}
      onWhen={(when) => set(row, 'when', when)}
      onWhere={(where) => set(row, 'where', where)}
      onDose={(dose) => set(row, 'dose', dose)}
      onNote={(note) => set(row, 'remarks', note)}
      testId={inColumn ? row.testId : 'rx-items-directions'}
      panelTestId="rx-items"
      showLabel={!inColumn}
    />
  );

  const columns: ItemsColumn<RxFormValues, 'items'>[] = [
    {
      id: 'medicine',
      header: t(K.items.medicine),
      // Only the room the other columns leave (D8).
      track: 'minmax(190px,1fr)',
      cell: (row) => (
        <RxMedicineCell form={form} row={row} medicines={medicines} readOnly={readOnly} />
      ),
    },
    {
      id: 'dose',
      header: t(K.items.dose),
      // Set, not `auto`: each row is a grid of its own, and the header lines up only with a set track.
      track: 'var(--rx-dose-track)',
      cell: (row) => (
        <RxDoseCell<RxFormValues>
          {...row.bind('dose')}
          readOnly={readOnly}
          onValue={(dose) => recompute(row.name, { ...row.row, dose })}
        />
      ),
    },
    ...(oneLine
      ? [
          {
            id: 'days',
            header: t(K.items.days),
            track: 'var(--rx-days-track)',
            cell: (row: Row) => daysTray(row, true),
          } satisfies ItemsColumn<RxFormValues, 'items'>,
          {
            id: 'directions',
            header: `${t(K.items.meal)} · ${t(K.items.where)}`,
            track: 'var(--rx-directions-track)',
            // A line without a medicine has no meal or place to pick yet.
            cell: (row: Row) =>
              row.row.medicineName.trim() === '' ? null : directions(row, true),
          } satisfies ItemsColumn<RxFormValues, 'items'>,
        ]
      : []),
    {
      id: 'qty',
      header: t(K.items.qty),
      // 92px with a mouse, 120px on touch for the 44px buttons (change-prescription-touch-quantity D6).
      track: 'var(--rx-qty-track)',
      align: 'end',
      cell: (row) => (
        // The track's width on a phone row too, where no track holds the stepper.
        <div className="rx-qty-box max-w-full">
          <ItemsQtyCell<RxFormValues>
            {...row.bind('qty')}
            min={1}
            max={999}
            readOnly={readOnly}
            largeOnTouch
          />
        </div>
      ),
    },
  ];
  // Under the line: Days and Meal · Where on a narrow table, then the note when there is one.
  const rowDetail = (row: Row) => {
    const note = row.row.remarks.trim();
    // A line without a medicine has no meal or place to pick yet.
    const folded = !oneLine && row.row.medicineName.trim() !== '';
    if (!(folded || note)) return null;
    return (
      <div className="flex flex-col gap-1.5">
        {folded ? (
          <div
            data-testid="rx-items-rail"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
          >
            {daysTray(row, false)}
            {directions(row, false)}
          </div>
        ) : null}
        {note ? <RxNoteLine note={note} testId="rx-items-note-line" /> : null}
      </div>
    );
  };
  return { columns, rowDetail };
}

/**
 * Step 2 "Medicines" (H:4806–4807; `patient-file.md:111–112`;
 * change-prescription-one-line): the quick line, Browse and the Pad above
 * the item rows, and "All medicines · Days" once two medicines are written.
 * Each row is one numbered line — Medicine (the store's with its stock, or an
 * outside name) · Dose `1 0 1` · Days · Meal · Where (and More) · Qty · × —
 * with its note under it when there is one and, for a line that matches an
 * allergy, its warning; "+ Add medicine". No everyday choice needs a
 * dropdown. The table keeps one row.
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
  const { measure, oneLine } = useRxOneLine();
  const { columns, rowDetail } = useRxColumns({ form, catalog, readOnly, oneLine });
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
            form.setValue(
              'items',
              // A tube or a bottle keeps its quantity (D11).
              withRxDaysForAll(form.getValues('items'), days, (item) =>
                rxIsSkinLine(item, catalog?.medicines ?? []),
              ),
              { shouldDirty: true },
            )
          }
          testId="rx-items-all-days"
        />
      ) : null}
    </div>
  );

  return (
    <div ref={measure} data-one-line={oneLine} className="min-w-0">
      <ItemsField<RxFormValues, 'items'>
        control={form.control}
        name="items"
        label={t(K.items.label)}
        columns={columns}
        newRow={emptyRxLine}
        addLabel={t(K.items.addMedicine)}
        minRows={1}
        readOnly={readOnly}
        rowDetail={rowDetail}
        rowFooter={rowFooter}
        toolbar={toolbar}
        testId="rx-items"
        className={RX_TRACKS_CLASS}
      />
    </div>
  );
}
