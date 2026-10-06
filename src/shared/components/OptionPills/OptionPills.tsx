import {
  appearanceChoiceActiveClassName,
  appearanceChoiceClassName,
  appearanceChoiceIdleClassName,
} from '@/lib/appearance-surface.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Compact label above a prefs control (shared by locale preference cards): a
 * drawer field's label — 12px/500 in the strong muted ink (`_patterns.md:34`).
 */
export function FieldLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground-strong text-xs leading-[normal] font-medium">
      {children}
    </p>
  );
}

/**
 * Exclusive option pills — fieldset + `aria-pressed` buttons for preference
 * catalogs (date format, hour cycle, number style, text direction, …).
 */
export function OptionPills<T extends string>({
  ariaLabel,
  value,
  options,
  labelFor,
  onPick,
  testPrefix,
}: {
  ariaLabel: string;
  value: T;
  options: readonly T[];
  labelFor: (id: T) => string;
  onPick: (id: T) => void;
  testPrefix: string;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{ariaLabel}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((id) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(id)}
              data-testid={`${testPrefix}-${id}`}
              data-slot="pill"
              className={cn(
                appearanceChoiceClassName,
                // A long label wraps inside its pill rather than squeezing the row.
                'h-auto min-h-7 max-w-full min-w-0 flex-none rounded-full py-1 text-center wrap-anywhere whitespace-normal',
                active ? appearanceChoiceActiveClassName : appearanceChoiceIdleClassName,
              )}
            >
              {labelFor(id)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
