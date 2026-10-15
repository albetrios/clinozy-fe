import { type KeyboardEvent, type ReactNode, useId, useState } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { ItemsCellBinding } from '@/shared/forms/ItemsField/index.ts';
import { type AppIcon, Moon, Sun, Sunrise } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  RX_DAY_CHIPS,
  RX_MORE_TIMINGS,
  RX_MOUTH_WHEN,
  RX_PLACES,
  RX_SKIN_WHEN,
  RX_TOP_PLACES,
  rxDoseOf,
  rxDoubledDose,
  rxIsDoubled,
  rxToggledDose,
  rxTypedDays,
  typedText,
} from './rx-form.ts';
import { useRxLabels } from './use-rx-labels.ts';

const K = RX_KEYS;

/*
 * The medicine line's chips (change-prescription-one-click): every everyday
 * choice is one visible click — no dropdown to open first. A second click on
 * a lit chip clears it. Each group is one Tab stop; the arrow keys move
 * within it (mirrored right to left). On a touch screen the chips are 44px.
 */

/**
 * A chip: 30px (44px on touch), lit in its tone. Its pill shape sits beside
 * its `data-slot="pill"` (the Sharp shape squares it) and its focus ring is
 * the theme's (`data-focus` on any slot).
 */
const CHIP_CLASS =
  'inline-flex h-7.5 flex-none touch-manipulation items-center gap-1 border px-2.75 text-xs whitespace-nowrap tabular-nums transition-[background-color,border-color,color,box-shadow] duration-150 outline-none focus-visible:outline-hidden disabled:pointer-events-none motion-reduce:transition-none pointer-coarse:h-11 pointer-coarse:px-3.5 pointer-coarse:text-sm';

/** A group's small-caps label. */
const GROUP_LABEL_CLASS =
  'text-micro text-muted-foreground me-0.5 font-semibold tracking-[0.05em] whitespace-nowrap uppercase';

/** The three times of day, with their marks. */
const TIMES: readonly { time: 'morning' | 'afternoon' | 'night'; icon: AppIcon }[] = [
  { time: 'morning', icon: Sunrise },
  { time: 'afternoon', icon: Sun },
  { time: 'night', icon: Moon },
];

/** One chip as a group draws it. */
interface ChipItem {
  key: string;
  label: ReactNode;
  /** Spoken in full when the label is short ("5" → "5 days"). */
  ariaLabel?: string;
  title?: string;
  on: boolean;
  tone: Tone;
  icon?: AppIcon;
  onPress: () => void;
  testId: string;
}

/** The arrow keys' step within a group, mirrored right to left. */
function arrowStep(key: string, rtl: boolean): number {
  if (key === 'ArrowRight') return rtl ? -1 : 1;
  if (key === 'ArrowLeft') return rtl ? 1 : -1;
  return 0;
}

/** Arrow keys, Home and End move between a group's chips. */
function moveWithin(event: KeyboardEvent<HTMLElement>) {
  const chips = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-chip]'),
  ].filter((chip) => !chip.disabled);
  const at = chips.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  const step = arrowStep(
    event.key,
    getComputedStyle(event.currentTarget).direction === 'rtl',
  );
  let next: number | null = null;
  if (step !== 0) next = (at + step + chips.length) % chips.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = chips.length - 1;
  if (next === null) return;
  event.preventDefault();
  chips[next]?.focus();
}

/** One chip: a toggle button, lit in its tone. */
function Chip({
  item,
  readOnly,
  tabbable,
}: {
  item: ChipItem;
  readOnly: boolean;
  tabbable: boolean;
}) {
  const Icon = item.icon;
  const tone = TONE_CLASSES[item.tone];
  return (
    <button
      type="button"
      data-chip=""
      aria-pressed={item.on}
      aria-label={item.ariaLabel}
      title={item.title}
      disabled={readOnly}
      tabIndex={tabbable ? 0 : -1}
      onClick={item.onPress}
      data-testid={item.testId}
      data-slot="pill"
      className={cn(
        'rounded-full',
        CHIP_CLASS,
        item.on
          ? cn(tone.surface, tone.border, 'font-semibold')
          : 'bg-background text-foreground-soft hover:border-disabled hover:text-foreground',
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 flex-none" /> : null}
      {item.label}
    </button>
  );
}

/**
 * A labelled group of chips — an ARIA toolbar: one Tab stop (its lit chip,
 * else its first) and the arrow keys within it. Read only, it shows its lit
 * chips alone.
 */
function ChipGroup({
  label,
  items,
  readOnly,
  testId,
  after,
  showLabel = true,
}: {
  label: string;
  items: readonly ChipItem[];
  readOnly: boolean;
  testId: string;
  /** After the chips: the Days box, "+ more". */
  after?: ReactNode;
  showLabel?: boolean;
}) {
  const shown = readOnly ? items.filter((item) => item.on) : items;
  if (readOnly && shown.length === 0) return null;
  const stop = Math.max(
    0,
    shown.findIndex((item) => item.on),
  );
  return (
    <div
      // A toolbar: one Tab stop, the arrow keys between its chips (WAI-ARIA toolbar pattern).
      role="toolbar"
      aria-label={label}
      data-testid={testId}
      onKeyDown={moveWithin}
      className="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      {showLabel ? (
        <span aria-hidden="true" className={GROUP_LABEL_CLASS}>
          {label}
        </span>
      ) : null}
      {shown.map((item, index) => (
        <Chip key={item.key} item={item} readOnly={readOnly} tabbable={index === stop} />
      ))}
      {readOnly ? null : after}
    </div>
  );
}

/** Props of the row's chip cells: the binding, and view only. */
interface RxCellProps<TForm extends FieldValues> extends ItemsCellBinding<TForm> {
  readOnly?: boolean;
}

/** The Dose chips of one value: the three times, ×2 once a time is lit, SOS. */
function useDoseChips(value: string, emit: (next: string) => void, testId: string) {
  const { t } = useTranslation(RX_NS);
  const sos = value === 'sos';
  const dose = rxDoseOf(value);
  const taps = Array.isArray(dose) ? dose : [0, 0, 0];
  const items: ChipItem[] = TIMES.map(({ time, icon }, index) => {
    const count = taps[index] ?? 0;
    const word = t(K.dose.times[time]);
    const on = !sos && count > 0;
    return {
      key: time,
      label: on && count > 2 ? `${word} · ${count}` : word,
      ariaLabel: `${word} · ${count}`,
      title: on
        ? t(K.dose.on, { time: word, taps: count })
        : t(K.dose.off, { time: word }),
      on,
      tone: 'sage',
      icon,
      onPress: () => emit(rxToggledDose(value, index)),
      testId: `${testId}-${time}`,
    };
  });
  if (!sos && taps.some((tap) => tap > 0)) {
    items.push({
      key: 'double',
      label: t(K.dose.double),
      ariaLabel: t(K.dose.doubleHint),
      title: t(K.dose.doubleHint),
      on: rxIsDoubled(value),
      tone: 'sage',
      onPress: () => emit(rxDoubledDose(value)),
      testId: `${testId}-double`,
    });
  }
  items.push({
    key: 'sos',
    label: t(K.dose.sos),
    title: t(K.dose.sosHint),
    on: sos,
    tone: 'butter',
    onPress: () => emit(sos ? '' : 'sos'),
    testId: `${testId}-sos`,
  });
  return items;
}

/**
 * "Dose" (change-prescription-one-click D4): Morning · Afternoon · Night —
 * one click on, one click off — then ×2 (two tablets at each lit time) and
 * SOS (butter), which stands in for the times. A count above two reads on its
 * time ("Morning · 3").
 */
export function RxDoseCell<TForm extends FieldValues>({
  control,
  name,
  testId,
  readOnly = false,
  onValue,
}: RxCellProps<TForm> & { onValue?: (dose: string) => void }) {
  const { t } = useTranslation(RX_NS);
  const { field } = useController({ control, name });
  const value = String(field.value ?? '');
  const items = useDoseChips(
    value,
    (next) => {
      field.onChange(next);
      onValue?.(next);
    },
    testId,
  );
  return (
    <ChipGroup
      label={t(K.dose.group)}
      items={items}
      readOnly={readOnly}
      testId={testId}
      showLabel={false}
    />
  );
}

/**
 * "Days" (D6): the usual courses as chips and a number box for any other —
 * it shows a course the chips lack. A change hands the days back so the
 * row's quantity follows (days × doses a day).
 */
function DaysGroup({
  days,
  onDays,
  readOnly,
  testId,
}: {
  days: number | null;
  onDays: (days: number | null) => void;
  readOnly: boolean;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const listed = days !== null && (RX_DAY_CHIPS as readonly number[]).includes(days);
  const other = listed || days === null ? '' : String(days);
  const items: ChipItem[] = RX_DAY_CHIPS.map((count) => ({
    key: String(count),
    label: String(count),
    ariaLabel: t(K.daysNote, { count }),
    on: days === count,
    tone: 'sky',
    onPress: () => onDays(days === count ? null : count),
    testId: `${testId}-${count}`,
  }));
  if (readOnly && other) {
    items.push({
      key: 'other',
      label: other,
      ariaLabel: t(K.daysNote, { count: days ?? 0 }),
      on: true,
      tone: 'sky',
      onPress: () => undefined,
      testId: `${testId}-other-value`,
    });
  }
  return (
    <ChipGroup
      label={t(K.items.days)}
      items={items}
      readOnly={readOnly}
      testId={testId}
      after={
        <>
          <label htmlFor={inputId} className="sr-only">
            {t(K.items.otherDays)}
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={draft ?? other}
            placeholder={t(K.items.otherDaysShort)}
            onChange={(event) => {
              const text = event.target.value.replace(/\D/g, '');
              setDraft(text);
              onDays(text === '' ? null : rxTypedDays(text));
            }}
            onBlur={() => setDraft(null)}
            data-testid={`${testId}-other`}
            data-slot="pill"
            className={cn(
              'rounded-full',
              CHIP_CLASS,
              'placeholder:text-muted-foreground w-15 text-center pointer-coarse:w-20',
              other
                ? cn(TONE_CLASSES.sky.surface, TONE_CLASSES.sky.border, 'font-semibold')
                : 'bg-background border-dashed',
            )}
          />
        </>
      }
    />
  );
}

/** The meal's and the timings' tones: before butter, after sky, the rest lav. */
function whenTone(value: string): Tone {
  if (value === 'before') return 'butter';
  if (value === 'after') return 'sky';
  return 'lav';
}

/** A timing the row can hold: the meal, one of the contract's `rx_timing`, or typed. */
const isWhen = (value: string) =>
  value === 'before' ||
  value === 'after' ||
  typedText(value) !== null ||
  (RX_MORE_TIMINGS as readonly string[]).includes(value);

/** A chip's test-id part: the value, or `typed` for a typed one. */
const chipPart = (key: string) => (typedText(key) === null ? key : 'typed');

/**
 * "When" (D5): for a tablet the meal — before, after, an empty stomach, with
 * food; for a skin medicine the time of day and how often. A value the list
 * lacks (a typed timing, another of the contract's) shows lit before them.
 */
function WhenGroup({
  value,
  skin,
  onWhen,
  readOnly,
  testId,
}: {
  value: string;
  skin: boolean;
  onWhen: (value: string) => void;
  readOnly: boolean;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const listed: readonly string[] = skin ? RX_SKIN_WHEN : RX_MOUTH_WHEN;
  const extra = value && !listed.includes(value) && isWhen(value) ? [value] : [];
  const items: ChipItem[] = [...extra, ...listed].map((key) => ({
    key,
    label: labels.when(key),
    on: value === key,
    tone: whenTone(key),
    onPress: () => onWhen(value === key ? '' : key),
    testId: `${testId}-${chipPart(key)}`,
  }));
  return (
    <ChipGroup
      label={t(K.items.when)}
      items={items}
      readOnly={readOnly}
      testId={testId}
    />
  );
}

/**
 * "Where" (D5): the five usual places, then "+ N more" opening the others in
 * place — no list to scroll. A typed place, or one beyond the five while
 * they are closed, shows lit before them.
 */
function WhereGroup({
  value,
  onWhere,
  readOnly,
  testId,
}: {
  value: string;
  onWhere: (value: string) => void;
  readOnly: boolean;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const [open, setOpen] = useState(false);
  const top: readonly string[] = RX_TOP_PLACES;
  const rest = RX_PLACES.map((place) => place.key as string).filter(
    (key) => !top.includes(key),
  );
  const shownLater = open && rest.includes(value);
  const lead = value && !top.includes(value) && !shownLater ? [value] : [];
  const keys = [...lead, ...top, ...(open ? rest : [])];
  const items: ChipItem[] = keys.map((key) => ({
    key,
    label: labels.where(key),
    on: value === key,
    tone: 'mint',
    onPress: () => onWhere(value === key ? '' : key),
    testId: `${testId}-${chipPart(key)}`,
  }));
  return (
    <ChipGroup
      label={t(K.items.where)}
      items={items}
      readOnly={readOnly}
      testId={testId}
      after={
        <button
          type="button"
          // Reached with the arrow keys, as the chips are: the group keeps one Tab stop.
          data-chip=""
          tabIndex={-1}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          data-testid={`${testId}-more`}
          data-slot="button"
          className="text-caption text-muted-foreground hover:text-foreground rounded-md px-1.5 py-1 font-medium outline-none focus-visible:outline-hidden pointer-coarse:min-h-11"
        >
          {open ? t(K.items.fewerPlaces) : t(K.items.morePlaces, { count: rest.length })}
        </button>
      }
    />
  );
}

/** Props of {@link RxLineRail}: what the rail reads and writes of its row. */
export interface RxLineRailProps {
  days: number | null;
  when: string;
  where: string;
  /** The medicine is put on the skin: its timings, and Where (D5). */
  skin: boolean;
  readOnly: boolean;
  onDays: (days: number | null) => void;
  onWhen: (value: string) => void;
  onWhere: (value: string) => void;
  /** `rx-items`; the groups derive `-days`, `-when`, `-where`. */
  testId: string;
}

/**
 * The line's second row (change-prescription-one-click D3): Days · When ·
 * Where, each a chip group — how long, when and where at one glance, each
 * change one click. Where shows for a skin medicine, or once a place is set.
 */
export function RxLineRail({
  days,
  when,
  where,
  skin,
  readOnly,
  onDays,
  onWhen,
  onWhere,
  testId,
}: RxLineRailProps) {
  return (
    <div
      data-testid={`${testId}-rail`}
      className="flex flex-wrap items-center gap-x-5 gap-y-2"
    >
      <DaysGroup
        days={days}
        onDays={onDays}
        readOnly={readOnly}
        testId={`${testId}-days`}
      />
      <WhenGroup
        value={when}
        skin={skin}
        onWhen={onWhen}
        readOnly={readOnly}
        testId={`${testId}-when`}
      />
      {skin || where ? (
        <WhereGroup
          value={where}
          onWhere={onWhere}
          readOnly={readOnly}
          testId={`${testId}-where`}
        />
      ) : null}
    </div>
  );
}

/**
 * "Same days for all" (D6): above the lines once two medicines are written —
 * one click puts every line on the same course; lit when they already share it.
 */
export function RxAllDays({
  days,
  onDays,
  testId,
}: {
  /** The course every written line shares, or null. */
  days: number | null;
  onDays: (days: number) => void;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const items: ChipItem[] = RX_DAY_CHIPS.map((count) => ({
    key: String(count),
    label: t(K.daysNote, { count }),
    on: days === count,
    tone: 'sky',
    onPress: () => onDays(count),
    testId: `${testId}-${count}`,
  }));
  return (
    <div className="bg-canvas rounded-lg border border-dashed px-3 py-2">
      <ChipGroup
        label={t(K.allDays.label)}
        items={items}
        readOnly={false}
        testId={testId}
      />
    </div>
  );
}
