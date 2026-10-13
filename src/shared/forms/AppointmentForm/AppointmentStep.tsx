import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';

/** Props for {@link AppointmentStep}. */
export interface AppointmentStepProps {
  number: number;
  title: string;
  /** The body shows. */
  open: boolean;
  /** Its fields are set: the circle turns green (H:6037). */
  done: boolean;
  /** The line under the title while the body is closed. */
  summary?: string;
  /** At the inline end while closed: "Open" — or "Locked". */
  hint?: string;
  /** The head's press: toggles step 1, toasts on a locked step 2; none for a step that never closes. */
  onToggle?: () => void;
  bodyClassName?: string;
  testId: string;
  toggleTestId: string;
  children: ReactNode;
}

/**
 * One of the appointment form's two step cards (H:2763, H:2775; `acc`,
 * H:6037): a head with the 24px number circle — green once its fields are
 * set, dark while open, grey otherwise — the title, the summary while closed
 * and the "Open" / "Locked" hint; then the body, which rises in 240ms. Unlike
 * the record drawer's accordion, the two cards open on their own: step 1
 * toggles, step 2 stays open until check-in locks it.
 */
export function AppointmentStep({
  number,
  title,
  open,
  done,
  summary,
  hint,
  onToggle,
  bodyClassName,
  testId,
  toggleTestId,
  children,
}: AppointmentStepProps) {
  let circle = 'bg-border text-muted-foreground-strong';
  if (done) circle = 'bg-success text-success-foreground';
  else if (open) circle = 'bg-primary text-primary-foreground';
  const head = (
    <>
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'text-micro flex size-6 flex-none items-center justify-center rounded-full font-semibold tabular-nums',
          circle,
        )}
      >
        {number}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
        <span className="text-field font-semibold">{title}</span>
        {!open && summary ? (
          <span className="text-muted-foreground truncate text-xs">{summary}</span>
        ) : null}
      </span>
      {hint ? (
        <span className="text-muted-foreground flex-none text-xs">{hint}</span>
      ) : null}
    </>
  );
  return (
    <section
      aria-label={title}
      data-testid={testId}
      data-open={open}
      className={cn(
        'flex flex-none flex-col overflow-hidden rounded-xl border',
        open ? 'border-border-strong bg-card' : 'bg-canvas',
      )}
    >
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          data-testid={toggleTestId}
          className="hover:bg-canvas flex w-full items-center gap-2.5 px-4 py-3.5 text-start transition-colors"
        >
          {head}
        </button>
      ) : (
        <div
          data-testid={toggleTestId}
          className="flex w-full items-center gap-2.5 px-4 py-3.5"
        >
          {head}
        </div>
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
