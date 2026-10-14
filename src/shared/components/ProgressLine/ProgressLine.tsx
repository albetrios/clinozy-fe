import { cn } from '@/lib/utils.ts';

/** Props for {@link ProgressLine}. */
export interface ProgressLineProps {
  /** What is in progress ("Loading page", "Searching…") — the progress element's name. */
  label: string;
  /** Places the line: `fixed inset-x-0 top-0` for the page, `absolute inset-x-0 bottom-0` under a field. */
  className?: string;
  testId?: string;
}

/**
 * The indeterminate progress line: a 2px track with a primary bar that sweeps
 * across it on `route-progress` (1.1s) — the line under a search while its
 * answer loads (`ContactQuickPick`). The page-top `RouteProgressBar` draws the
 * same bar inline: it is on the first paint, whose budget has no room for a
 * shared component (change-contact-quick-pick D28). Assistive technology reads
 * a native, valueless (indeterminate) `<progress>` named by `label`; the drawn
 * bar is decorative.
 * Shown only while something is in flight: the host mounts it then and drops it
 * after. Reduced motion stills it (the global rule).
 */
export function ProgressLine({ label, className, testId }: ProgressLineProps) {
  return (
    <div
      data-testid={testId}
      className={cn('pointer-events-none h-0.5 overflow-hidden', className)}
    >
      <progress aria-label={label} className="sr-only" />
      <div
        aria-hidden="true"
        className="bg-primary h-full w-2/5 animate-[route-progress_1.1s_ease-in-out_infinite] rounded-e-full"
      />
    </div>
  );
}
