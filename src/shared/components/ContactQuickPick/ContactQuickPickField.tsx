import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { ContactHit } from '@/shared/api/app/contacts-contracts.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import {
  PICKER_KEYS,
  PICKER_NS,
  PickerSheet,
  PickerTrigger,
  PickerTriggerClear,
} from '@/shared/components/Picker/index.ts';
import { PickerValue } from '@/shared/components/Picker/PickerTrigger/index.ts';

import type { QuickAddDraft } from './contact-quick-pick-query.ts';
import { ContactQuickPick, type ContactQuickPickProps } from './ContactQuickPick.tsx';

/** The person a {@link ContactQuickPickField} holds, as its trigger draws them. */
export interface ContactQuickPickFieldValue {
  /** The key the trigger's option carries — the contact's id, or the patient file's. */
  key: string;
  name: string;
  tone: Tone;
  /** The avatar's "P" badge. */
  patient?: boolean;
}

/** Props for {@link ContactQuickPickField}. */
export interface ContactQuickPickFieldProps extends Omit<
  ContactQuickPickProps,
  'toolbar' | 'inputRef' | 'onMoreDetails' | 'className' | 'testId'
> {
  /** The person picked — or added — so far. */
  value: ContactQuickPickFieldValue | null;
  /** The trigger's text with no one picked ("Pick a person"). */
  placeholder: string;
  /** The panel's name, and the trigger's ("For"). */
  title: string;
  /** Show a clear × while someone is picked. */
  onClear?: () => void;
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  /**
   * The trigger's test id; the panel is `<testId>-panel`, the clear × `<testId>-clear` and the
   * picker's own ids start from it (the Picker's ids, kept for the fields it replaced).
   */
  testId: string;
}

/**
 * {@link ContactQuickPick} behind a form field (change-contact-quick-pick D22): the same search,
 * Recent, ↵-first-row and inline quick add, in a popover from the field — a sheet on a phone
 * (`PickerSheet`) — for a person field among others (New task's "For"). The field draws the
 * picked person on their avatar chip, as a Picker does; a pick closes the panel and hands the
 * person on, a quick add once the host has taken them (a patient registered).
 */
export function ContactQuickPickField({
  value,
  placeholder,
  title,
  onClear,
  id,
  invalid,
  disabled,
  testId,
  onPick,
  onQuickAdd,
  ...rest
}: ContactQuickPickFieldProps) {
  const { t } = useTranslation(PICKER_NS);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = (hit: ContactHit) => {
    setOpen(false);
    onPick(hit);
  };
  // A quick add closes the panel once it is done — a patient registered — and not if it failed.
  const quickAdd = async (draft: QuickAddDraft) => {
    await onQuickAdd(draft);
    setOpen(false);
  };
  const selected = value
    ? [
        {
          key: value.key,
          label: value.name,
          tone: value.tone,
          leading: {
            kind: 'avatar' as const,
            initials: personInitials(value.name),
            patient: value.patient,
          },
        },
      ]
    : [];
  const showClear = Boolean(onClear) && value !== null && !disabled;
  // "For · Kavya Mehta" once someone is picked, "For · <placeholder>" before — the Picker's
  // trigger words (`picker.triggerLabel`): the name holds what the trigger shows (WCAG 2.5.3).
  const triggerLabel = t(PICKER_KEYS.triggerLabel, {
    label: title,
    value: value ? value.name : placeholder,
  });

  return (
    <div className="relative min-w-0">
      <PickerSheet
        open={open}
        onOpenChange={setOpen}
        trigger={
          <PickerTrigger
            id={id}
            inset={value ? 'avatar' : 'default'}
            reserveClear={showClear}
            disabled={disabled}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={rest['aria-describedby']}
            aria-label={triggerLabel}
            title={triggerLabel}
            data-testid={testId}
          >
            <PickerValue
              selected={selected}
              multiple={false}
              size="md"
              placeholder={placeholder}
              maxChips={1}
            />
          </PickerTrigger>
        }
        title={title}
        panelClassName="w-(--radix-popover-trigger-width) max-w-md min-w-90"
        onOpenAutoFocus={() => inputRef.current?.focus()}
        testId={`${testId}-panel`}
      >
        <ContactQuickPick
          {...rest}
          inputRef={inputRef}
          disabled={disabled}
          onPick={pick}
          onQuickAdd={quickAdd}
          testId={testId}
          className="rounded-none border-0"
        />
      </PickerSheet>
      {showClear && onClear ? (
        <PickerTriggerClear
          label={t(PICKER_KEYS.clear)}
          onClear={onClear}
          testId={`${testId}-clear`}
        />
      ) : null}
    </div>
  );
}
