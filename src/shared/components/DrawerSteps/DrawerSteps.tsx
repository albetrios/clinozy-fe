import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { Check } from '@/shared/icons/index.ts';

import { type DrawerStepStatus, drawerStepStatus } from './drawer-step-status.ts';

/** One pick of a multi-select field, as its peek pill. */
export interface DrawerPeekPill {
  label: string;
  /** The pick's tone; untoned picks sit on `muted`. */
  tone?: Tone;
}

/**
 * A tile in a collapsed step's peek (H:3832–3834): a field's value (an empty
 * one reads "Empty" on a dashed tile), a multi-select's picks as pills (four,
 * then "+N"), or an items table as one full-width tile ("<N> added" or "None
 * yet", six names, then "+N").
 */
export type DrawerPeekItem =
  | { kind: 'value'; label: string; value?: string; tone?: Tone }
  | { kind: 'multi'; label: string; values: readonly DrawerPeekPill[] }
  | { kind: 'items'; label: string; names: readonly string[] };

/** A step card a screen declares, in order (`_patterns.md:40–49`). */
export interface DrawerStep {
  /** Stable id — the accordion value and the test-id suffix. */
  id: string;
  /** Head title, also the "Next: <title> →" label of the step before. */
  title: string;
  /** Labels of this step's required fields that are still empty. */
  missing?: readonly string[];
  /** What the card shows while collapsed (at most eight tiles). */
  peek?: readonly DrawerPeekItem[];
  /** Optional head sub line while nothing is missing (open, or without a peek). */
  summary?: string;
  /**
   * Not open to the user yet — New lead's "Lead details" before a contact
   * (H:4135): a grey number, `hint` where "Open" would be, and a tap runs
   * `onAttempt` (the screen's toast) instead of opening. The step before it
   * offers no "Next".
   */
  locked?: { hint: string; onAttempt: () => void };
  /**
   * Its fields are filled: the circle turns green with its number, open or
   * not (the contact editor's "Identity & reach" once a name is typed, H:4483).
   */
  complete?: boolean;
  /** The open step's body — the screen's fields. */
  content: ReactNode;
}

/** Props of {@link DrawerSteps}. */
export interface DrawerStepsProps {
  steps: readonly DrawerStep[];
  /** The open step's id; '' when every card is collapsed. */
  value: string;
  onValueChange: (stepId: string) => void;
  /** The room's section tone — the open step's circle takes its ink. */
  tone?: Tone;
  /** Prefix for the cards' test ids (`<testId>-step-<id>`). */
  testId: string;
}

const PEEK_LIMIT = 8;
const MULTI_LIMIT = 4;
const ITEMS_LIMIT = 6;

const CIRCLE_CLASS: Record<Exclude<DrawerStepStatus, 'open'>, string> = {
  missing: 'bg-destructive text-destructive-foreground',
  done: 'bg-success text-success-foreground',
  later: 'bg-border text-muted-foreground-strong',
};

const TILE_CLASS =
  'flex min-w-0 flex-col gap-0.5 rounded-lg border bg-background px-2.5 py-1.5';
const TILE_LABEL_CLASS =
  'truncate text-tiny font-semibold tracking-[0.04em] text-muted-foreground uppercase';

function ValueTile({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string;
  tone?: Tone;
}) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  if (!value) {
    return (
      <div className={cn(TILE_CLASS, 'border-dashed')}>
        <span className={TILE_LABEL_CLASS}>{label}</span>
        <span className="text-detail text-disabled">
          {t(RECORD_DRAWER_KEYS.peek.empty)}
        </span>
      </div>
    );
  }
  return (
    <div className={TILE_CLASS}>
      <span className={TILE_LABEL_CLASS}>{label}</span>
      {tone ? (
        <span
          data-slot="pill"
          className={cn(
            'text-detail max-w-full self-start rounded-full px-2 py-px font-semibold',
            TONE_CLASSES[tone].surface,
          )}
        >
          {value}
        </span>
      ) : (
        <span className="text-detail text-foreground line-clamp-2">{value}</span>
      )}
    </div>
  );
}

function MultiTile({
  label,
  values,
}: {
  label: string;
  values: readonly DrawerPeekPill[];
}) {
  // One pick (or none) reads as a plain value, as in the design.
  if (values.length <= 1) {
    return <ValueTile label={label} value={values[0]?.label} tone={values[0]?.tone} />;
  }
  const shown = values.slice(0, MULTI_LIMIT);
  const more = values.length - shown.length;
  const keys = occurrenceKeys(shown.map((pill) => pill.label));
  return (
    <div className={TILE_CLASS}>
      <span className={TILE_LABEL_CLASS}>{label}</span>
      <span className="flex flex-wrap gap-1">
        {shown.map((pill, index) => (
          <span
            key={keys[index]}
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
          <span className="text-caption text-muted-foreground self-center">+{more}</span>
        ) : null}
      </span>
    </div>
  );
}

function ItemsTile({ label, names }: { label: string; names: readonly string[] }) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const shown = names.slice(0, ITEMS_LIMIT);
  const more = names.length - shown.length;
  const keys = occurrenceKeys(shown);
  const count =
    names.length > 0
      ? t(RECORD_DRAWER_KEYS.peek.added, { count: names.length })
      : t(RECORD_DRAWER_KEYS.peek.noneYet);
  return (
    <div className="bg-background col-span-full flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1.5">
      <span className="text-tiny text-muted-foreground me-0.5 font-semibold tracking-[0.04em] uppercase">
        {label} · {count}
      </span>
      {shown.map((name, index) => (
        // Added items are sage chips in the design (H:893, `--k9` / `--k10`).
        <span
          key={keys[index]}
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
    </div>
  );
}

function PeekTile({ item }: { item: DrawerPeekItem }) {
  if (item.kind === 'items') return <ItemsTile label={item.label} names={item.names} />;
  if (item.kind === 'multi') return <MultiTile label={item.label} values={item.values} />;
  return <ValueTile label={item.label} value={item.value} tone={item.tone} />;
}

function StepCircle({
  status,
  number,
  tone,
  locked,
  complete,
}: {
  status: DrawerStepStatus;
  number: number;
  tone: Tone;
  locked: boolean;
  complete: boolean;
}) {
  let mark: ReactNode = number;
  if (status === 'missing') mark = '!';
  else if (status === 'done') mark = <Check className="size-3" />;
  let fill: string;
  // Filled in: green, whether or not it is open.
  if (complete && status !== 'missing') fill = CIRCLE_CLASS.done;
  // Open: the section tone's ink as the fill, the numeral in `background`.
  else if (status === 'open') fill = TONE_CLASSES[tone].fill;
  // Locked: the later grey with a fainter numeral (H:4135, z200 / z400).
  else if (locked) fill = 'bg-border text-disabled';
  else fill = CIRCLE_CLASS[status];
  return (
    <span
      aria-hidden="true"
      data-slot="pill"
      className={cn(
        'text-micro flex size-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums',
        fill,
      )}
    >
      {mark}
    </span>
  );
}

interface StepCardProps {
  step: DrawerStep;
  index: number;
  status: DrawerStepStatus;
  /** At or before the reference step: the hint reads "Edit", else "Open". */
  reached: boolean;
  next: DrawerStep | undefined;
  tone: Tone;
  testId: string;
  onNext: (stepId: string) => void;
  registerTrigger: (stepId: string, node: HTMLButtonElement | null) => void;
}

/**
 * A step head's words: the sub line — what is missing, else the step's own
 * summary, which a collapsed card's peek replaces (H:3840–3841) — and the hint
 * ("Edit" once reached, else "Open"; a locked step's own).
 */
function useStepHead(
  step: DrawerStep,
  status: DrawerStepStatus,
  reached: boolean,
  peeking: boolean,
) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  let line = peeking ? undefined : step.summary;
  if (status === 'missing') {
    line = t(RECORD_DRAWER_KEYS.step.missing, { fields: step.missing ?? [] });
  }
  const hint =
    step.locked?.hint ??
    t(reached ? RECORD_DRAWER_KEYS.step.edit : RECORD_DRAWER_KEYS.step.open);
  return { line, hint };
}

function StepCard({
  step,
  index,
  status,
  reached,
  next,
  tone,
  testId,
  onNext,
  registerTrigger,
}: StepCardProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const isOpen = status === 'open';
  const { locked } = step;
  const peek = isOpen ? [] : (step.peek ?? []).slice(0, PEEK_LIMIT);
  const id = `${testId}-step-${step.id}`;
  const { line, hint } = useStepHead(step, status, reached, peek.length > 0);

  return (
    <AccordionItem
      value={step.id}
      data-testid={id}
      data-status={status}
      data-slot="accordion-item"
      className="data-[state=open]:border-border-strong data-[state=open]:bg-card data-[state=closed]:bg-canvas relative flex flex-col gap-3 rounded-xl border p-(--step-pad) last:border-b"
    >
      <AccordionTrigger
        ref={(node) => registerTrigger(step.id, node)}
        data-testid={`${id}-trigger`}
        aria-disabled={locked ? true : undefined}
        onClick={(event) => {
          if (!locked) return;
          // A handled click never reaches the accordion: the step stays shut.
          event.preventDefault();
          locked.onAttempt();
        }}
        className="min-w-0 items-center justify-start gap-2.5 py-0 text-start hover:no-underline data-[state=closed]:after:absolute data-[state=closed]:after:inset-0 [&>svg]:hidden"
      >
        <StepCircle
          status={status}
          number={index + 1}
          tone={tone}
          locked={Boolean(locked)}
          complete={Boolean(step.complete)}
        />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="text-field text-foreground font-semibold">{step.title}</span>
          {line ? (
            <span className="text-muted-foreground truncate text-xs font-normal">
              {line}
            </span>
          ) : null}
        </span>
        {isOpen ? null : (
          <span className="text-muted-foreground shrink-0 text-xs font-normal">
            {hint}
          </span>
        )}
      </AccordionTrigger>

      {peek.length > 0 ? (
        <div
          data-testid={`${id}-peek`}
          className="ms-8.5 -mt-1 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-1.5"
        >
          {peek.map((item) => (
            <PeekTile key={`${item.kind}-${item.label}`} item={item} />
          ))}
        </div>
      ) : null}

      <AccordionContent motion="reveal" className="flex flex-col gap-3 pb-0">
        {step.content}
        {next && !next.locked ? (
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={`${id}-next`}
              className="text-detail h-8 max-w-full rounded-lg px-3"
              onClick={() => onNext(next.id)}
            >
              <span className="truncate">
                {t(RECORD_DRAWER_KEYS.step.next, { step: next.title })}
              </span>
            </Button>
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * The record drawer's step cards (H:3816–3852): a single, collapsible
 * accordion. The open card is `card` on a strong border; a closed one sits on
 * `canvas` and shows its peek, and a click anywhere on it opens it. Each head
 * carries the number circle (open: the section tone's ink; done: "✓"; missing a
 * required field: "!"; later: its number), the title, a "Missing: …" line and
 * the "Edit" / "Open" hint; each open step ends with "Next: <step> →".
 */
export function DrawerSteps({
  steps,
  value,
  onValueChange,
  tone = 'stone',
  testId,
}: DrawerStepsProps) {
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  // The step the done / later split is measured from survives a collapse:
  // folding the open card away must not turn the steps already done into
  // "later" ones (the stored-previous-value pattern, not an effect).
  const [anchor, setAnchor] = useState(value);
  if (value !== '' && value !== anchor) setAnchor(value);

  const openIndex = steps.findIndex((step) => step.id === value);
  const referenceIndex = steps.findIndex((step) => step.id === (value || anchor));

  const registerTrigger = (stepId: string, node: HTMLButtonElement | null) => {
    if (node) triggers.current.set(stepId, node);
    else triggers.current.delete(stepId);
  };

  const goTo = (stepId: string) => {
    onValueChange(stepId);
    // The pressed "Next" leaves with its step: focus moves to the head that opened.
    triggers.current.get(stepId)?.focus();
  };

  if (steps.length === 0) return null;

  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={onValueChange}
      className="flex flex-col gap-3"
      data-testid={`${testId}-steps`}
    >
      {steps.map((step, index) => (
        <StepCard
          key={step.id}
          step={step}
          index={index}
          status={drawerStepStatus(
            index,
            openIndex,
            referenceIndex,
            step.missing?.length ?? 0,
          )}
          reached={index <= referenceIndex}
          next={steps[index + 1]}
          tone={tone}
          testId={testId}
          onNext={goTo}
          registerTrigger={registerTrigger}
        />
      ))}
    </Accordion>
  );
}
