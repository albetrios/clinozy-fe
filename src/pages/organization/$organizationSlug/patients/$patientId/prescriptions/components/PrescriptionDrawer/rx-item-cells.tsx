import { type KeyboardEvent, type ReactNode, useId, useState } from 'react';
import { type FieldValues, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import type { ItemsCellBinding } from '@/shared/forms/ItemsField/index.ts';
import { MessageSquare, MoreHorizontal } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  RX_DAY_CHIPS,
  RX_MEAL_PICKS,
  RX_MORE_TIMINGS,
  RX_MOUTH_WHEN,
  RX_PLACE_PICKS,
  RX_PLACES,
  RX_SKIN_WHEN,
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
 * The medicine line's trays (change-prescription-compact-line D3,
 * change-prescription-one-line): every everyday choice is one click on a
 * small segment — no dropdown to open first. A second click on a lit segment
 * clears it. The rarer choices wait behind one More segment, which shows
 * what was chosen there. Each tray is one Tab stop; the arrow keys move
 * within it (mirrored right to left).
 */

/**
 * A tray: a `muted` track holding its segments 2px apart — the app's own
 * segmented pattern (the GST rate toggle). It wraps inside itself on a narrow
 * screen, and nothing clips a segment's focus ring.
 */
const TRAY_CLASS =
  'bg-muted inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md p-0.5';

/**
 * A segment: 24px (44px high, 36px wide on touch), 12px digits and words, lit
 * in its tone and raised. Its focus ring is the theme's (`data-focus` on any
 * slot), lifted over its neighbours.
 */
const SEGMENT_CLASS =
  'relative inline-flex h-6 min-w-6 flex-none touch-manipulation items-center justify-center rounded-sm px-1.5 text-xs whitespace-nowrap tabular-nums transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:z-10 focus-visible:outline-hidden disabled:pointer-events-none motion-reduce:transition-none pointer-coarse:h-11 pointer-coarse:min-w-9 pointer-coarse:px-2.5 pointer-coarse:text-sm';

/** An unlit segment: quiet ink, a hint of the lit surface on hover. */
const SEGMENT_OFF_CLASS =
  'text-muted-foreground-strong hover:bg-background/70 hover:text-foreground disabled:text-disabled';

/**
 * A tray's small-caps name, before it on the line under the medicine (or in
 * More) — at least 40px, so the trays start in one column.
 */
const TRAY_LABEL_CLASS =
  'text-micro text-muted-foreground min-w-10 font-semibold tracking-[0.05em] whitespace-nowrap uppercase';

/** One segment as a tray draws it. */
interface SegmentItem {
  key: string;
  label: ReactNode;
  /** Spoken in full when the label is short ("5" → "5 days"). */
  ariaLabel?: string;
  title?: string;
  on: boolean;
  tone: Tone;
  onPress: () => void;
  testId: string;
  /** Shown but not pressable now. */
  disabled?: boolean;
  /** Its ink is faint while it is off (a dose's 0). */
  faint?: boolean;
  /** A hairline before it: the dose's SOS after the three times. */
  split?: boolean;
  /** Shown on a read-only line even when off (the dose's `1 0 1`). */
  keepWhenRead?: boolean;
  /** A number: 4px a side with a mouse, so a line of them stays narrow. */
  tight?: boolean;
}

/** The arrow keys' step within a tray, mirrored right to left. */
function arrowStep(key: string, rtl: boolean): number {
  if (key === 'ArrowRight') return rtl ? -1 : 1;
  if (key === 'ArrowLeft') return rtl ? 1 : -1;
  return 0;
}

/** Arrow keys, Home and End move between a tray's segments. */
function moveWithin(event: KeyboardEvent<HTMLElement>) {
  const segments = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-segment]'),
  ].filter((segment) => !segment.disabled);
  const at = segments.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  const step = arrowStep(
    event.key,
    getComputedStyle(event.currentTarget).direction === 'rtl',
  );
  let next: number | null = null;
  if (step !== 0) next = (at + step + segments.length) % segments.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = segments.length - 1;
  if (next === null) return;
  event.preventDefault();
  segments[next]?.focus();
}

/** One segment: a toggle button, lit in its tone. */
function Segment({
  item,
  readOnly,
  tabbable,
}: {
  item: SegmentItem;
  readOnly: boolean;
  tabbable: boolean;
}) {
  const tone = TONE_CLASSES[item.tone];
  return (
    <>
      {item.split ? (
        <span aria-hidden="true" className="bg-border mx-0.5 h-3.5 w-px flex-none" />
      ) : null}
      <button
        type="button"
        data-segment=""
        aria-pressed={item.on}
        aria-label={item.ariaLabel}
        title={item.title}
        disabled={readOnly || item.disabled}
        tabIndex={tabbable ? 0 : -1}
        onClick={item.onPress}
        data-testid={item.testId}
        data-slot="segment"
        className={cn(
          SEGMENT_CLASS,
          item.tight && 'px-1',
          item.on
            ? cn(tone.surface, 'font-semibold shadow-xs')
            : cn(SEGMENT_OFF_CLASS, item.faint && 'text-disabled'),
        )}
      >
        {item.label}
      </button>
    </>
  );
}

/** The segment that takes the tray's Tab stop: the first lit one, else the first. */
function tabStopOf(items: readonly SegmentItem[]): number {
  const lit = items.findIndex((item) => item.on && !item.disabled);
  if (lit >= 0) return lit;
  return Math.max(
    0,
    items.findIndex((item) => !item.disabled),
  );
}

/**
 * A tray of segments — an ARIA toolbar: one Tab stop and the arrow keys
 * within it — with its small-caps name before it when `showLabel`. Read
 * only, it shows its lit segments alone (and those kept for reading).
 */
function Tray({
  label,
  items,
  readOnly,
  testId,
  after,
  showLabel = true,
  nowrap = false,
}: {
  label: string;
  items: readonly SegmentItem[];
  readOnly: boolean;
  testId: string;
  /** Inside the tray, after its segments: the Days box, More. */
  after?: ReactNode;
  showLabel?: boolean;
  /** One row, whatever its width: More's words shorten instead (Meal · Where). */
  nowrap?: boolean;
}) {
  const shown = readOnly ? items.filter((item) => item.on || item.keepWhenRead) : items;
  if (readOnly && shown.length === 0) return null;
  const stop = tabStopOf(shown);
  return (
    // The tray goes under its name when the two do not fit side by side (a phone).
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {showLabel ? (
        <span aria-hidden="true" className={TRAY_LABEL_CLASS}>
          {label}
        </span>
      ) : null}
      <div
        // A toolbar: one Tab stop, the arrow keys between its segments (WAI-ARIA toolbar pattern).
        role="toolbar"
        aria-label={label}
        data-testid={testId}
        onKeyDown={moveWithin}
        className={cn(TRAY_CLASS, nowrap && 'flex-nowrap')}
      >
        {shown.map((item, index) => (
          <Segment
            key={item.key}
            item={item}
            readOnly={readOnly}
            tabbable={index === stop}
          />
        ))}
        {readOnly ? null : after}
      </div>
    </div>
  );
}

/** Props of the row's tray cells: the binding, and view only. */
interface RxCellProps<TForm extends FieldValues> extends ItemsCellBinding<TForm> {
  readOnly?: boolean;
}

const TIMES = ['morning', 'afternoon', 'night'] as const;

/**
 * The Dose segments of one value: the three times as their counts
 * (`1 0 1`), a hairline, then SOS. Two tablets at each time (×2) is in More
 * (change-prescription-one-line D5).
 */
function useDoseItems(value: string, emit: (next: string) => void, testId: string) {
  const { t } = useTranslation(RX_NS);
  const sos = value === 'sos';
  const dose = rxDoseOf(value);
  const taps = Array.isArray(dose) ? dose : [0, 0, 0];
  const items: SegmentItem[] = TIMES.map((time, index) => {
    const count = taps[index] ?? 0;
    const word = t(K.dose.times[time]);
    const on = !sos && count > 0;
    return {
      key: time,
      // Under SOS the times stand down: a dot, as on the earlier table.
      label: sos ? '·' : String(count),
      ariaLabel: `${word} · ${count}`,
      title: on
        ? t(K.dose.on, { time: word, taps: count })
        : t(K.dose.off, { time: word }),
      on,
      tone: 'sage',
      faint: true,
      tight: true,
      keepWhenRead: !sos,
      onPress: () => emit(rxToggledDose(value, index)),
      testId: `${testId}-${time}`,
    };
  });
  items.push({
    key: 'sos',
    label: t(K.dose.sos),
    title: t(K.dose.sosHint),
    on: sos,
    tone: 'butter',
    split: true,
    onPress: () => emit(sos ? '' : 'sos'),
    testId: `${testId}-sos`,
  });
  return items;
}

/**
 * "Dose · M A N" (change-prescription-compact-line D4): the morning,
 * afternoon and night taps read as the dose itself — `1 0 1`, one click on,
 * one click off — then SOS (butter), which stands in for the times.
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
  const items = useDoseItems(
    value,
    (next) => {
      field.onChange(next);
      onValue?.(next);
    },
    testId,
  );
  return (
    <Tray
      label={t(K.dose.group)}
      items={items}
      readOnly={readOnly}
      testId={testId}
      showLabel={false}
    />
  );
}

/** Props of {@link RxDaysTray}. */
export interface RxDaysTrayProps {
  days: number | null;
  onDays: (days: number | null) => void;
  readOnly: boolean;
  testId: string;
  /** Its "Days" name before it — on the line under the medicine, not under the column's header. */
  showLabel?: boolean;
}

/**
 * "Days" (change-prescription-compact-line D5): the usual courses as
 * segments and a number box for any other — it shows a course the segments
 * lack. A change hands the days back so the row's quantity follows (days ×
 * doses a day). A column of the line where the table has room, else the
 * first tray under it.
 */
export function RxDaysTray({
  days,
  onDays,
  readOnly,
  testId,
  showLabel = true,
}: RxDaysTrayProps) {
  const { t } = useTranslation(RX_NS);
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const listed = days !== null && (RX_DAY_CHIPS as readonly number[]).includes(days);
  const other = listed || days === null ? '' : String(days);
  const items: SegmentItem[] = RX_DAY_CHIPS.map((count) => ({
    key: String(count),
    label: String(count),
    ariaLabel: t(K.daysNote, { count }),
    on: days === count,
    tone: 'sky',
    tight: true,
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
    <Tray
      label={t(K.items.days)}
      items={items}
      readOnly={readOnly}
      testId={testId}
      showLabel={showLabel}
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
            data-slot="segment"
            className={cn(
              SEGMENT_CLASS,
              'placeholder:text-muted-foreground w-10 px-0.5 text-center pointer-coarse:w-14 pointer-coarse:px-1',
              other
                ? cn(TONE_CLASSES.sky.surface, 'font-semibold shadow-xs')
                : 'bg-background/60 text-foreground',
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

/** A segment's test-id part: the value, or `typed` for a typed one. */
const segmentPart = (key: string) => (typedText(key) === null ? key : 'typed');

/**
 * Every Meal timing (a tablet: before, after, an empty stomach, with food) or
 * every When timing (a skin medicine: the time of day and how often) — in
 * More. A value the list lacks (a typed timing, another of the contract's)
 * shows lit before them.
 */
function WhenTray({
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
  const items: SegmentItem[] = [...extra, ...listed].map((key) => ({
    key,
    label: labels.when(key),
    on: value === key,
    tone: whenTone(key),
    onPress: () => onWhen(value === key ? '' : key),
    testId: `${testId}-${segmentPart(key)}`,
  }));
  return (
    <Tray
      label={skin ? t(K.items.when) : t(K.items.meal)}
      items={items}
      readOnly={readOnly}
      testId={testId}
    />
  );
}

/**
 * Every place, in More — no list to scroll. A typed place shows lit before
 * them.
 */
function WhereTray({
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
  const places = RX_PLACES.map((place) => place.key as string);
  const keys = value && !places.includes(value) ? [value, ...places] : places;
  const items: SegmentItem[] = keys.map((key) => ({
    key,
    label: labels.where(key),
    on: value === key,
    tone: 'mint',
    onPress: () => onWhere(value === key ? '' : key),
    testId: `${testId}-${segmentPart(key)}`,
  }));
  return (
    <Tray label={t(K.items.where)} items={items} readOnly={readOnly} testId={testId} />
  );
}

/** The two picks on a line: a tablet's meal, a skin medicine's places (D3). */
const picksFor = (skin: boolean): readonly string[] =>
  skin ? RX_PLACE_PICKS : RX_MEAL_PICKS;

/** What a line reads and writes of its Meal · Where column and of More. */
interface RxDirectionsLine {
  medicineName: string;
  dose: string;
  when: string;
  where: string;
  remarks: string;
}

/** Props of {@link RxDirectionsCell}. */
export interface RxDirectionsCellProps {
  line: RxDirectionsLine;
  /** The medicine is put on the skin: places on the line, its timings in More. */
  skin: boolean;
  readOnly: boolean;
  onWhen: (value: string) => void;
  onWhere: (value: string) => void;
  onDose: (dose: string) => void;
  onNote: (note: string) => void;
  /** The column's tray (`rx-items-directions`): its picks `-<value>`, More `-more`. */
  testId: string;
  /** More's own trays and field: `<prefix>-when`, `-where`, `-dose-double`, `-remarks`. */
  panelTestId: string;
  /** Its "Meal" / "Where" name before it — on the line under the medicine, not under the column's header. */
  showLabel?: boolean;
}

/**
 * What More holds that is set, as the words the line shows on it: a timing
 * or a place beyond the two picks, and ×2.
 */
function useHiddenChoices(line: RxDirectionsLine, skin: boolean): string[] {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const choices: string[] = [];
  const picks = picksFor(skin);
  const onLine = skin ? line.where : line.when;
  if (onLine && !picks.includes(onLine)) {
    choices.push(skin ? labels.where(onLine) : labels.when(onLine));
  }
  const inMore = skin ? line.when : line.where;
  if (inMore) choices.push(skin ? labels.when(inMore) : labels.where(inMore));
  if (rxIsDoubled(line.dose)) choices.push(t(K.dose.double));
  return choices;
}

/** The note in More: a plain field — its words show under the line once written. */
function NoteField({
  value,
  onNote,
  readOnly,
  testId,
}: {
  value: string;
  onNote: (note: string) => void;
  readOnly: boolean;
  testId: string;
}) {
  const { t } = useTranslation(RX_NS);
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={TRAY_LABEL_CLASS}>
        {t(K.items.remarks)}
      </label>
      <Input
        id={inputId}
        value={value}
        maxLength={200}
        placeholder={t(K.items.note)}
        readOnly={readOnly}
        onChange={(event) => onNote(event.target.value)}
        data-testid={testId}
        className="text-detail h-8 pointer-coarse:h-11"
      />
    </div>
  );
}

/**
 * More (change-prescription-one-line D4): the line's last segment opens its
 * rarer choices — every Meal or When timing, every place, ×2 and the note.
 * Once one is set the segment shows it, lit (its words, "+ n" for more), so
 * nothing chosen is out of sight.
 */
function MoreSegment({
  line,
  skin,
  readOnly,
  onWhen,
  onWhere,
  onDose,
  onNote,
  testId,
  panelTestId,
}: Omit<RxDirectionsCellProps, 'showLabel'>) {
  const { t } = useTranslation(RX_NS);
  const hidden = useHiddenChoices(line, skin);
  const sos = line.dose === 'sos';
  const dose = rxDoseOf(line.dose);
  const lit = !sos && Array.isArray(dose) && dose.some((tap) => tap > 0);
  const said =
    hidden.length > 0 ? `${t(K.items.more)} · ${hidden.join(' · ')}` : t(K.items.more);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Reached with the arrow keys, as the picks are: the tray keeps one Tab stop.
          data-segment=""
          tabIndex={-1}
          aria-label={said}
          title={said}
          data-testid={`${testId}-more`}
          data-slot="segment"
          className={cn(
            SEGMENT_CLASS,
            // It gives way first: its words shorten so the tray keeps one row.
            'max-w-24 min-w-6 flex-initial gap-1',
            hidden.length > 0
              ? cn(TONE_CLASSES.lav.surface, 'font-semibold shadow-xs')
              : SEGMENT_OFF_CLASS,
          )}
        >
          {hidden.length > 0 ? (
            <>
              <span className="min-w-0 truncate">{hidden[0]}</span>
              {hidden.length > 1 ? <span>+{hidden.length - 1}</span> : null}
            </>
          ) : (
            <MoreHorizontal aria-hidden="true" className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-testid={`${panelTestId}-more-panel`}
        className="flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-3 p-3"
      >
        <p dir="auto" className="text-detail truncate font-semibold">
          {line.medicineName}
        </p>
        <WhenTray
          value={line.when}
          skin={skin}
          onWhen={onWhen}
          readOnly={readOnly}
          testId={`${panelTestId}-when`}
        />
        {skin || line.where ? (
          <WhereTray
            value={line.where}
            onWhere={onWhere}
            readOnly={readOnly}
            testId={`${panelTestId}-where`}
          />
        ) : null}
        {lit ? (
          <Tray
            label={t(K.dose.doubleHint)}
            items={[
              {
                key: 'double',
                label: t(K.dose.double),
                ariaLabel: t(K.dose.doubleHint),
                on: rxIsDoubled(line.dose),
                tone: 'sage',
                onPress: () => onDose(rxDoubledDose(line.dose)),
                testId: `${panelTestId}-dose-double`,
              },
            ]}
            readOnly={readOnly}
            testId={`${panelTestId}-dose`}
          />
        ) : null}
        <NoteField
          value={line.remarks}
          onNote={onNote}
          readOnly={readOnly}
          testId={`${panelTestId}-remarks`}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Meal · Where" (change-prescription-one-line D3): a tablet's Before ·
 * After, or a skin medicine's Face · Scalp — the two picks a doctor makes
 * most, one click each — then More for the rest.
 */
export function RxDirectionsCell(props: RxDirectionsCellProps) {
  const { line, skin, readOnly, onWhen, onWhere, testId, showLabel = false } = props;
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const value = skin ? line.where : line.when;
  const pick = skin ? onWhere : onWhen;
  // A tablet's meal reads short on its tray ("Before"), in full in its title.
  const pickLabel = (key: string) => {
    if (skin) return labels.where(key);
    return t(key === 'before' ? K.meal.before : K.meal.after);
  };
  const items: SegmentItem[] = picksFor(skin).map((key) => ({
    key,
    label: pickLabel(key),
    title: skin ? undefined : labels.when(key),
    on: value === key,
    tone: skin ? 'mint' : whenTone(key),
    onPress: () => pick(value === key ? '' : key),
    testId: `${testId}-${key}`,
  }));
  return (
    <Tray
      label={skin ? t(K.items.where) : t(K.items.meal)}
      items={items}
      readOnly={readOnly}
      testId={testId}
      showLabel={showLabel}
      nowrap
      after={<MoreSegment {...props} />}
    />
  );
}

/** A line's note, under it — one quiet line, only when there is one (D6). */
export function RxNoteLine({ note, testId }: { note: string; testId: string }) {
  const { t } = useTranslation(RX_NS);
  return (
    <p
      data-testid={testId}
      // Under the medicine's name, past the line's number.
      className="text-caption text-muted-foreground flex min-w-0 items-center gap-1.5 ps-7 pointer-coarse:ps-8"
    >
      <MessageSquare aria-hidden="true" className="size-3.5 flex-none" />
      <span className="sr-only">{t(K.items.remarks)}: </span>
      <span dir="auto" className="min-w-0 truncate">
        {note}
      </span>
    </p>
  );
}

/**
 * "All medicines · Days": one slim line above the lines once two medicines
 * are written — one click puts every line on the same course; lit when they
 * already share it.
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
  const items: SegmentItem[] = RX_DAY_CHIPS.map((count) => ({
    key: String(count),
    label: String(count),
    ariaLabel: t(K.daysNote, { count }),
    on: days === count,
    tone: 'sky',
    onPress: () => onDays(count),
    testId: `${testId}-${count}`,
  }));
  return (
    <Tray
      label={`${t(K.allDays.label)} · ${t(K.items.days)}`}
      items={items}
      readOnly={false}
      testId={testId}
    />
  );
}
