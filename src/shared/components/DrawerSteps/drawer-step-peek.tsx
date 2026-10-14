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
 * A field in a collapsed step's summary: a value (empty ones are counted as
 * "not filled"), a multi-select's picks as pills (four, then "+N"), or an items
 * table as a row of chips (six names, then "+N"). The label is the field's name:
 * read out and shown on hover, never printed on the card.
 */
export type DrawerPeekItem =
  | { kind: 'value'; label: string; value?: string; tone?: Tone }
  | { kind: 'multi'; label: string; values: readonly DrawerPeekPill[] }
  | { kind: 'items'; label: string; names: readonly string[] };

/** Filled values a collapsed step shows before "+N more". */
const VALUE_LIMIT = 6;
const MULTI_LIMIT = 4;
const ITEMS_LIMIT = 6;

/** A pill's size; its `rounded-full` sits beside its `data-slot`, for the theme's Sharp shape. */
const PILL_SIZE = 'h-5 px-2 leading-5';

/** A field's name before its value, for a screen reader only: "City: Surat". */
function FieldName({ label }: { label: string }) {
  return <span className="sr-only">{label}: </span>;
}

/** A multi-select's picks as pills: four, then "+N". */
function Pills({ values }: { values: readonly DrawerPeekPill[] }) {
  const shown = values.slice(0, MULTI_LIMIT);
  const more = values.length - shown.length;
  const keys = occurrenceKeys(shown.map((pill) => pill.label));
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((pill, index) => (
        <span
          key={keys[index]}
          dir="auto"
          data-slot="pill"
          className={cn(
            'text-caption inline-block max-w-40 truncate rounded-full font-semibold',
            PILL_SIZE,
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

/**
 * One value of the read-back strip: the lead value in the full ink, the rest in
 * the softer one; a toned value as its pill. Every value opens with a hairline;
 * the strip clips the one that starts a line, so hairlines only ever sit between
 * two values. Its field's name is read out and shown on hover.
 */
function StripValue({
  item,
  lead,
}: {
  item: Exclude<DrawerPeekItem, { kind: 'items' }>;
  lead: boolean;
}) {
  let value: ReactNode;
  if (item.kind === 'multi') value = <Pills values={item.values} />;
  else if (item.tone)
    value = <Pills values={[{ label: item.value ?? '', tone: item.tone }]} />;
  else value = item.value;
  return (
    <li
      title={item.kind === 'value' ? `${item.label} · ${item.value ?? ''}` : item.label}
      className={cn(
        'text-detail inline-flex max-w-full min-w-0 items-center gap-2',
        lead ? 'text-foreground font-medium' : 'text-muted-foreground-strong',
      )}
    >
      {/* A hairline, not a dot: values like "Main · head office" carry their own dots. */}
      <span aria-hidden="true" className="bg-border -ms-px h-3 w-px shrink-0" />
      <FieldName label={item.label} />
      <span dir="auto" className="min-w-0 truncate">
        {value}
      </span>
    </li>
  );
}

/** An items table as a row of chips: six names, then "+N". */
function ItemsChips({ label, names }: { label: string; names: readonly string[] }) {
  const shown = names.slice(0, ITEMS_LIMIT);
  const more = names.length - shown.length;
  const keys = occurrenceKeys(shown);
  return (
    <p title={label} className="flex min-w-0 flex-wrap items-center gap-1">
      <FieldName label={label} />
      {shown.map((name, index) => (
        // Added items are sage chips in the design (H:893, `--k9` / `--k10`).
        <span
          key={keys[index]}
          dir="auto"
          data-slot="pill"
          className={cn(
            'inline-block max-w-50 truncate rounded-full text-xs font-medium',
            PILL_SIZE,
            TONE_CLASSES.sage.surface,
          )}
        >
          {name}
        </span>
      ))}
      {more > 0 ? <span className="text-muted-foreground text-xs">+{more}</span> : null}
    </p>
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
  /** Fields already named in the head's "Missing: …" — not counted again as not filled. */
  missing?: readonly string[];
  testId: string;
  className?: string;
}

/**
 * A collapsed step's overview — its values read back, without their field
 * names: one wrapping strip, the lead value first in the full ink and the rest
 * in the softer one, split by hairlines (never one at a line's start); toned values and picks as pills; an
 * items table as a row of chips under it; at most six values, then "+N more";
 * and the empty fields counted once, "2 not filled". Each field's name is read
 * out with its value and shown on hover. Nothing filled renders nothing — the
 * head then reads "Not filled yet".
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
  const values = filled.filter(
    (item): item is Exclude<DrawerPeekItem, { kind: 'items' }> => item.kind !== 'items',
  );
  const rows = filled.filter(
    (item): item is Extract<DrawerPeekItem, { kind: 'items' }> => item.kind === 'items',
  );
  const shown = values.slice(0, VALUE_LIMIT);
  const more = values.length - shown.length;
  const empty = items
    .filter((item) => !(isFilled(item) || missing.includes(item.label)))
    .map((item) => item.label);
  const keys = occurrenceKeys(shown.map((item) => item.label));
  return (
    <div data-testid={testId} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {shown.length > 0 ? (
        // The list starts one hairline and its space early, under the clip: the
        // hairline of the value that opens a line falls outside it.
        <div className="min-w-0 overflow-hidden">
          <ul className="-ms-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            {shown.map((item, index) => (
              <StripValue key={keys[index]} item={item} lead={index === 0} />
            ))}
          </ul>
        </div>
      ) : null}
      {rows.map((item) => (
        <ItemsChips key={`items-${item.label}`} label={item.label} names={item.names} />
      ))}
      {more > 0 || empty.length > 0 ? (
        <p className="text-caption text-muted-foreground flex min-w-0 items-center gap-1.5">
          {more > 0 ? (
            <span>{t(RECORD_DRAWER_KEYS.peek.more, { count: more })}</span>
          ) : null}
          {more > 0 && empty.length > 0 ? <span aria-hidden="true">·</span> : null}
          {empty.length > 0 ? (
            <span title={t(RECORD_DRAWER_KEYS.peek.notFilled, { fields: empty })}>
              <span aria-hidden="true">
                {t(RECORD_DRAWER_KEYS.peek.notFilledCount, { count: empty.length })}
              </span>
              <span className="sr-only">
                {t(RECORD_DRAWER_KEYS.peek.notFilled, { fields: empty })}
              </span>
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
