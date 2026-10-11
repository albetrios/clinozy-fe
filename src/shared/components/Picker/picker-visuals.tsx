import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { AppIcon } from '@/shared/icons/index.ts';

/** A tone dot: 10px with a 3px halo in a row, a plain 8px dot in the trigger. */
export function PickerDot({
  tone,
  variant = 'row',
}: {
  tone: Tone;
  variant?: 'row' | 'trigger';
}) {
  const classes = TONE_CLASSES[tone];
  // Status dots (≤ 10px) stay round under every shape: an indicator, not a surface.
  const shape =
    variant === 'row' ? 'mx-0.75 size-2.5 rounded-full' : 'size-2 rounded-full';
  return (
    <span
      aria-hidden="true"
      className={cn('shrink-0', shape, classes.dot, variant === 'row' && classes.halo)}
    />
  );
}

/** A 24px tile in the tone with the option's 16px icon. */
export function PickerIconTile({ icon: Icon, tone }: { icon: AppIcon; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md',
        TONE_CLASSES[tone].surface,
      )}
    >
      <Icon className="size-4 text-current" />
    </span>
  );
}
