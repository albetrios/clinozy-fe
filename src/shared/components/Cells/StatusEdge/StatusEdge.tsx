import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';

/** Props for {@link StatusEdge}: the row's status tone, if any. */
export interface StatusEdgeProps {
  /**
   * The row's status tone (the edge takes its ink), `neutral` for a closed or
   * done row (`border`), or nothing — the edge stays transparent.
   */
  tone?: Tone | 'neutral' | null;
  className?: string;
}

/**
 * A row's 3px inline-start status edge (KICKOFF §3.1, `preset.md:192`; H:683,
 * H:4700). Put it first inside a `relative` row; the row keeps its own
 * inline-start padding after the edge.
 */
export function StatusEdge({ tone, className }: StatusEdgeProps) {
  if (!tone) return null;
  return (
    <span
      aria-hidden="true"
      data-slot="status-edge"
      data-tone={tone}
      className={cn(
        'pointer-events-none absolute inset-y-0 start-0 w-[3px]',
        tone === 'neutral' ? 'bg-border' : [TONE_CLASSES[tone].ink, 'bg-current'],
        className,
      )}
    />
  );
}
