import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';

/** One pick of a multi-select field, as its peek pill. */
export interface DrawerPeekPill {
  label: string;
  /** The pick's tone; untoned picks sit on `muted`. */
  tone?: Tone;
}

/**
 * A field in a collapsed step's summary: a value (empty ones are folded into
 * the "Not filled" line), a multi-select's picks as pills (four, then "+N"),
 * or an items table as one row ("<N> added", six names, then "+N").
 */
export type DrawerPeekItem =
  | { kind: 'value'; label: string; value?: string; tone?: Tone }
  | { kind: 'multi'; label: string; values: readonly DrawerPeekPill[] }
  | { kind: 'items'; label: string; names: readonly string[] };

/** Filled pairs a collapsed step shows before "+N more". */
const PAIR_LIMIT = 6;
const MULTI_LIMIT = 4;
const ITEMS_LIMIT = 6;

function Pills({ values }: { values: readonly DrawerPeekPill[] }) {
  const shown = values.slice(0, MULTI_LIMIT);
  const more = values.length - shown.length;
  const keys = occurrenceKeys(shown.map((pill) => pill.label));
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((pill, index) => (
        <span
          key={keys[index]}
          dir="auto"
          data-slot="pill"
          className={cn(
            'text-caption inline-block h-5 max-w-40 truncate rounded-full px-2 leading-5 font-semibold',
            pill.tone ? TONE_CLASSES[pill.tone].surface : 'bg-muted text-foreground',
          )}
        >
          {pill.label}
        </span>
      ))}
      {more > 0 ? (
        <span className="text-caption text-muted-foreground">+{more}</span>
      ) : null}
    </span>
  );
}

/** A filled field: its label over its value — a toned value as its pill. */
function Pair({ item }: { item: Exclude<DrawerPeekItem, { kind: 'items' }> }) {
  let value: ReactNode;
  if (item.kind === 'multi') value = <Pills values={item.values} />;
  else if (item.tone)
    value = <Pills values={[{ label: item.value ?? '', tone: item.tone }]} />;
  else
    value = (
      <span dir="auto" title={item.value} className="line-clamp-2 break-words">
        {item.value}
      </span>
    );
  // Several picks take two columns (once the summary has two), so their pills sit in a row.
  const wide = item.kind === 'multi' && item.values.length > 1;
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-0.5', wide && '@min-[16rem]:col-span-2')}
    >
      <dt className="text-tiny text-muted-foreground truncate font-semibold tracking-[0.04em] uppercase">
        {item.label}
      </dt>
      <dd className="text-detail text-foreground min-w-0">{value}</dd>
    </div>
  );
}

/** An items table: "<label> · <N> added" and its first names as chips. */
function ItemsRow({ label, names }: { label: string; names: readonly string[] }) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const shown = names.slice(0, ITEMS_LIMIT);
  const more = names.length - shown.length;
  const keys = occurrenceKeys(shown);
  return (
    <div className="col-span-full flex min-w-0 flex-col gap-1">
      <dt className="text-tiny text-muted-foreground font-semibold tracking-[0.04em] uppercase">
        {label} · {t(RECORD_DRAWER_KEYS.peek.added, { count: names.length })}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1">
        {shown.map((name, index) => (
          // Added items are sage chips in the design (H:893, `--k9` / `--k10`).
          <span
            key={keys[index]}
            dir="auto"
            data-slot="pill"
            className={cn(
              'inline-block h-5.5 max-w-50 truncate rounded-full px-2 text-xs leading-5.5 font-medium',
              TONE_CLASSES.sage.surface,
            )}
          >
            {name}
          </span>
        ))}
        {more > 0 ? <span className="text-muted-foreground text-xs">+{more}</span> : null}
      </dd>
    </div>
  );
}

/** Whether a peek item holds something. */
function isFilled(item: DrawerPeekItem): boolean {
  if (item.kind === 'value') return Boolean(item.value);
  if (item.kind === 'multi') return item.values.length > 0;
  return item.names.length > 0;
}

/** Props of {@link DrawerStepPeek}. */
export interface DrawerStepPeekProps {
  items: readonly DrawerPeekItem[];
  /** Labels already named in the head's "Missing: …" — left out of "Not filled". */
  missing?: readonly string[];
  testId: string;
  className?: string;
}

/**
 * A collapsed step's summary — what the step holds, read at a glance: the
 * filled fields as label / value pairs on the card itself (no tile borders),
 * in as many columns as the drawer fits (two on a phone); an items table as one
 * row of chips; at most six pairs, then "+N more"; and every empty field folded
 * into one muted "Not filled: …" line instead of a dashed tile each. Nothing
 * filled renders nothing — the head then reads "Not filled yet".
 */
export function DrawerStepPeek({
  items,
  missing = [],
  testId,
  className,
}: DrawerStepPeekProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const filled = items.filter(isFilled);
  if (filled.length === 0) return null;
  const pairs = filled.filter(
    (item): item is Exclude<DrawerPeekItem, { kind: 'items' }> => item.kind !== 'items',
  );
  const rows = filled.filter(
    (item): item is Extract<DrawerPeekItem, { kind: 'items' }> => item.kind === 'items',
  );
  const shown = pairs.slice(0, PAIR_LIMIT);
  const more = pairs.length - shown.length;
  const empty = items
    .filter((item) => !(isFilled(item) || missing.includes(item.label)))
    .map((item) => item.label);
  return (
    <div
      data-testid={testId}
      className={cn('@container flex min-w-0 flex-col gap-2', className)}
    >
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-4 gap-y-2.5">
        {shown.map((item) => (
          <Pair key={`${item.kind}-${item.label}`} item={item} />
        ))}
        {rows.map((item) => (
          <ItemsRow key={`items-${item.label}`} label={item.label} names={item.names} />
        ))}
      </dl>
      {more > 0 || empty.length > 0 ? (
        <p className="text-caption text-muted-foreground min-w-0 truncate">
          {more > 0 ? t(RECORD_DRAWER_KEYS.peek.more, { count: more }) : null}
          {more > 0 && empty.length > 0 ? ' · ' : null}
          {empty.length > 0
            ? t(RECORD_DRAWER_KEYS.peek.notFilled, { fields: empty })
            : null}
        </p>
      ) : null}
    </div>
  );
}
