import type * as React from 'react';

import { cn } from '@/lib/utils.ts';

/**
 * The one loader — every busy moment in the app draws this, from a button to a
 * hand-off screen. Local, not shadcn's Lucide `Spinner` (re-apply after a
 * shadcn refresh): the wordmark's "o" as a glyph — a faint ring in the text
 * colour, an arc turning around it and the `brand-mark` dot at rest in the
 * centre, on a 24-unit grid.
 *
 * - **It turns as a whole.** The ring and the dot are round about the centre,
 *   so only the arc is seen to move; the turn is index.css's, keyed on
 *   `data-slot="spinner"` (900ms, one tempo everywhere), and under reduced
 *   motion it slows to 2.4s rather than stopping — a loader that stands still
 *   reads as a hang.
 * - **It is decorative** (`aria-hidden`): every spinner here sits next to
 *   text, or inside a control or region that already reports it is busy
 *   (`aria-busy`, an `<output>`), so announcing the glyph would say it twice.
 *   A spinner with nothing around it belongs inside a translated status region.
 *
 * Size it with one `size-*` class (`cn()` replaces the default `size-4`);
 * colour it with `text-*`.
 */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      data-slot="spinner"
      className={cn('size-4 shrink-0', className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={3}
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="16 100"
        pathLength={100}
      />
      <circle cx="12" cy="12" r="3" className="fill-brand-mark" />
    </svg>
  );
}

export { Spinner };
