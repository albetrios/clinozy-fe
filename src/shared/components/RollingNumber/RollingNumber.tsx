import './rolling-number.css';

import { useState } from 'react';

import { cn } from '@/lib/utils.ts';

/** One change of value: the number that left and which way the digits roll. */
interface Roll {
  value: number;
  /** The value that is leaving, written; null once it has left (or never rolled). */
  leaving: string | null;
  direction: 'up' | 'down';
  /** Counts the rolls; 0 — the first paint — rolls nothing. Keys the layers. */
  turn: number;
  /** The previous render's `still`: a roll needs this render AND that one to move. */
  still: boolean;
}

/** Props for {@link RollingNumber}. */
export interface RollingNumberProps {
  value: number;
  /** How the number is written — the locale's digits (`useLocaleFormat().formatNumber`). */
  format?: (value: number) => string;
  /**
   * While true, a change lands without rolling — the screen is still loading,
   * so the number is arriving, not changing. The render after it turns false
   * still lands at once: the first answer never rolls up from a placeholder.
   */
  still?: boolean;
  className?: string;
}

/**
 * A number that rolls to its next value (change-motion-polish D10): when it
 * changes, the old value leaves and the new one arrives — upward when it grew,
 * downward when it shrank — 280ms on the strong ease-out with a 2px blur
 * (`rolling-number.css`), so a live count says WHICH way it moved. The first
 * paint rolls nothing, and neither does a change while {@link
 * RollingNumberProps.still}. The leaving value is drawn by CSS from
 * `data-value` — never text, so the number's text is always just its value —
 * and goes when its animation ends; under reduced motion that is at once (the
 * app's rule cuts every animation short). Both share one grid cell, clipped to
 * the line, so nothing beside the number moves.
 */
export function RollingNumber({
  value,
  format = String,
  still = false,
  className,
}: RollingNumberProps) {
  const [roll, setRoll] = useState<Roll>({
    value,
    leaving: null,
    direction: 'up',
    turn: 0,
    still,
  });
  // Storing what the previous render showed (react.dev: "you might not need an effect").
  if (roll.value !== value) {
    const rolls = !(still || roll.still);
    setRoll({
      value,
      leaving: rolls ? format(roll.value) : null,
      direction: value > roll.value ? 'up' : 'down',
      turn: rolls ? roll.turn + 1 : roll.turn,
      still,
    });
  } else if (roll.still !== still) {
    setRoll({ ...roll, still });
  }
  const rolled = roll.turn > 0;
  const { turn } = roll;

  return (
    <span
      data-slot="rolling-number"
      data-roll={rolled ? roll.direction : undefined}
      className={cn('tabular-nums', className)}
    >
      <span key={`in-${turn}`} data-roll-layer={rolled ? 'in' : undefined}>
        {format(value)}
      </span>
      {roll.leaving === null ? null : (
        <span
          key={`out-${turn}`}
          aria-hidden="true"
          data-roll-layer="out"
          data-value={roll.leaving}
          ref={(node) => {
            if (!node) return;
            const left = () =>
              setRoll((current) =>
                current.turn === turn ? { ...current, leaving: null } : current,
              );
            node.addEventListener('animationend', left);
            return () => node.removeEventListener('animationend', left);
          }}
        />
      )}
    </span>
  );
}
