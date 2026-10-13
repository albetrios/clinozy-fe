import { cn } from '@/lib/utils.ts';

/** Props for {@link WeightStableLabel}. */
export interface WeightStableLabelProps {
  /** The label — plain text: it is printed twice, once shown and once as the width reserve. */
  label: string;
  /** Classes for the label box — alignment, truncation width, text size. */
  className?: string;
}

/**
 * A tab label that keeps the width of its bold self, picked or not.
 *
 * A tab drawn 600 when current and 500 otherwise grows by a pixel or two when
 * it becomes current, and every tab after it moves (iteration
 * change-shell-polish-and-sign-in, D6). Here the shown label and an invisible
 * 600-weight copy share one grid cell, so the cell is always the bold width and
 * nothing beside the tab moves when its weight changes.
 *
 * The copy is a `::before` printed from `data-label`, not a second text node:
 * screen readers, `innerText` and `getByText` find the label exactly once. The
 * shown label inherits the tab's weight and truncates in the space it gets.
 */
export function WeightStableLabel({ label, className }: WeightStableLabelProps) {
  return (
    <span className={cn('inline-grid max-w-full min-w-0', className)}>
      <span className="col-start-1 row-start-1 min-w-0 truncate">{label}</span>
      <span
        aria-hidden="true"
        data-label={label}
        data-slot="weight-reserve"
        className="invisible col-start-1 row-start-1 h-0 min-w-0 overflow-hidden font-semibold whitespace-nowrap before:content-[attr(data-label)]"
      />
    </span>
  );
}
