import { type ComponentProps, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import { useVoiceField, VoiceField } from '@/shared/components/VoiceField/index.ts';
import { Zap } from '@/shared/icons/index.ts';

import { autoCapitalizeFirstLetter } from './auto-capitalize.ts';
import { DRAWER_INPUT_CLASS, DRAWER_TEXTAREA_CLASS } from './drawer-field-controls.ts';

/** Props for {@link DrawerInput}. */
export interface DrawerInputProps extends ComponentProps<'input'> {
  /**
   * Capitalise the first letter as typed (H:4515–4521). `false` for a value
   * that is not prose in any language — a handle, a code, an id.
   */
  capitalize?: boolean;
  /**
   * The small microphone at the field's end, shown while the field is in use — speak instead of
   * typing. Off by default: a prose line turns it on (a reason, a title, a note), never a name, a
   * code or a contact detail, where every letter has to be right.
   */
  dictation?: boolean;
  /** Take each spoken phrase instead of writing it in — a chip input adds it as chips. */
  onDictation?: (text: string) => void;
  /** With a microphone the field sits in a box: the box's place in its row (`min-w-0 flex-1`). */
  boxClassName?: string;
}

/** A drawer line with its microphone (`dictation`): the field in the common {@link VoiceField}. */
function DictatedDrawerInput({
  onDictation,
  boxClassName,
  className,
  ...props
}: Omit<DrawerInputProps, 'capitalize' | 'dictation'>) {
  const voice = useVoiceField({
    multiline: false,
    blocked: Boolean(props.disabled || props.readOnly),
    onPhrase: onDictation,
    testId: (props as { 'data-testid'?: string })['data-testid'],
  });
  return (
    <VoiceField voice={voice} className={boxClassName}>
      <Input
        {...voice.fieldProps}
        {...props}
        className={cn(DRAWER_INPUT_CLASS, className, voice.paddingClass)}
      />
    </VoiceField>
  );
}

/**
 * A drawer's text input: 36px, `rounded-lg`, 13.5px, and the first letter of a
 * name capitalised as it is typed — not a phone, an email or a number (pass
 * the matching `type` or `inputMode`), nor a value starting with "@". Takes
 * `react-hook-form`'s `register()` like the input it wraps. A prose line takes
 * speech too (`dictation`, feat-write-less-2026-10-14-oixr D18).
 */
export function DrawerInput({
  capitalize = true,
  dictation = false,
  onDictation,
  boxClassName,
  className,
  onChange,
  ...props
}: DrawerInputProps) {
  const handleChange: DrawerInputProps['onChange'] = (event) => {
    if (capitalize) autoCapitalizeFirstLetter(event.currentTarget);
    onChange?.(event);
  };
  if (dictation || onDictation) {
    return (
      <DictatedDrawerInput
        {...props}
        onDictation={onDictation}
        boxClassName={boxClassName}
        className={className}
        onChange={handleChange}
      />
    );
  }
  return (
    <Input
      {...props}
      className={cn(DRAWER_INPUT_CLASS, className)}
      onChange={handleChange}
    />
  );
}

/** A chip under a note field that writes its text into it (the check-in's last plan). */
interface DrawerTextSuggestion {
  /** Stable id — the chip's test-id suffix. */
  id: string;
  /** The chip's words ("Same plan as last time"). */
  label: string;
  /** What it writes into the field. */
  text: string;
}

/** Props for {@link DrawerTextarea}. */
export interface DrawerTextareaProps extends ComponentProps<'textarea'> {
  /** Capitalise the first letter as typed; a message's own field opts out by its label. */
  capitalize?: boolean;
  /**
   * The microphone in the field's corner — speak instead of typing (on by default; it shows only
   * where the browser recognises speech, and never on a read-only or disabled field).
   */
  dictation?: boolean;
  /** Chips under the field that write a text into it; a chip hides once it has been used. */
  suggestions?: readonly DrawerTextSuggestion[];
}

/** The suggestion chips under a note field; each hides once it has written its text. */
function TextSuggestionChips({
  suggestions,
  onPick,
  testId,
}: {
  suggestions: readonly DrawerTextSuggestion[];
  onPick: (text: string) => void;
  testId: string | undefined;
}) {
  const [used, setUsed] = useState<ReadonlySet<string>>(() => new Set());
  const offered = suggestions.filter(
    (suggestion) => suggestion.text.trim() && !used.has(suggestion.id),
  );
  if (offered.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {offered.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          title={suggestion.text}
          data-testid={testId ? `${testId}-suggestion-${suggestion.id}` : undefined}
          onClick={() => {
            onPick(suggestion.text);
            setUsed((current) => new Set(current).add(suggestion.id));
          }}
          data-slot="pill"
          className="text-foreground hover:bg-muted bg-background inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-medium transition-colors"
        >
          <Zap aria-hidden="true" className="size-3 flex-none" />
          <span className="truncate">{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A drawer's textarea (9px 10px, 13.5px / 1.45, vertical resize) with the same
 * first-letter capitalisation as {@link DrawerInput} — a message box is left alone.
 *
 * Every note field also takes speech (feat-write-less-2026-10-14-oixr): the common
 * {@link VoiceField} — a small microphone in its bottom inline-end corner where the browser
 * recognises speech, the live words and "Listening…" under it, spoken marks ("full stop", "new
 * line", "scratch that") and ⌘ / Ctrl ⇧ Space from inside it. `suggestions` add chips under it that
 * write their text the same way.
 */
export function DrawerTextarea({
  capitalize = true,
  dictation = true,
  suggestions,
  className,
  onChange,
  ...props
}: DrawerTextareaProps) {
  const testId = (props as { 'data-testid'?: string })['data-testid'];
  const voice = useVoiceField({
    enabled: dictation,
    multiline: true,
    blocked: Boolean(props.disabled || props.readOnly),
    testId,
  });
  return (
    <VoiceField
      voice={voice}
      after={
        suggestions?.length ? (
          <TextSuggestionChips
            suggestions={suggestions}
            onPick={voice.write}
            testId={testId}
          />
        ) : undefined
      }
    >
      <Textarea
        {...voice.fieldProps}
        {...props}
        className={cn(DRAWER_TEXTAREA_CLASS, className, voice.paddingClass)}
        onChange={(event) => {
          if (capitalize) autoCapitalizeFirstLetter(event.currentTarget);
          onChange?.(event);
        }}
      />
    </VoiceField>
  );
}
