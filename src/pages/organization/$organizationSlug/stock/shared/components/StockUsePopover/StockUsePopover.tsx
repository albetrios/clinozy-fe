import { type RefObject, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerChips, DrawerNumberInput } from '@/shared/components/DrawerField/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/shared/components/ui/popover.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group.tsx';
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
  quantityStep,
  quickQuantities,
  startQuantity,
  stockAfter,
  TREATMENTS,
  treatmentTone,
} from '../../stock-movement.ts';
import { fromMilli, toMilli } from '../../stock-units.ts';
import {
  useMovementRefusal,
  useMovementUndo,
} from '../StockMovementDrawer/use-movement-outcome.ts';

const K = STOCK_DRAWER_KEYS.use;

/** A quantity's longest text (8 characters, `clinic-stock.md:94`). */
const QUANTITY_MAX_LENGTH = 8;

/** Props of {@link StockUsePopover}. */
export interface StockUsePopoverProps {
  /** The item the row's Use opened it for; open while set with an anchor. */
  item: StockItemRow | null;
  /** The row's Use button — the popover's anchor. */
  anchor: HTMLElement | null;
  onClose: () => void;
  /** "More details": the Log usage drawer for the same item. */
  onMoreDetails: (item: StockItemRow) => void;
  testId?: string;
}

/** A figure a step away, never below 0, at most two decimals. */
const stepped = (text: string, step: number) =>
  String(Math.max(0, Math.round(((Number.parseFloat(text) || 0) + step) * 100) / 100));

/** What the popover's parts share: the item, the typed quantity and what it counts. */
interface UseDraft {
  item: StockItemRow;
  mode: QuantityMode;
  quantity: string;
  setQuantity: (text: string) => void;
  testId: string;
}

/** "Measure in": the unit ⇄ the measure, segmented, with "1 tube = 30 g" (`clinic-stock.md:93`). */
function MeasureToggle({
  item,
  mode,
  onModeChange,
  testId,
}: Pick<UseDraft, 'item' | 'mode' | 'testId'> & {
  onModeChange: (mode: QuantityMode) => void;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const unitLabel = words.unit(item.unit);
  const measureLabel = item.measureUnit ? words.measure(item.measureUnit) : '';
  return (
    <div className="flex items-center justify-between gap-2">
      <ToggleGroup
        type="single"
        aria-label={t(K.measureIn)}
        value={mode}
        onValueChange={(value) => {
          if (value === 'unit' || value === 'measure') onModeChange(value);
        }}
        className="bg-muted border-muted h-9 gap-0.5 rounded-lg border p-0.75"
        data-testid={`${testId}-mode`}
      >
        {(['unit', 'measure'] as const).map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="text-detail data-[state=on]:bg-background data-[state=on]:ring-border h-7 rounded-md px-3 font-medium data-[state=on]:shadow-(--elevation-control) data-[state=on]:ring-1"
          >
            {value === 'unit' ? unitLabel : measureLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className="text-muted-foreground text-xs">
        {t(K.conversion, {
          unit: unitLabel,
          contents: words.amount(fromMilli(item.sizePerUnit ?? 0), measureLabel),
        })}
      </span>
    </div>
  );
}

/**
 * The quantity (`clinic-stock.md:94–95`): − · the 18px figure · its unit · +,
 * 44px targets, half a unit (or the measure's step) at a time, then the quick
 * chips — the picked one sage. Enter saves.
 */
function QuantityField({
  item,
  mode,
  quantity,
  setQuantity,
  invalid,
  inputRef,
  onEnter,
  testId,
}: UseDraft & {
  invalid: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onEnter: () => void;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const inputId = useId();
  const step = quantityStep(mode, item);
  const countsIn =
    mode === 'measure' && item.measureUnit
      ? words.measure(item.measureUnit)
      : words.unit(item.unit);
  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={t(K.less)}
          className="size-11 rounded-lg text-lg"
          onClick={() => setQuantity(stepped(quantity, -step))}
          data-testid={`${testId}-less`}
        >
          −
        </Button>
        <label htmlFor={inputId} className="sr-only">
          {t(K.quantity)}
        </label>
        <DrawerNumberInput
          ref={inputRef}
          id={inputId}
          maxLength={QUANTITY_MAX_LENGTH}
          placeholder="0"
          value={quantity}
          onValueChange={setQuantity}
          decimals={2}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onEnter();
          }}
          aria-invalid={invalid || undefined}
          // The popover's figure is its 44px big one (`clinic-stock.md:89–103`), on the drawer field's box.
          className="h-11 flex-1"
          inputClassName="px-2 text-center text-lg font-semibold"
          data-testid={`${testId}-quantity`}
        />
        <span className="text-muted-foreground-strong text-detail min-w-8">
          {countsIn}
        </span>
        <Button
          type="button"
          variant="outline"
          aria-label={t(K.more)}
          className="size-11 rounded-lg text-lg"
          onClick={() => setQuantity(stepped(quantity, step))}
          data-testid={`${testId}-more`}
        >
          +
        </Button>
      </div>
      <fieldset
        aria-label={t(K.quantity)}
        className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0"
      >
        {quickQuantities(mode, item, 'popover').map((value) => {
          const picked = Number.parseFloat(quantity) === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={picked}
              data-slot="pill"
              onClick={() => setQuantity(String(value))}
              data-testid={`${testId}-quick-${value}`}
              className={cn(
                'text-detail h-7 rounded-full border px-3 font-medium tabular-nums transition-colors duration-120',
                picked
                  ? cn(TONE_CLASSES.sage.surface, 'border-current')
                  : 'bg-background text-foreground-soft hover:bg-muted',
              )}
            >
              {words.figure(value)}
            </button>
          );
        })}
      </fieldset>
    </>
  );
}

/** The popover's body for one item: its quantity, what it counts, what it was for, the save. */
function UseBody({
  item,
  onClose,
  onMoreDetails,
  undo,
  inputRef,
  testId,
}: Omit<StockUsePopoverProps, 'item' | 'anchor'> & {
  item: StockItemRow;
  /** The use's toast with its Undo — the popover's, which outlives this body. */
  undo: (message: string, movement: StockMovementRecord) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const [mode, setMode] = useState<QuantityMode>('unit');
  const [quantity, setQuantity] = useState('1');
  const [usedFor, setUsedFor] = useState<string | null>(null);
  const log = useLogStockMovement({ notifyOnError: false });
  const refusal = useMovementRefusal();

  const qtyMilli = quantityMilliOf(quantity, mode, item);
  const over = exceedsStock('used', item, qtyMilli);
  const after = stockAfter('used', item, qtyMilli);
  const countsIn =
    mode === 'measure' && item.measureUnit
      ? words.measure(item.measureUnit)
      : words.unit(item.unit);
  const typed = words.amount(Number.parseFloat(quantity) || 0, countsIn);
  const disabled = qtyMilli === 0 || over || log.isPending;

  const save = async () => {
    if (disabled) return;
    let movement: StockMovementRecord;
    try {
      movement = await log.mutateAsync({
        itemId: item.id,
        type: 'used',
        quantityMilli: qtyMilli,
        usedFor,
        note: mode === 'measure' ? typed : null,
      });
    } catch (error) {
      // Refused (someone used some since) or not sent: the popover stays, with what was typed.
      notify.error(refusal(error));
      return;
    }
    onClose();
    // "… used · 2 tube left": what is left is the server's (`quantity_after`).
    undo(
      t(K.used, {
        quantity: typed,
        name: item.name,
        left: words.units(item, movement.afterMilli),
      }),
      movement,
    );
  };

  let afterTone = 'text-muted-foreground-strong';
  if (over) afterTone = 'text-destructive';
  else if (after <= toMilli(item.minQty)) afterTone = TONE_CLASSES.butter.ink;
  const draft = { item, mode, quantity, setQuantity, testId };

  return (
    <>
      <div className="flex flex-col gap-0.5 border-b px-3.5 pt-3 pb-2.5">
        <p className="text-field truncate leading-tight font-semibold">{item.name}</p>
        <p className="text-muted-foreground text-xs">
          {t(K.inStock, { quantity: words.quantity(item, item.qtyMilli) })}
        </p>
      </div>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        {hasMeasure(item) ? (
          <MeasureToggle
            item={item}
            mode={mode}
            onModeChange={(next) => {
              setMode(next);
              setQuantity(String(startQuantity(next, item)));
            }}
            testId={testId}
          />
        ) : null}
        <QuantityField
          {...draft}
          invalid={over}
          inputRef={inputRef}
          onEnter={() => void save()}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {t(K.usedFor)}
          </span>
          <DrawerChips
            label={t(K.usedFor)}
            options={TREATMENTS.map((treatment) => ({
              value: treatment.name,
              label: t(STOCK_DRAWER_KEYS.treatments[treatment.key]),
              tone: treatmentTone(treatment),
            }))}
            value={usedFor}
            onChange={setUsedFor}
            clearable
            testId={`${testId}-used-for`}
          />
        </div>
        <p
          role={over ? 'alert' : undefined}
          className={cn('text-detail font-medium', afterTone)}
          data-testid={`${testId}-after`}
        >
          {over
            ? t(STOCK_DRAWER_KEYS.movement.onlyInStock, {
                quantity: words.quantity(item, item.qtyMilli),
              })
            : t(K.after, { quantity: words.quantity(item, after) })}
        </p>
      </div>
      <div className="bg-canvas flex items-center justify-between gap-3 rounded-b-xl border-t px-3.5 py-2.5">
        <button
          type="button"
          className="text-detail text-foreground-soft hover:text-foreground underline underline-offset-2"
          onClick={() => onMoreDetails(item)}
          data-testid={`${testId}-more-details`}
        >
          {t(K.moreDetails)}
        </button>
        <Button
          type="button"
          disabled={disabled}
          onClick={() => void save()}
          className="h-9 rounded-lg"
          data-testid={`${testId}-save`}
        >
          {qtyMilli === 0
            ? t(STOCK_DRAWER_KEYS.movement.enterQuantity)
            : t(K.save, { quantity: typed })}
        </Button>
      </div>
    </>
  );
}

/**
 * The Use popover (KICKOFF §6.8; `clinic-stock.md:89–103, 205–217`): a 300px
 * card anchored to the row's Use button — below it with a 6px gap, or above
 * when the room is there — the same anchored popover on a phone, never a
 * sheet. The item and what is in stock; "Measure in" for an item with
 * contents ("1 tube = 30 g"); the quantity with − / + (44px), its quick chips
 * and "Used for"; the stock after it ("After · 2 tube · 60 g", butter at or
 * below the minimum, red over stock — a preview). "Use 1 tube" or Enter saves a
 * `used` movement (`POST /app/stock-items/:id/movements`; a figure in the
 * measure rides in its remark) — "1 tube of Soframycin 30 gm used · 2 tube
 * left" + Undo, which reverts it as "Logged by mistake"; someone having used
 * some since is said in the room's words. "More details" opens the Log usage
 * drawer. An outside click or Esc closes it.
 */
export function StockUsePopover({
  item,
  anchor,
  onClose,
  onMoreDetails,
  testId = STOCK_DRAWER_TEST_IDS.use,
}: StockUsePopoverProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const undo = useMovementUndo();
  const open = item !== null && anchor !== null;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverAnchor virtualRef={anchorRef} />
      {item ? (
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          // Radix gives the content its `dialog` role; the label names it.
          aria-label={t(K.label, { name: item.name })}
          className="flex w-75 flex-col rounded-xl p-0"
          // The quantity is the popover's field: it takes focus, selected.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          data-testid={testId}
        >
          <UseBody
            key={item.id}
            item={item}
            onClose={onClose}
            onMoreDetails={onMoreDetails}
            undo={undo}
            inputRef={inputRef}
            testId={testId}
          />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
