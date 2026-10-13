import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  type DrawerPeekItem,
  DrawerStepCircle,
  DrawerStepHeadText,
  DrawerStepPeek,
  type DrawerStepStatus,
  peekHasValue,
} from '@/shared/components/DrawerSteps/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';

/** Props for {@link AppointmentStep}. */
export interface AppointmentStepProps {
  number: number;
  /** How many step cards the form shows (read out with the head). */
  total: number;
  title: string;
  /** The body shows. */
  open: boolean;
  /** Its fields are set: the circle turns green (H:6037). */
  done: boolean;
  /** Date & time after check-in: a lock, its hint, and a tap that only explains. */
  locked?: boolean;
  /** What the collapsed card summarises. */
  peek?: readonly DrawerPeekItem[];
  /**
   * The collapsed head's sub line — the locked slot's "<day> · <time> · locked …";
   * "Not filled yet" by default while the step holds nothing.
   */
  line?: string;
  /** At the inline end while closed: "Edit" / "Open" — or "Locked". */
  hint?: string;
  /** The room's section tone — the open step's circle takes its ink. */
  tone: Tone;
  /** The head's press: opens or folds the step; toasts on a locked one. */
  onToggle: () => void;
  bodyClassName?: string;
  testId: string;
  toggleTestId: string;
  children: ReactNode;
}

/**
 * One of the appointment form's two step cards (H:2763, H:2775), drawn as every
 * drawer's step card (`DrawerSteps`, `change-drawer-steps`): the number circle
 * (the section tone while open, green ✓ once its fields are set, grey before, a
 * lock after check-in), the title, the collapsed card's summary and its hint
 * with the chevron; one card open at a time — the form holds which. The whole
 * collapsed card is the button and lifts on hover; the body rises in 240ms.
 */
export function AppointmentStep({
  number,
  total,
  title,
  open,
  done,
  locked = false,
  peek,
  line,
  hint,
  tone,
  onToggle,
  bodyClassName,
  testId,
  toggleTestId,
  children,
}: AppointmentStepProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const subLine =
    line ?? (peekHasValue(peek) ? undefined : t(RECORD_DRAWER_KEYS.step.notFilled));
  let status: DrawerStepStatus = 'later';
  if (open) status = 'open';
  else if (done) status = 'done';
  return (
    <section
      aria-label={title}
      data-testid={testId}
      data-open={open}
      data-status={status}
      className={cn(
        'relative flex flex-none flex-col rounded-xl border transition-colors',
        open
          ? 'border-border-strong bg-card'
          : 'bg-canvas hover:border-border-strong hover:bg-card',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-disabled={locked ? true : undefined}
        onClick={onToggle}
        data-testid={toggleTestId}
        // The theme's focus personality owns the ring (`data-focus`).
        data-slot="accordion-trigger"
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl px-4 py-3.5 text-start',
          // Collapsed, the whole card opens it — its summary included.
          !open && 'after:absolute after:inset-0',
        )}
      >
        <DrawerStepCircle status={status} number={number} tone={tone} locked={locked} />
        <DrawerStepHeadText
          title={title}
          status={status}
          number={number}
          total={total}
          locked={locked}
          line={subLine}
          hint={hint}
        />
      </button>
      {open || locked ? null : (
        <DrawerStepPeek
          items={peek ?? []}
          testId={`${testId}-peek`}
          className="ms-12.5 me-4 -mt-2 mb-3.5"
        />
      )}
      {open ? (
        <div className={cn('animate-reveal flex flex-col', bodyClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Props for {@link StepField}. */
export interface StepFieldProps {
  label: string;
  /** The field's id, so the label names it; omit for a group that names itself. */
  htmlFor?: string;
  /** How far the label drops to meet its control: chips 4px, an input 9px, a picker 10px. */
  align?: 'chips' | 'input' | 'picker';
  children: ReactNode;
}

const LABEL_OFFSET: Record<NonNullable<StepFieldProps['align']>, string> = {
  chips: 'pt-1',
  input: 'pt-2.25',
  picker: 'pt-2.5',
};

/**
 * A step's field row (H:2764–2773): the 88px label at the inline start and
 * the control beside it — and, in a form column under 520px (a phone, the
 * narrow tablet edit form: under 480px inside the body's sides), the label
 * above the control with a 6px gap (H:32–34). The 1024px edit form's 548px
 * column keeps its labels beside the fields, as the prototype's does.
 */
export function StepField({ label, htmlFor, align = 'chips', children }: StepFieldProps) {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div className="flex min-w-0 items-start gap-3 @max-[480px]:flex-col @max-[480px]:items-stretch @max-[480px]:gap-1.5">
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className={cn(
          'text-muted-foreground-strong w-22 flex-none text-xs font-medium @max-[480px]:w-auto @max-[480px]:pt-0',
          LABEL_OFFSET[align],
        )}
      >
        {label}
      </Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
