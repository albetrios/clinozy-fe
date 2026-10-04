import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils.ts';
import {
  CLINIC_PHONE_PREFIX,
  clinicPhoneDigits,
  formatClinicPhoneDigits,
} from '@/shared/clinic/clinic-phone-field.ts';

/** Props for {@link DrawerPhoneInput}. */
export interface DrawerPhoneInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode'
> {
  /** The mobile's digits, at most ten (`9876543210`). */
  value: string;
  onChange: (digits: string) => void;
}

/**
 * The frame the stock input draws, around the prefix box and the field: 36px,
 * `rounded-lg`, the focus ring and the invalid outline on the whole.
 */
const FRAME_CLASS = cn(
  'border-input flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-lg border bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30',
  'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
  'has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-destructive/20 dark:has-[input[aria-invalid=true]]:ring-destructive/40',
  'has-[input:disabled]:opacity-50',
);

/**
 * A clinic mobile field (H:897, H:3761): a muted "+91" box, then the digits —
 * numbers only, at most ten, shown "98765 43210" as they are typed; a pasted
 * `+91 98765-43210` keeps its ten digits. `onChange` hands back the digits.
 */
export function DrawerPhoneInput({
  value,
  onChange,
  className,
  placeholder = '98765 43210',
  ...props
}: DrawerPhoneInputProps) {
  return (
    <div className={cn(FRAME_CLASS, className)}>
      <span
        aria-hidden="true"
        className="bg-muted text-body text-muted-foreground-strong flex shrink-0 items-center border-e px-2.5"
      >
        {CLINIC_PHONE_PREFIX}
      </span>
      <input
        {...props}
        type="tel"
        inputMode="numeric"
        autoComplete={props.autoComplete ?? 'tel-national'}
        // No `maxLength`: the browser would cut a pasted "+91 98765-43210"
        // before the country code could be dropped; the digits cap at ten.
        placeholder={placeholder}
        value={formatClinicPhoneDigits(value)}
        onChange={(event) => onChange(clinicPhoneDigits(event.currentTarget.value))}
        className="text-field md:text-field placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
