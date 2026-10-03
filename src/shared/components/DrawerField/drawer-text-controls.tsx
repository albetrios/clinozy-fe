import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';

import { autoCapitalizeFirstLetter } from './auto-capitalize.ts';
import { DRAWER_INPUT_CLASS, DRAWER_TEXTAREA_CLASS } from './drawer-field-controls.ts';

/** Props for {@link DrawerInput}. */
export interface DrawerInputProps extends ComponentProps<'input'> {
  /**
   * Capitalise the first letter as typed (H:4515–4521). `false` for a value
   * that is not prose in any language — a handle, a code, an id.
   */
  capitalize?: boolean;
}

/**
 * A drawer's text input: 36px, `rounded-lg`, 13.5px, and the first letter of a
 * name capitalised as it is typed — not a phone, an email or a number (pass
 * the matching `type` or `inputMode`), nor a value starting with "@". Takes
 * `react-hook-form`'s `register()` like the input it wraps.
 */
export function DrawerInput({
  capitalize = true,
  className,
  onChange,
  ...props
}: DrawerInputProps) {
  return (
    <Input
      {...props}
      className={cn(DRAWER_INPUT_CLASS, className)}
      onChange={(event) => {
        if (capitalize) autoCapitalizeFirstLetter(event.currentTarget);
        onChange?.(event);
      }}
    />
  );
}

/** Props for {@link DrawerTextarea}. */
export interface DrawerTextareaProps extends ComponentProps<'textarea'> {
  /** Capitalise the first letter as typed; a message's own field opts out by its label. */
  capitalize?: boolean;
}

/**
 * A drawer's textarea (9px 10px, 13.5px / 1.45, vertical resize) with the same
 * first-letter capitalisation as {@link DrawerInput} — a message box is left alone.
 */
export function DrawerTextarea({
  capitalize = true,
  className,
  onChange,
  ...props
}: DrawerTextareaProps) {
  return (
    <Textarea
      {...props}
      className={cn(DRAWER_TEXTAREA_CLASS, className)}
      onChange={(event) => {
        if (capitalize) autoCapitalizeFirstLetter(event.currentTarget);
        onChange?.(event);
      }}
    />
  );
}
