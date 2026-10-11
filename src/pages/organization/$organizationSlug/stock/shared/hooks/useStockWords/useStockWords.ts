import { useTranslation } from 'react-i18next';

import type {
  MeasureUnit,
  StockCategory,
  StockUnit,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { STOCK_KEYS, STOCK_NS } from '../../../stock.constants.ts';
import type { StockItemRecord, StockMovementRow } from '../../stock-contracts.ts';
import {
  fromMilli,
  measuredQuantity,
  type Runway,
  runwayOf,
  runwayTone,
  STOCK_CATEGORY_TONES,
  STOCK_LEVEL_TONES,
  STOCK_MOVEMENT_TONES,
  STOCK_PURCHASE_STATUS_TONES,
  type StockMovementKind,
  type StockPurchaseStatus,
} from '../../stock-units.ts';

/** What a quantity is measured against: the item's unit and its contents. */
export type StockMeasure = Pick<StockItemRecord, 'unit' | 'sizePerUnit' | 'measureUnit'>;

/** A word and its tone — a pill's. */
export interface StockLabel {
  label: string;
  tone: Tone | null;
}

/**
 * The Clinic stock words (KICKOFF §6.8; `clinic-stock.md:29–71`) every tab,
 * popover and drawer shares: "3 tube · 90 g", "3 tube · 90 g · OK" (the
 * server's level), "per tube of 30 g · uses ~0.5/week", "~6 weeks", the
 * categories, statuses and movement types in their tones, a movement's change
 * ("− 1 tube") and money as clinozy-be sends it — rupees ("₹1,710"). Figures
 * keep up to two decimals in the viewer's locale.
 */
export function useStockWords() {
  const { t } = useTranslation(STOCK_NS);
  const { formatNumber, formatDate } = useLocaleFormat();
  const formatRupees = useRupeeFormat();
  const clock = useAppClock();
  const figure = (value: number) => formatNumber(value, { maximumFractionDigits: 2 });
  const unit = (value: StockUnit) => t(STOCK_KEYS.units[value]);
  const measure = (value: MeasureUnit) => t(STOCK_KEYS.measures[value]);
  const amount = (value: number, label: string) =>
    t(STOCK_KEYS.quantity.amount, { value: figure(value), unit: label });

  /** A stock in units — and in the measure for an item with contents: "3 tube · 90 g". */
  const quantity = (item: StockMeasure, qtyMilli: number) => {
    const units = amount(fromMilli(qtyMilli), unit(item.unit));
    const measured = measuredQuantity(qtyMilli, item.sizePerUnit);
    if (measured === null || item.measureUnit === null) return units;
    return t(STOCK_KEYS.quantity.measured, {
      units,
      measure: amount(measured, measure(item.measureUnit)),
    });
  };

  /** "~6 weeks", "~5 days", "No usage". */
  const runwayLabel = (runway: Runway) => {
    if (runway.kind === 'days') return t(STOCK_KEYS.runway.days, { count: runway.count });
    if (runway.kind === 'weeks')
      return t(STOCK_KEYS.runway.weeks, { count: runway.count });
    return t(STOCK_KEYS.runway.none);
  };

  return {
    t,
    /** Rupees as clinozy-be sends them: "₹1,710", "₹92.50". */
    formatRupees,
    figure,
    unit,
    measure,
    /** A figure with its label: "1.5 tube", "30 g". */
    amount,
    /** A stock in units alone: "6 tube" — the toasts' "… left". */
    units: (item: Pick<StockItemRecord, 'unit'>, qtyMilli: number) =>
      amount(fromMilli(qtyMilli), unit(item.unit)),
    quantity,
    category: (value: StockCategory): StockLabel => ({
      label: t(STOCK_KEYS.categories[value]),
      tone: STOCK_CATEGORY_TONES[value],
    }),
    /** The Stock cell's line and the server's level: "3 tube · 90 g · OK" in sage. */
    stock: (item: StockMeasure & Pick<StockItemRecord, 'qtyMilli' | 'level'>) => {
      const { level } = item;
      return {
        level,
        tone: STOCK_LEVEL_TONES[level],
        label: t(STOCK_KEYS.items.stockLine, {
          quantity: quantity(item, item.qtyMilli),
          level: t(STOCK_KEYS.levels[level]),
        }),
      };
    },
    /** The Item cell's sub line: "per tube of 30 g · uses ~0.5/week". */
    itemSub: (item: StockMeasure & Pick<StockItemRecord, 'usagePerWeekMilli'>) => {
      const usage = figure(fromMilli(item.usagePerWeekMilli));
      if (item.sizePerUnit && item.measureUnit) {
        return t(STOCK_KEYS.items.subContents, {
          unit: unit(item.unit),
          contents: amount(fromMilli(item.sizePerUnit), measure(item.measureUnit)),
          usage,
        });
      }
      return t(STOCK_KEYS.items.sub, { unit: unit(item.unit), usage });
    },
    /** The Lasts pill for the server's runway: "~6 weeks", "~5 days" or "No usage", in its tone. */
    runway: (days: number | null): StockLabel => ({
      label: runwayLabel(runwayOf(days)),
      tone: runwayTone(days),
    }),
    /**
     * A movement's "When" by the rooms' one time rule, days alone: "11:05 am"
     * today, else "Yesterday", "Mon", "25 Sep".
     */
    when: (instant: string) => clock.moment(instant, { withTime: false }),
    /** A calendar date by the same rule: "Today", "Yesterday", "Mon", "25 Sep". */
    day: (date: string) => clock.day(date),
    /** A bill's date with its year: "22 Sep 2026" (`clinic-stock.md:45`). */
    billDate: (date: string) =>
      formatDate(
        localDateOf(date),
        { day: 'numeric', month: 'short', year: 'numeric' },
        { civilDay: true },
      ),
    status: (value: StockPurchaseStatus): StockLabel => ({
      label: t(STOCK_KEYS.purchases.statuses[value]),
      tone: STOCK_PURCHASE_STATUS_TONES[value],
    }),
    movementType: (value: StockMovementKind): StockLabel => ({
      label: t(STOCK_KEYS.movements.types[value]),
      tone: STOCK_MOVEMENT_TONES[value],
    }),
    /**
     * A Movements row's change: "− 1 tube", "+ 24 bottle" — the bare figure once
     * its item is deleted (its unit is gone with it).
     */
    change: (row: Pick<StockMovementRow, 'deltaMilli' | 'item'>) => {
      const size = fromMilli(Math.abs(row.deltaMilli));
      const units = row.item ? amount(size, unit(row.item.unit)) : figure(size);
      if (row.deltaMilli === 0) return units;
      return t(STOCK_KEYS.movements.change, {
        sign: row.deltaMilli > 0 ? '+' : '−',
        amount: units,
      });
    },
  };
}
