import { type ReactNode, type Ref, useId } from 'react';

import { cn } from '@/lib/utils.ts';
import { Switch } from '@/shared/components/ui/switch.tsx';

/** Props for {@link ConsentCategoryRow}. */
export interface ConsentCategoryRowProps {
  /** The category's name ("Necessary", "Analytics") — the switch's accessible name. */
  title: string;
  /** What the category enables — the switch's description. */
  description: string;
  /** The visible state beside the switch: "Required", "On" or "Off". */
  status: string;
  checked: boolean;
  /** Locked: a required category, or Analytics under Global Privacy Control. */
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Row test id; the switch is `<testId>-switch`. */
  testId: string;
  /** The switch, for moving focus to it. */
  switchRef?: Ref<HTMLButtonElement>;
  /** An extra line under the description (Settings: when the answer was saved). */
  footer?: ReactNode;
}

/**
 * One cookie category — claude.com's option row: name and what it enables on the start side,
 * the state ("Required" / "On" / "Off") and its switch on the end side, on a muted tile. The name
 * is the switch's label, so a tap on it toggles too (a locked row does nothing). Shared by
 * the consent card's Customize view and Settings › Account › Privacy, so both say the same thing.
 */
export function ConsentCategoryRow({
  title,
  description,
  status,
  checked,
  disabled = false,
  onCheckedChange,
  testId,
  switchRef,
  footer,
}: ConsentCategoryRowProps) {
  const switchId = useId();
  const titleId = useId();
  const descriptionId = useId();
  return (
    <div
      data-testid={testId}
      className="bg-muted flex items-center justify-between gap-4 rounded-lg p-3"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <label
          id={titleId}
          htmlFor={switchId}
          className={cn(
            'block text-sm leading-5 font-medium',
            disabled ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          {title}
        </label>
        <p id={descriptionId} className="text-muted-foreground text-xs leading-[1.45]">
          {description}
        </p>
        {footer}
      </div>
      <span className="flex flex-none items-center gap-2">
        <span className="text-xs font-medium" aria-hidden="true">
          {status}
        </span>
        <Switch
          id={switchId}
          ref={switchRef}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-testid={`${testId}-switch`}
        />
      </span>
    </div>
  );
}
