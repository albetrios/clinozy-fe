import type { ReactNode } from 'react';
import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';

import { translateFormMessage } from '@/lib/i18n/translate-form-message.ts';
import { cn } from '@/lib/utils.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { Label } from '@/shared/components/ui/label.tsx';

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  description?: string;
  className?: string;
  disabled?: boolean;
  children?: (field: {
    value: T[Path<T>];
    onChange: (...event: unknown[]) => void;
    onBlur: () => void;
    ref: React.Ref<HTMLInputElement>;
  }) => ReactNode;
}

function getDescribedBy(
  name: string,
  hasError: boolean,
  hasDescription: boolean,
): string | undefined {
  if (hasError) return `${name}-error`;
  if (hasDescription) return `${name}-desc`;
  return undefined;
}

/**
 * Reusable form field integrating react-hook-form Controller
 * with shadcn/ui Input + Label + error display.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = 'text',
  description,
  className,
  disabled,
  children,
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('space-y-2', className)}>
          <Label htmlFor={name} className={error ? 'text-destructive' : undefined}>
            {label}
          </Label>

          {children ? (
            children(field)
          ) : (
            <Input
              id={name}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              aria-invalid={!!error}
              aria-describedby={getDescribedBy(name, !!error, !!description)}
              {...field}
            />
          )}

          {description && !error && (
            <p id={`${name}-desc`} className="text-muted-foreground text-xs">
              {description}
            </p>
          )}

          {error && (
            <p id={`${name}-error`} className="text-destructive text-xs" role="alert">
              {translateFormMessage(error.message)}
            </p>
          )}
        </div>
      )}
    />
  );
}
