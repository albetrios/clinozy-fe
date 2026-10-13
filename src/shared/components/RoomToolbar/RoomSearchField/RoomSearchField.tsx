import { type Ref, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import { Label } from '@/shared/components/ui/label.tsx';
import { Search } from '@/shared/icons/index.ts';

/** Props for {@link RoomSearchField}. */
export interface RoomSearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** The input's accessible name ("Search patients"). */
  label: string;
  /**
   * `toolbar` — a room list's search: from `md` a 36px square while empty and
   * unfocused, open 200px (150–220; `wide` 220px, no upper bound). `fill` —
   * never folds, and fills its container (Settings' rail and lists).
   */
  layout?: 'toolbar' | 'fill';
  /** The open toolbar field's width (H:2133 for `wide`). */
  width?: 'default' | 'wide';
  /** The "/" key hint inside the open toolbar field (its owner wires the key). */
  keyHint?: boolean;
  maxLength?: number;
  /** Hover title on the field. */
  title?: string;
  /** Test id on the field. */
  testId?: string;
  /** Test id on the input itself. */
  inputTestId?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Placement classes (a toolbar's flex and order, a rail's surface). */
  className?: string;
}

/**
 * The search field of the design (KICKOFF §3.5 List toolbar; H:1087,
 * H:294–298): a 15px glyph, the 13.5px input and — in a toolbar — the "/"
 * hint; 40px on a phone, 36px from `md`; the focus ring on the field. Esc
 * leaves the field. Controlled and router-free: `RoomSearch` wires it to the
 * URL's `q`, Settings to its own lists.
 */
export function RoomSearchField({
  value,
  onValueChange,
  placeholder,
  label,
  layout = 'toolbar',
  width = 'default',
  keyHint = false,
  maxLength,
  title,
  testId,
  inputTestId,
  inputRef,
  className,
}: RoomSearchFieldProps) {
  const [focused, setFocused] = useState(false);
  const toolbar = layout === 'toolbar';
  const expanded = !toolbar || focused || value !== '';
  return (
    <Label
      data-slot="room-search"
      data-expanded={expanded}
      data-testid={testId}
      title={title}
      className={cn(
        // The Label's own weight and selection rule would reach the input (it inherits font).
        'border-border bg-background text-muted-foreground relative flex h-10 min-w-0 cursor-text items-center gap-2 rounded-lg border px-3 font-normal select-auto',
        'focus-within:border-disabled focus-within:ring-ring/50 focus-within:ring-[3px]',
        toolbar
          ? cn(
              '[transition:flex-basis_220ms_cubic-bezier(.2,.8,.2,1),max-width_220ms_cubic-bezier(.2,.8,.2,1),min-width_220ms_cubic-bezier(.2,.8,.2,1),background-color_120ms_ease]',
              'md:h-9 md:max-w-55 md:min-w-37.5 md:flex-[0_1_200px] md:px-2.5',
              width === 'wide' && 'md:max-w-none md:flex-[0_1_220px]',
            )
          : 'w-full md:h-9 md:px-2.5',
        // Folded to the 36px square (the hover fill and pointer as the design's, H:296).
        !expanded &&
          'hover:bg-muted cursor-pointer md:max-w-9 md:min-w-9 md:flex-[0_0_36px] md:justify-center md:px-0',
        className,
      )}
    >
      <Search aria-hidden="true" className="size-3.75 flex-none" />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        inputMode="search"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        data-testid={inputTestId}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur();
        }}
        className={cn(
          'text-field text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none',
          // Folded, the input stays focusable ("/", Tab) and a click on the square reaches it.
          !expanded && 'md:sr-only',
        )}
      />
      {/* The "/" key hint — the title says it for everyone else. */}
      {toolbar && keyHint ? (
        <span
          aria-hidden="true"
          className={cn(
            'border-border bg-canvas text-micro text-muted-foreground flex h-4.5 min-w-4.5 flex-none items-center justify-center rounded-sm border px-1 leading-none font-normal max-md:hidden',
            !expanded && 'md:hidden',
          )}
        >
          /
        </span>
      ) : null}
    </Label>
  );
}
