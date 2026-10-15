import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';

/** What one switch card shows and does. */
export interface RoleSwitchCardProps {
  /** The role's tone: the track's fill when on. */
  tone: Tone;
  on: boolean;
  /** Still pressable — the press says why it can't change (`aria-disabled`). */
  locked: boolean;
  label: string;
  /** The line under the label; none for a one-line card. */
  description?: string;
  /** A hover hint (a permission's clinozy-be code). */
  title?: string;
  onToggle: () => void;
  testId: string;
}

/**
 * One of a role page's switch cards (H:1137–1141): a 32 × 18px track in the
 * role's tone with a 14px knob (150ms), the label and its description. The
 * special permissions and the workspace permissions draw it.
 */
export function RoleSwitchCard({
  tone,
  on,
  locked,
  label,
  description,
  title,
  onToggle,
  testId,
}: RoleSwitchCardProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={locked || undefined}
      title={title}
      onClick={onToggle}
      data-testid={testId}
      className={cn(
        'bg-background hover:bg-canvas flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-start transition-colors',
        locked ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'relative mt-px h-4.5 w-8 flex-none rounded-full transition-colors duration-150',
          on ? TONE_CLASSES[tone].fill : 'bg-border',
        )}
      >
        <span
          data-slot="pill"
          className={cn(
            // Travels like the shared switch's thumb: 200ms on the strong ease-in-out.
            'bg-background absolute start-0.5 top-0.5 size-3.5 rounded-full shadow-xs transition-transform duration-200 ease-in-out',
            on && 'translate-x-3.5 rtl:-translate-x-3.5',
          )}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 leading-[1.35]">
        <span className="text-body leading-[1.35] font-semibold">{label}</span>
        {description ? (
          <span className="text-caption text-muted-foreground text-pretty">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
