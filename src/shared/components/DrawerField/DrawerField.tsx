import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from 'react';

import { cn } from '@/lib/utils.ts';
import { Label } from '@/shared/components/ui/label.tsx';

import { drawerFieldErrorId } from './drawer-field-controls.ts';
import {
  COLUMN_SPAN_CLASS,
  type DrawerFieldSpan,
  layoutDrawerFields,
} from './drawer-field-layout.ts';

/** Props of {@link DrawerField}. */
export interface DrawerFieldProps {
  label?: string;
  /** The control's id, so the label names it (and the error is `<id>-error`). */
  htmlFor?: string;
  /**
   * Draws the red required mark. The mark is visual only — the control itself
   * carries `required` / `aria-required`.
   */
  required?: boolean;
  /** One-line hint beside the label, truncated with an ellipsis. */
  hint?: string;
  /** The field's validation message, under the control. */
  error?: string;
  /** Width in the drawer's 6-column grid (read by {@link DrawerFieldGrid}). */
  span?: DrawerFieldSpan;
  /** False keeps the field at its span when its row has room (pickers, names). */
  stretch?: boolean;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * One field of a drawer form (`_patterns.md:34`): the 12px/500 label in
 * `muted-foreground-strong`, the `destructive` required mark and an optional
 * truncated hint, then the control, then its error. Screens compose the
 * control (`Input`, `Textarea`, `Switch`, a picker) and lay fields out with
 * {@link DrawerFieldGrid}.
 */
export function DrawerField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className,
  testId,
}: DrawerFieldProps) {
  return (
    <div data-testid={testId} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        // The design's label row sits at the font's own line height (CSS
        // `normal`, ≈15px at 12px), not Tailwind's `leading-normal` (1.5, 18px):
        // three extra pixels per field add up down a long form.
        <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <Label
            htmlFor={htmlFor}
            className="text-muted-foreground-strong shrink-0 gap-0.5 text-xs leading-[normal] font-medium"
          >
            {label}
            {required ? (
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            ) : null}
          </Label>
          {hint ? (
            <span
              title={hint}
              className="text-muted-foreground min-w-0 flex-1 truncate text-xs leading-[normal]"
            >
              {hint}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p
          id={htmlFor ? drawerFieldErrorId(htmlFor) : undefined}
          role="alert"
          className="text-destructive text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FieldElement = ReactElement<Pick<DrawerFieldProps, 'span' | 'stretch'>>;

/**
 * The drawer form's 6-column grid with the form gap (`--form-gap`, per tier).
 * Each child takes the columns its `span` asks for, and the last field of a
 * row stretches to fill it ({@link layoutDrawerFields}). Children are the
 * fields themselves — a fragment counts as one full-width field. An optional
 * `title` heads the group with the design's 11px uppercase section label
 * ("Contact", "Personal", H:894) and names it for assistive tech.
 */
export function DrawerFieldGrid({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const fields = Children.toArray(children).filter((child): child is FieldElement =>
    isValidElement(child),
  );
  const columns = layoutDrawerFields(
    fields.map((field) => ({
      span: field.props.span ?? 'full',
      stretch: field.props.stretch,
    })),
  );

  const grid = (
    <div className={cn('grid grid-cols-6 gap-(--form-gap)', className)}>
      {fields.map((field, index) => (
        <div
          key={field.key ?? index}
          className={cn('min-w-0', COLUMN_SPAN_CLASS[columns[index] ?? 6])}
        >
          {field}
        </div>
      ))}
    </div>
  );
  if (!title) return grid;

  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-3">
      <span
        id={titleId}
        className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase"
      >
        {title}
      </span>
      {grid}
    </div>
  );
}
