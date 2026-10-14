import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/app/app-schema.ts';
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

import { DrawerStepCircle, DrawerStepHeadText } from './drawer-step-head.tsx';
import { type DrawerPeekItem, DrawerStepPeek } from './drawer-step-peek.tsx';
import {
  type DrawerStepStatus,
  drawerStepStatus,
  peekHasValue,
} from './drawer-step-status.ts';

/** A step card a screen declares, in order (`_patterns.md:40–49`). */
export interface DrawerStep {
  /** Stable id — the accordion value and the test-id suffix. */
  id: string;
  /** Head title, also the "Next: <title> →" label of the step before. */
  title: string;
  /** Labels of this step's required fields that are still empty. */
  missing?: readonly string[];
  /** What the collapsed card summarises: its fields, filled or not. */
  peek?: readonly DrawerPeekItem[];
  /**
   * The collapsed head's sub line when the step has no peek — a view's
   * readout, a locked step's promise.
   */
  summary?: string;
  /**
   * Not open to the user yet — New lead's "Lead details" before a contact
   * (H:4135): a grey lock, `hint` where "Open" would be, and a tap runs
   * `onAttempt` (the screen's toast) instead of opening. The step before it
   * offers no "Next".
   */
  locked?: { hint: string; onAttempt: () => void };
  /**
   * The step's own say on whether it is complete, over its peek and over having
   * been opened: a step without a peek that holds something (a view's readout),
   * or one whose defaults are no answer (the contact editor's identity, complete
   * only once named). Unset, a step is done once it holds something or was reached.
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
  /**
   * A save was tried: every step's empty required fields are flagged, reached
   * or not.
   */
  revealMissing?: boolean;
  /**
   * The open step can be folded away (the default). New lead's cannot: its one
   * open step stays open, so its head shows no chevron (H:4135).
   */
  collapsible?: boolean;
  /** Prefix for the cards' test ids (`<testId>-step-<id>`). */
  testId: string;
}

interface StepCardProps {
  step: DrawerStep;
  index: number;
  total: number;
  status: DrawerStepStatus;
  filled: boolean;
  next: DrawerStep | undefined;
  tone: Tone;
  collapsible: boolean;
  testId: string;
  onNext: (stepId: string) => void;
  registerTrigger: (stepId: string, node: HTMLButtonElement | null) => void;
}

/**
 * A collapsed head's words: "Missing: …" (in the destructive ink) when a
 * reached step lacks a required field; else "Not filled yet" when it holds
 * nothing; else the step's summary when it has no peek. The hint reads "Edit"
 * once the step holds something, "Open" before — a locked step's own words.
 */
function useStepHead(step: DrawerStep, status: DrawerStepStatus, filled: boolean) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  let line: string | undefined;
  if (status === 'missing') {
    line = t(RECORD_DRAWER_KEYS.step.missing, { fields: step.missing ?? [] });
  } else if (step.peek && !filled) line = t(RECORD_DRAWER_KEYS.step.notFilled);
  else if (!step.peek || step.locked) line = step.summary;
  const hint =
    step.locked?.hint ??
    t(status === 'later' ? RECORD_DRAWER_KEYS.step.open : RECORD_DRAWER_KEYS.step.edit);
  return { line, hint };
}

function StepCard({
  step,
  index,
  total,
  status,
  filled,
  next,
  tone,
  collapsible,
  testId,
  onNext,
  registerTrigger,
}: StepCardProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const isOpen = status === 'open';
  const { locked } = step;
  const id = `${testId}-step-${step.id}`;
  const { line, hint } = useStepHead(step, status, filled);

  return (
    <AccordionItem
      value={step.id}
      data-testid={id}
      data-status={status}
      data-slot="accordion-item"
      className="data-[state=open]:border-border-strong data-[state=open]:bg-card data-[state=closed]:bg-canvas data-[state=closed]:hover:border-border-strong data-[state=closed]:hover:bg-card relative flex flex-col gap-3 rounded-xl border p-(--step-pad) transition-colors last:border-b"
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
        className="min-w-0 items-center justify-start gap-2.5 py-0 text-start hover:no-underline data-[state=closed]:after:absolute data-[state=closed]:after:inset-0 [&>svg:not([data-slot=step-chevron])]:hidden"
      >
        <DrawerStepCircle
          status={status}
          number={index + 1}
          tone={tone}
          locked={Boolean(locked)}
        />
        <DrawerStepHeadText
          title={step.title}
          status={status}
          number={index + 1}
          total={total}
          locked={Boolean(locked)}
          line={line}
          lineMissing={status === 'missing'}
          hint={hint}
          chevron={collapsible || !isOpen}
        />
      </AccordionTrigger>

      {isOpen || locked ? null : (
        <DrawerStepPeek
          items={step.peek ?? []}
          missing={status === 'missing' ? step.missing : undefined}
          testId={`${id}-peek`}
          className="ms-8.5 -mt-1"
        />
      )}

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
 * The steps the user has opened since the drawer opened — the first open one
 * included. Stored with the previous-value pattern, not an effect.
 */
function useReachedSteps(value: string) {
  const [reached, setReached] = useState<ReadonlySet<string>>(
    () => new Set(value ? [value] : []),
  );
  if (value !== '' && !reached.has(value)) setReached(new Set([...reached, value]));
  return reached;
}

/**
 * The step cards of every create and edit drawer — one pattern (H:3816–3852,
 * as revised by `change-drawer-steps`): a single, collapsible accordion, one
 * step open at a time. Every head is the number circle, the title, one sub
 * line while collapsed, the hint and a chevron; the open step is `card` on a
 * strong border and ends with "Next: <step> →"; a collapsed one sits on
 * `canvas`, lifts on hover, opens from anywhere on it and summarises what it
 * holds ({@link DrawerStepPeek}). A step reads done ("✓") once it holds
 * something or was reached with nothing required empty, and is flagged ("!",
 * "Missing: …") only once the user reached it or tried to save.
 */
export function DrawerSteps({
  steps,
  value,
  onValueChange,
  tone = 'stone',
  revealMissing = false,
  collapsible = true,
  testId,
}: DrawerStepsProps) {
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const reached = useReachedSteps(value);

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
      collapsible={collapsible}
      value={value}
      onValueChange={onValueChange}
      className="flex flex-col gap-3"
      data-testid={`${testId}-steps`}
    >
      {steps.map((step, index) => {
        const filled = peekHasValue(step.peek);
        return (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            status={drawerStepStatus({
              open: step.id === value,
              missingCount: step.missing?.length ?? 0,
              filled,
              reached: reached.has(step.id),
              revealMissing,
              complete: step.complete,
            })}
            filled={filled}
            next={steps[index + 1]}
            tone={tone}
            collapsible={collapsible}
            testId={testId}
            onNext={goTo}
            registerTrigger={registerTrigger}
          />
        );
      })}
    </Accordion>
  );
}
