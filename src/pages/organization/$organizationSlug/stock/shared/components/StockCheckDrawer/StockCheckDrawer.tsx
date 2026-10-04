import { useState } from 'react';
import { useForm, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { numberFromText, sanitizeNumberText } from '@/lib/number-text.ts';
import { cn } from '@/lib/utils.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/index.ts';
import { DrawerChips } from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockItemCatalogue } from '../../hooks/useStockLists/index.ts';
import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { useSaveStockCount } from '../../hooks/useStockWrites/index.ts';
import type { StockItemRow } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import type { StockCountResult } from '../../stock-records-contracts.ts';
import { fromMilli, MILLI, STOCK_CATEGORY_TONES } from '../../stock-units.ts';

const K = STOCK_DRAWER_KEYS.check;

/** The count grid: 840px (`clinic-stock.md:268`). */
const CONTENT_PROFILE = { fieldCount: 1, hasItems: true } as const;

/** A count's longest text (8 characters, `clinic-stock.md:164`). */
const COUNT_MAX_LENGTH = 8;

/** The grid from `md` (`clinic-stock.md:78`); a phone's 2 × 2 card below it (`:84`). */
const ROW_GRID =
  'grid items-center gap-x-3 px-(--drawer-pad-x) py-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(150px,190px)_minmax(96px,130px)] max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-2.5 max-md:gap-y-2 max-md:py-3';

/** The form: what was counted, by item id, as typed. */
interface CountFormValues {
  counts: Record<string, string>;
}

/** The category chip on: "All items" or one category. */
type CategoryFilter = 'all' | StockItemRow['category'];

/** The counted items that differ from the system: the lines a save sends. */
function changedLines(items: readonly StockItemRow[], counts: Record<string, string>) {
  return items.flatMap((item) => {
    const text = counts[item.id];
    if (text === undefined || text === '') return [];
    const countedMilli = numberFromText(text, MILLI);
    return countedMilli === item.qtyMilli ? [] : [{ itemId: item.id, countedMilli }];
  });
}

/** One item's row: what the system holds, what was counted, the difference (`clinic-stock.md:77`). */
function CountRow({
  item,
  form,
  testId,
}: {
  item: StockItemRow;
  form: UseFormReturn<CountFormValues>;
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const text = useWatch({ control: form.control, name: `counts.${item.id}` }) ?? '';
  const counted = text === '' ? null : numberFromText(text, MILLI);
  const diff = counted === null ? null : counted - item.qtyMilli;
  const system = words.quantity(item, item.qtyMilli);
  const setCount = (value: string) =>
    form.setValue(`counts.${item.id}`, value, { shouldDirty: true });

  let pill: { label: string; tone: PillTone } = {
    label: t(K.notCounted),
    tone: 'neutral',
  };
  if (diff === 0) pill = { label: t(K.matches), tone: 'sage' };
  else if (diff !== null) {
    pill = {
      label: `${diff > 0 ? '+' : '−'}${words.units(item, Math.abs(diff))}`,
      tone: diff > 0 ? 'sky' : 'blush',
    };
  }
  const measured =
    counted !== null && item.sizePerUnit && item.measureUnit
      ? t(K.measured, {
          quantity: words.amount(
            fromMilli(counted) * fromMilli(item.sizePerUnit),
            words.measure(item.measureUnit),
          ),
        })
      : null;

  return (
    <div
      role="row"
      tabIndex={-1}
      className={cn(ROW_GRID, 'border-b')}
      data-testid={`${testId}-row`}
    >
      <div role="cell" className="flex min-w-0 flex-col">
        <span className="text-body truncate font-medium">{item.name}</span>
        <span className="text-caption text-muted-foreground truncate">
          {words.category(item.category).label}
        </span>
      </div>
      <div
        role="cell"
        className="text-detail text-muted-foreground-strong max-md:text-end"
      >
        <span className="md:hidden">{t(K.inSystem, { quantity: system })}</span>
        <span className="max-md:hidden">{system}</span>
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <div className="border-input bg-background focus-within:ring-ring flex h-8 min-w-0 flex-1 items-center rounded-lg border px-2 focus-within:ring-2 max-md:h-10">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={COUNT_MAX_LENGTH}
              aria-label={t(K.countedLabel, { name: item.name })}
              placeholder={words.figure(fromMilli(item.qtyMilli))}
              value={text}
              onChange={(event) => setCount(sanitizeNumberText(event.target.value, 3))}
              onFocus={(event) => event.currentTarget.select()}
              className="text-body h-full w-full min-w-0 bg-transparent text-end font-medium tabular-nums outline-none"
              data-testid={`${testId}-count`}
            />
            <span className="text-muted-foreground ms-1.5 text-xs">
              {words.unit(item.unit)}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-label={t(K.same)}
            title={t(K.same)}
            onClick={() => setCount(String(fromMilli(item.qtyMilli)))}
            className="size-8 shrink-0 rounded-lg p-0 text-sm max-md:size-10"
            data-testid={`${testId}-same`}
          >
            ✓
          </Button>
        </div>
        {measured ? (
          <span className="text-micro text-muted-foreground tabular-nums">
            {measured}
          </span>
        ) : null}
      </div>
      <div role="cell" className="flex justify-end">
        <TonePill tone={pill.tone} data-testid={`${testId}-difference`}>
          <span className="tabular-nums">{pill.label}</span>
        </TonePill>
      </div>
    </div>
  );
}

/** One opening of Stock check: the counts, the category on and the save. */
function CheckSession({
  open,
  onClose,
  items,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly StockItemRow[];
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const form = useForm<CountFormValues>({ defaultValues: { counts: {} } });
  const counts = useWatch({ control: form.control, name: 'counts' }) ?? {};
  const shown = items.filter((item) => category === 'all' || item.category === category);
  const counted = items.filter((item) => (counts[item.id] ?? '') !== '').length;
  const changed = changedLines(items, counts);
  const saveCount = useSaveStockCount({ notifyOnError: false });

  const { saveState, save } = useDrawerSave<CountFormValues, StockCountResult>({
    form,
    fieldOrder: ['counts'],
    toastId: 'stock-check-save-failed',
    onField: () => undefined,
    write: () =>
      saveCount.mutateAsync({ lines: changedLines(items, form.getValues('counts')) }),
    onDone: ({ changed: updated }) => {
      notify.success(t(K.saved, { count: updated }));
      onClose();
    },
  });

  /** "Fill rest as matching": every uncounted row of the category on, at its system figure. */
  const fillRest = () => {
    for (const item of shown) {
      if ((counts[item.id] ?? '') === '') {
        form.setValue(`counts.${item.id}`, String(fromMilli(item.qtyMilli)), {
          shouldDirty: true,
        });
      }
    }
  };

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub)}
      hideSubOnPhone
      flushBody
      headerEnd={
        <span
          className="text-detail text-muted-foreground-strong tabular-nums"
          data-testid={`${testId}-counter`}
        >
          {t(K.counted, { counted, total: items.length })}
        </span>
      }
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.stock}
      summary={
        changed.length > 0 ? t(K.willChange, { count: changed.length }) : t(K.nothing)
      }
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      saveDisabled={changed.length === 0}
      notSavedLabel={t(K.failed)}
      testId={testId}
    >
      <div className="flex min-h-0 flex-col">
        <div className="border-b px-(--drawer-pad-x) py-3">
          <DrawerChips
            label={t(STOCK_DRAWER_KEYS.item.fields.category)}
            options={[
              { value: 'all' as const, label: t(K.allItems), tone: 'stone' as const },
              ...(Object.keys(STOCK_CATEGORY_TONES) as StockItemRow['category'][]).map(
                (value) => ({
                  value,
                  label: words.category(value).label,
                  tone: STOCK_CATEGORY_TONES[value],
                }),
              ),
            ]}
            value={category}
            onChange={(value) => setCategory(value ?? 'all')}
            // The chips wrap with "Fill rest as matching" pushed to the row's end (H:5298).
            trailing={
              <>
                <span aria-hidden="true" className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillRest}
                  className="h-7 rounded-md px-2.5 text-xs"
                  data-testid={`${testId}-fill-rest`}
                >
                  {t(K.fillRest)}
                </Button>
              </>
            }
            className="gap-2"
            testId={`${testId}-category`}
          />
        </div>
        <div role="table" aria-label={t(K.title)} className="flex flex-col">
          <div
            role="row"
            tabIndex={-1}
            className={cn(
              ROW_GRID,
              'bg-muted text-micro text-muted-foreground-strong sticky top-0 z-10 h-9 border-b py-0 font-semibold tracking-[0.04em] uppercase max-md:hidden',
            )}
          >
            <span role="columnheader" tabIndex={-1}>
              {t(K.heads.item)}
            </span>
            <span role="columnheader" tabIndex={-1}>
              {t(K.heads.inSystem)}
            </span>
            <span role="columnheader" tabIndex={-1}>
              {t(K.heads.counted)}
            </span>
            <span role="columnheader" tabIndex={-1} className="text-end">
              {t(K.heads.difference)}
            </span>
          </div>
          {shown.map((item) => (
            <CountRow key={item.id} item={item} form={form} testId={testId} />
          ))}
        </div>
      </div>
    </RecordDrawer>
  );
}

/** Props of {@link StockCheckDrawer}. */
export interface StockCheckDrawerProps {
  open: boolean;
  onClose: () => void;
  testId?: string;
}

/**
 * Stock check (KICKOFF §6.8; `clinic-stock.md:73–85, 159–172, 261–273`) — the
 * `items/check` route's drawer, 840px: "Type what is on the shelf. Only items
 * that differ are saved, each as an Adjust entry." with "2 of 10 counted" at
 * the header's end; the category chips ("All items" + the six) and "Fill rest
 * as matching"; then a row per item — what the system holds, the counted
 * figure (✓ copies the system's; "= 90 g" for an item with contents) and the
 * difference ("Not counted", "Matches", "+0.5 tube" sky, "−0.5 tube" blush).
 * Below `md` each item is a 2 × 2 card. "Save count" waits for a count that
 * differs (`saveStockCount`, `S:1690`) — "Stock check saved · 1 item updated";
 * a failed save keeps the counts ("Not saved · your counts are kept").
 */
export function StockCheckDrawer({
  open,
  onClose,
  testId = STOCK_DRAWER_TEST_IDS.check,
}: StockCheckDrawerProps) {
  const { session } = useDrawerSession(open);
  const items = useStockItemCatalogue().data ?? [];
  return (
    <CheckSession
      key={session}
      open={open}
      onClose={onClose}
      items={items}
      testId={testId}
    />
  );
}
