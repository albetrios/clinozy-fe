import { type Ref, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import type { RxCatalogMedicine } from '@/shared/api/app/prescriptions-contracts.ts';
import { nameNumbers } from '@/shared/components/QuickLine/index.ts';
import { saveShortcutKeys } from '@/shared/components/RecordDrawer/record-drawer-save-shortcut.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import { Check, ClipboardList, Plus, TriangleAlert, X } from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import { rxAllergyMatches } from './rx-allergy.ts';
import { emptyRxLine } from './rx-form.ts';
import {
  type ReadableRxPadLine,
  readableRxPadLines,
  readRxPad,
  RX_PAD_LINES_MAX,
  RX_PAD_TEXT_MAX,
  type RxPadLine,
  rxPadMedicine,
} from './rx-pad.ts';
import { useRxLineTags } from './use-rx-quick-line.ts';

const K = RX_KEYS;
const ID = RX_TEST_IDS.pad;

/** The success pills the quick line shows for its shorthand — the same in the preview (round, as a pill). */
const TAG_CLASS =
  'bg-success/10 text-success text-caption inline-flex h-5.5 items-center px-2 font-medium whitespace-nowrap tabular-nums';

/** The allergies a Pad line's medicine matches (its name and the store's composition). */
function lineAllergies(
  line: ReadableRxPadLine,
  catalog: readonly RxCatalogMedicine[],
  allergies: readonly string[] | null,
): string[] {
  const medicine = rxPadMedicine(line);
  const [match] = rxAllergyMatches(
    [{ ...emptyRxLine(), medicineName: medicine.name, medicineId: medicine.medicineId }],
    catalog,
    allergies,
  );
  return match?.allergies ?? [];
}

/** What a read line adds, or the text it skips. */
function lineName(line: RxPadLine): string {
  if (line.kind === 'found') return line.medicine.name;
  return line.kind === 'typed' ? line.name : line.text;
}

/** The mark before a read line: found ✓, added as typed +, skipped ×. */
const LINE_MARKS = { found: Check, typed: Plus, unreadable: X } as const;

/** The state at a read line's end: the store's stock, "Not in the list · …" or "… skipped". */
function useLineState() {
  const { t } = useTranslation(RX_NS);
  return (line: RxPadLine): string => {
    if (line.kind !== 'found') return t(K.pad[line.kind]);
    const { stock } = line.medicine;
    if (stock === null) return '';
    return stock > 0 ? t(K.quick.inStock, { count: stock }) : t(K.quick.outOfStock);
  };
}

/** One read line: its mark, the medicine it adds (or the text it skips), its pills. */
function PadPreviewRow({
  line,
  catalog,
  allergies,
}: {
  line: RxPadLine;
  catalog: readonly RxCatalogMedicine[];
  allergies: readonly string[] | null;
}) {
  const { t } = useTranslation(RX_NS);
  const tags = useRxLineTags();
  const state = useLineState();
  const unreadable = line.kind === 'unreadable';
  const matched =
    line.kind === 'unreadable' ? [] : lineAllergies(line, catalog, allergies);
  const Mark = LINE_MARKS[line.kind];
  return (
    <li
      data-testid={`${ID}-line`}
      data-kind={line.kind}
      className={cn(
        'bg-background flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-1.5',
        matched.length > 0 && 'border-destructive-border bg-destructive-tint',
      )}
    >
      <Mark
        aria-hidden="true"
        className={cn(
          'size-3.5 flex-none',
          line.kind === 'found' ? 'text-success' : 'text-muted-foreground',
        )}
      />
      {line.kind === 'found' ? <span className="sr-only">{t(K.pad.found)}</span> : null}
      <span
        className={cn(
          'text-body min-w-0 truncate font-medium',
          unreadable && 'text-muted-foreground font-normal line-through',
        )}
      >
        {lineName(line)}
      </span>
      {unreadable ? null : (
        <span className="flex flex-wrap gap-1">
          {tags(line.values).map((tag) => (
            <span key={tag} data-slot="pill" className={cn(TAG_CLASS, 'rounded-full')}>
              {tag}
            </span>
          ))}
        </span>
      )}
      {matched.length > 0 ? (
        <span
          data-slot="pill"
          data-testid={`${ID}-line-allergy`}
          className="bg-destructive/10 text-destructive text-caption inline-flex h-5.5 items-center gap-1 rounded-full px-2 font-medium whitespace-nowrap"
        >
          <TriangleAlert aria-hidden="true" className="size-3" />
          {matched.join(', ')}
        </span>
      ) : null}
      <span className="text-caption text-muted-foreground ms-auto whitespace-nowrap">
        {state(line)}
      </span>
    </li>
  );
}

/** Props of {@link RxPadPanel}. */
export interface RxPadPanelProps {
  catalog: readonly RxCatalogMedicine[];
  /** The patient's allergies: a line that matches one is marked as it is read. */
  allergies: readonly string[] | null;
  /** Adds the readable lines to the form (the drawer writes and toasts). */
  onAdd: (lines: readonly ReadableRxPadLine[]) => void;
  onClose: () => void;
  /** The panel's root — the drawer's Esc closes the Pad, not the drawer, while it has the focus. */
  panelRef?: Ref<HTMLElement>;
  /** The textarea's id, so the toggle can point at it (`aria-controls`). */
  id?: string;
}

/**
 * The Rx Pad (feat-prescription-composer KICKOFF §6.4; `BRIEF.md:19–28`): a
 * whole prescription typed or pasted at once, one medicine a line in the
 * quick line's shorthand. A live preview reads each line as it is typed — the
 * medicine it found with its stock, a name added as typed, or a line it
 * skips — with the shorthand's pills and an allergy mark; "Add N medicines"
 * (or ⌘/Ctrl ↵) adds the readable lines and empties the pad. It never saves.
 */
export function RxPadPanel({
  catalog,
  allergies,
  onAdd,
  onClose,
  panelRef,
  id,
}: RxPadPanelProps) {
  const { t } = useTranslation(RX_NS);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const labelId = useId();
  const hintId = useId();
  const ownId = useId();
  const inputId = id ?? ownId;
  // Opening the Pad puts the cursor in it.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const numbers = nameNumbers(catalog.map((medicine) => medicine.name));
  const pad = readRxPad(text, catalog, numbers);
  const readable = readableRxPadLines(pad);
  // A line is its text — "·2" for a line written twice.
  const lineKeys = occurrenceKeys(pad.lines.map((line) => line.text));
  const found = pad.lines.filter((line) => line.kind === 'found').length;
  const typed = pad.lines.filter((line) => line.kind === 'typed').length;
  const skipped = pad.lines.length - readable.length;
  const summary = [
    t(K.pad.lines, { count: pad.lines.length }),
    found ? t(K.pad.foundCount, { value: found }) : '',
    typed ? t(K.pad.typedCount, { value: typed }) : '',
    skipped ? t(K.pad.skippedCount, { value: skipped }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const add = () => {
    if (readable.length === 0) return;
    onAdd(readable);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <section
      ref={panelRef}
      aria-labelledby={labelId}
      data-testid={ID}
      className="bg-canvas animate-dropdown-in flex flex-col gap-2.5 rounded-xl border p-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ClipboardList
          aria-hidden="true"
          className="text-muted-foreground size-4 flex-none"
        />
        <label
          id={labelId}
          htmlFor={inputId}
          className="text-body flex-none font-semibold whitespace-nowrap"
        >
          {t(K.pad.label)}
        </label>
        <span id={hintId} className="text-caption text-muted-foreground min-w-0 truncate">
          {t(K.pad.hint)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t(K.pad.close)}
          title={t(K.pad.close)}
          onClick={onClose}
          data-testid={`${ID}-close`}
          className="ms-auto size-7 flex-none"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      <Textarea
        ref={inputRef}
        id={inputId}
        value={text}
        rows={4}
        maxLength={RX_PAD_TEXT_MAX}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={hintId}
        placeholder={t(K.pad.placeholder)}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            add();
          }
        }}
        data-testid={`${ID}-input`}
        className="rx-pad-input bg-background font-mono text-sm leading-6"
      />
      <ol
        aria-live="polite"
        aria-label={summary}
        data-testid={`${ID}-preview`}
        className="rx-pad-preview flex flex-col gap-1 overflow-y-auto"
      >
        {pad.lines.length === 0 ? (
          <li className="text-caption text-muted-foreground px-1">{t(K.pad.empty)}</li>
        ) : (
          pad.lines.map((line, index) => (
            <PadPreviewRow
              key={lineKeys[index]}
              line={line}
              catalog={catalog}
              allergies={allergies}
            />
          ))
        )}
      </ol>
      {pad.overflow > 0 ? (
        <p
          data-testid={`${ID}-overflow`}
          className="text-caption text-tone-butter-foreground"
        >
          {t(K.pad.overflow, { max: RX_PAD_LINES_MAX })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t pt-2.5">
        <span
          data-testid={`${ID}-summary`}
          className="text-caption text-muted-foreground min-w-0 truncate"
        >
          {pad.lines.length > 0 ? summary : null}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={text === ''}
          onClick={() => {
            setText('');
            inputRef.current?.focus();
          }}
          data-testid={`${ID}-clear`}
          className="ms-auto"
        >
          {t(K.pad.clear)}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={readable.length === 0}
          onClick={add}
          data-testid={`${ID}-add`}
          className="gap-2"
        >
          {t(K.pad.add, { count: readable.length })}
          <span
            data-slot="kbd"
            aria-hidden="true"
            className="text-micro border-primary-foreground/25 text-primary-foreground/70 rounded-sm border px-1 font-mono"
          >
            {saveShortcutKeys().label}
          </span>
        </Button>
      </div>
    </section>
  );
}
