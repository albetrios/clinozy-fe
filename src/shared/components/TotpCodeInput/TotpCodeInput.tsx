import { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';

import { cn } from '@/lib/utils.ts';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/shared/components/ui/input-otp.tsx';

export interface TotpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  testId?: string;
  'aria-label'?: string;
  /** When true, plays a brief shake animation (e.g. after a wrong code). */
  shake?: boolean;
  /** `numeric` for TOTP/MFA; `alphanumeric` for passwordless email sign-in codes. */
  charset?: 'numeric' | 'alphanumeric';
}

/**
 * Six-character OTP entry — shadcn Input OTP with 3+3 grouping, paste support,
 * and optional auto-submit via {@link onComplete}.
 */
export function TotpCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  id,
  className,
  testId = 'totp-code',
  'aria-label': ariaLabel,
  shake,
  charset = 'numeric',
}: TotpCodeInputProps) {
  const pattern =
    charset === 'alphanumeric' ? REGEXP_ONLY_DIGITS_AND_CHARS : REGEXP_ONLY_DIGITS;
  const inputMode = charset === 'alphanumeric' ? 'text' : 'numeric';

  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      inputMode={inputMode}
      autoComplete="one-time-code"
      pattern={pattern}
      aria-label={ariaLabel}
      data-testid={testId}
      containerClassName={cn('justify-center', shake && 'animate-otp-shake', className)}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} aria-invalid={invalid} />
        <InputOTPSlot index={1} aria-invalid={invalid} />
        <InputOTPSlot index={2} aria-invalid={invalid} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} aria-invalid={invalid} />
        <InputOTPSlot index={4} aria-invalid={invalid} />
        <InputOTPSlot index={5} aria-invalid={invalid} />
      </InputOTPGroup>
    </InputOTP>
  );
}
