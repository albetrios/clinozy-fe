import { type KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { copyText } from '@/lib/sensitive-clipboard.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  CONTACT_CHANNELS,
  type ContactChannel,
} from '@/shared/api/app/contacts-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { formatAppPhone, toAppPhone } from '@/shared/app/app-phone.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerInput,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  type AppIcon,
  Copy,
  InstagramMark,
  Phone,
  WhatsAppMark,
  X,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { CONTACT_EDITOR_KEYS, CONTACT_EDITOR_NS } from './contact-editor.constants.ts';
import {
  CONTACT_HANDLE_MAX,
  CONTACT_NAME_MAX,
  CONTACT_PREFERENCE_MAX,
  CONTACT_PREFERENCE_PRESETS,
  CONTACT_REACH_MAX,
  type ContactEditorValue,
  customPreferenceLabel,
  isPresetPreference,
  withCustomPreference,
  withPrimaryPhone,
} from './contact-editor-value.ts';

const K = CONTACT_EDITOR_KEYS;

/**
 * The default channel chips (`CHS`, H:3362): WhatsApp sage · Call sky · Instagram blush — the
 * design's SMS has no channel on clinozy-be (route map §4 #8).
 */
const CHANNELS: Readonly<Record<ContactChannel, { tone: Tone; icon: AppIcon }>> = {
  whatsapp: { tone: 'sage', icon: WhatsAppMark },
  call: { tone: 'sky', icon: Phone },
  instagram: { tone: 'blush', icon: InstagramMark },
};

/** A 32px dashed "add" button (H:1973, H:1978): the outline `Button` at 13px/400. */
const ADD_BUTTON =
  'bg-card hover:bg-muted border-border-strong gap-1.25 self-start border-dashed px-2.5 font-normal shadow-none';

/** A 32px "×" beside a number or a handle, on the outline `Button`. */
const REMOVE_BUTTON =
  'bg-card text-muted-foreground hover:bg-muted hover:text-foreground shadow-none';

/**
 * A list's row numbers, 1…n. Rows here are positions — a number or a handle
 * being typed has no other identity, and the primary is always the first —
 * so each row keys by its ordinal.
 */
function ordinalsOf(rows: readonly unknown[]): number[] {
  return rows.map((_, at) => at + 1);
}

/** What both steps read and write. */
interface ContactStepProps {
  value: ContactEditorValue;
  onChange: (next: ContactEditorValue) => void;
  testId: string;
}

/**
 * The ID chip (H:1969): the record's own id to copy (D32), and the help beside
 * it. The id always reads left to right; the copy glyph keeps the page's side.
 */
function ContactIdRow({ recordId, testId }: { recordId: string | null; testId: string }) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const copy = async () => {
    if (!recordId) return;
    // A blocked clipboard copies nothing; the id stays on screen to read.
    if (await copyText(recordId)) {
      notify.success(t(K.idCopied, { id: isolateText(recordId, 'ltr') }));
    }
  };
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      {recordId ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={t(K.idAria, { id: recordId })}
              data-testid={`${testId}-id`}
              className="group/copy bg-muted text-muted-foreground-strong hover:bg-muted-strong text-caption inline-flex h-8 items-center gap-1.25 rounded-lg border px-2.25 font-mono font-medium"
            >
              <span dir="ltr">{recordId}</span>
              <Copy
                aria-hidden="true"
                className="size-3 opacity-0 transition-opacity duration-150 group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t(K.idTooltip)}</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="text-muted-foreground text-micro">{t(K.idHelp)}</span>
    </div>
  );
}

/** One number's row (H:1972): the "+91" field, ★ Primary / ☆ Set primary, WhatsApp, ×. */
function PhoneRow({
  value,
  index,
  onChange,
  testId,
}: ContactStepProps & { index: number }) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const row = value.phones[index];
  if (!row) return null;
  const primary = index === 0;
  const n = index + 1;
  const setPhones = (phones: ContactEditorValue['phones']) =>
    onChange({ ...value, phones });
  const makePrimary = () => {
    if (primary) return;
    setPhones(withPrimaryPhone(value.phones, index));
    const stored = toAppPhone(row.digits);
    notify.success(
      t(K.primaryChanged, { number: stored ? formatAppPhone(stored) : row.digits }),
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DrawerPhoneInput
        value={row.digits}
        onChange={(digits) =>
          setPhones(
            value.phones.map((entry, at) =>
              at === index ? { ...entry, digits } : entry,
            ),
          )
        }
        aria-label={t(K.mobileAria, { n })}
        placeholder="98250 11241"
        data-testid={`${testId}-mobile-${n}`}
        className="min-w-40 flex-1"
      />
      {/* The row's buttons wrap together under a narrow number field. */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={primary}
          title={t(primary ? K.primaryTitle : K.setPrimaryTitle)}
          onClick={makePrimary}
          data-testid={`${testId}-primary-${n}`}
          className={cn(
            'flex h-9 flex-none items-center gap-1.25 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap',
            primary
              ? 'bg-foreground text-background border-foreground'
              : 'bg-card text-foreground-soft hover:bg-muted',
          )}
        >
          <span aria-hidden="true" className="text-body leading-none">
            {primary ? '★' : '☆'}
          </span>
          {t(primary ? K.primary : K.setPrimary)}
        </button>
        <button // NOSONAR(S6819): styled-button toggle; a native checkbox input cannot hold this chip
          type="button"
          role="checkbox"
          aria-checked={row.whatsapp}
          title={t(row.whatsapp ? K.whatsAppOn : K.whatsAppOff)}
          onClick={() =>
            setPhones(
              value.phones.map((entry, at) =>
                at === index ? { ...entry, whatsapp: !entry.whatsapp } : entry,
              ),
            )
          }
          data-testid={`${testId}-whatsapp-${n}`}
          className={cn(
            'flex h-9 flex-none items-center gap-1.5 rounded-lg border ps-2 pe-2.5 text-xs font-medium whitespace-nowrap transition-colors',
            row.whatsapp
              ? cn(TONE_CLASSES.sage.surface, 'border-current')
              : 'bg-card text-muted-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'text-tiny flex size-4 items-center justify-center rounded-md border-[1.5px] font-bold',
              row.whatsapp
                ? 'bg-tone-sage-foreground border-tone-sage-foreground text-background'
                : 'border-border-strong bg-card',
            )}
          >
            {row.whatsapp ? '✓' : null}
          </span>
          <WhatsAppMark aria-hidden="true" className="size-3" />
          {tApp(APP_KEYS.channels.whatsapp)}
        </button>
        {value.phones.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t(K.removeNumber)}
            title={t(K.removeNumber)}
            onClick={() => setPhones(value.phones.filter((_, at) => at !== index))}
            data-testid={`${testId}-remove-number-${n}`}
            className={REMOVE_BUTTON}
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** The Instagram rows (H:1976–1978): "@handle" ≤ 30, "×" on each, "+ Add handle". */
function HandleRows({ value, onChange, testId }: ContactStepProps) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const labelId = useId();
  const setHandles = (instagram: string[]) => onChange({ ...value, instagram });
  const remove = (index: number) => {
    const handle = value.instagram[index]?.trim();
    setHandles(value.instagram.filter((_, at) => at !== index));
    if (handle) notify.success(t(K.handleRemoved, { handle }));
  };
  return (
    <fieldset aria-labelledby={labelId} className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-muted-foreground-strong text-xs font-medium">
        {tApp(APP_KEYS.channels.instagram)}
      </span>
      {ordinalsOf(value.instagram).map((n) => {
        const index = n - 1;
        const handle = value.instagram[index] ?? '';
        return (
          <div key={n} className="flex items-center gap-1.5">
            <DrawerInput
              capitalize={false}
              value={handle}
              maxLength={CONTACT_HANDLE_MAX}
              placeholder={t(K.handlePlaceholder)}
              aria-label={t(K.handleAria, { n: index + 1 })}
              onChange={(event) =>
                setHandles(
                  value.instagram.map((entry, at) =>
                    at === index ? event.target.value : entry,
                  ),
                )
              }
              data-testid={`${testId}-handle-${index + 1}`}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t(K.removeHandle)}
              title={t(K.removeHandleTitle)}
              onClick={() => remove(index)}
              className={REMOVE_BUTTON}
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        );
      })}
      {value.instagram.length < CONTACT_REACH_MAX ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setHandles([...value.instagram, ''])}
          data-testid={`${testId}-add-handle`}
          className={ADD_BUTTON}
        >
          {t(K.addHandle)}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** "Linked to <name> · <kind> · channels and preferences reused" with Undo (H:1981). */
export interface ContactLinkedNotice {
  text: string;
  onUndo: () => void;
}

/**
 * Step 1, "Identity & reach" (`leads.md:96–100`, H:1968–1982): the ID chip,
 * Name, the mobile rows with "+ Add number" and "+ Instagram", the default
 * channel, the Instagram rows, and the linked notice when the contact came from
 * an existing record.
 */
export function ContactIdentityFields({
  value,
  onChange,
  recordId,
  linked,
  testId,
}: ContactStepProps & { recordId: string | null; linked?: ContactLinkedNotice }) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const nameId = useId();
  const lastNameId = useId();
  const mobilesId = useId();
  const channelId = useId();
  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <ContactIdRow recordId={recordId} testId={testId} />
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <DrawerField label={t(K.firstName)} htmlFor={nameId} required>
            <DrawerInput
              id={nameId}
              value={value.firstName}
              maxLength={CONTACT_NAME_MAX}
              placeholder={t(K.firstNamePlaceholder)}
              autoComplete="off"
              onChange={(event) => onChange({ ...value, firstName: event.target.value })}
              required
              aria-required="true"
              data-testid={`${testId}-first-name`}
            />
          </DrawerField>
          <DrawerField label={t(K.lastName)} htmlFor={lastNameId}>
            <DrawerInput
              id={lastNameId}
              value={value.lastName}
              maxLength={CONTACT_NAME_MAX}
              placeholder={t(K.lastNamePlaceholder)}
              autoComplete="off"
              onChange={(event) => onChange({ ...value, lastName: event.target.value })}
              data-testid={`${testId}-last-name`}
            />
          </DrawerField>
        </div>
        <fieldset aria-labelledby={mobilesId} className="flex min-w-0 flex-col gap-1.5">
          <span
            id={mobilesId}
            className="text-muted-foreground-strong text-xs font-medium"
          >
            {t(K.mobiles)}
          </span>
          {ordinalsOf(value.phones).map((n) => (
            <PhoneRow
              key={n}
              value={value}
              index={n - 1}
              onChange={onChange}
              testId={testId}
            />
          ))}
          <div className="flex flex-wrap gap-1.5">
            {value.phones.length < CONTACT_REACH_MAX ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    phones: [...value.phones, { digits: '', whatsapp: true }],
                  })
                }
                data-testid={`${testId}-add-number`}
                className={ADD_BUTTON}
              >
                {t(K.addNumber)}
              </Button>
            ) : null}
            {value.instagram.length === 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...value, instagram: [''] })}
                data-testid={`${testId}-add-instagram`}
                className={cn(
                  ADD_BUTTON,
                  'hover:text-tone-blush-foreground text-xs',
                  TONE_CLASSES.blush.ink,
                )}
              >
                <InstagramMark aria-hidden="true" className="size-3" />
                {t(K.addInstagram)}
              </Button>
            ) : null}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <span
            id={channelId}
            className="text-muted-foreground-strong text-xs font-medium"
          >
            {t(K.defaultChannel)}{' '}
            <span className="text-muted-foreground font-normal">
              {t(K.defaultChannelHint)}
            </span>
          </span>
          <DrawerChips
            variant="button"
            label={t(K.defaultChannel)}
            options={CONTACT_CHANNELS.map((channel) => ({
              value: channel,
              label: tApp(APP_KEYS.channels[channel]),
              tone: CHANNELS[channel].tone,
              icon: CHANNELS[channel].icon,
            }))}
            value={value.defaultChannel}
            onChange={(channel) => {
              if (channel) onChange({ ...value, defaultChannel: channel });
            }}
            testId={`${testId}-channel`}
          />
        </div>
        {value.instagram.length > 0 ? (
          <HandleRows value={value} onChange={onChange} testId={testId} />
        ) : null}
      </div>
      {linked ? (
        <div
          data-testid={`${testId}-linked`}
          className={cn(
            'text-detail flex items-center gap-2.5 rounded-lg border px-3 py-2.25',
            TONE_CLASSES.sage.surface,
            TONE_CLASSES.sage.border,
          )}
        >
          <span className="min-w-0 flex-1">{linked.text}</span>
          <button
            type="button"
            onClick={linked.onUndo}
            className="text-xs underline underline-offset-2"
          >
            {tErrors(ERRORS_KEYS.toast.undo)}
          </button>
        </div>
      ) : null}
    </>
  );
}

/** The custom field opens on its button's press: focus follows it there. */
function focusOnMount(node: HTMLInputElement | null) {
  node?.focus();
}

/**
 * Step 2, "Contact preferences" (`leads.md:101`, H:1982): the twelve presets
 * and the custom ones as outline chips, then "+ Custom" — a 28px field ("Type a
 * preference", ≤ 40) that adds a tag on Enter or blur, duplicates ignored, twelve
 * at most; Esc leaves it (the editor's Esc waits while it is open — `adding`).
 */
export function ContactPreferenceFields({
  value,
  onChange,
  adding,
  onAddingChange,
  testId,
}: ContactStepProps & { adding: boolean; onAddingChange: (adding: boolean) => void }) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const [typed, setTyped] = useState('');
  const labelId = useId();
  const customs = value.preferences.filter(
    (preference) => !isPresetPreference(preference),
  );
  const options = [
    ...CONTACT_PREFERENCE_PRESETS.map((preset) => ({
      value: preset as string,
      label: t(K.preferences[preset]),
    })),
    ...customs.map((custom) => ({ value: custom, label: customPreferenceLabel(custom) })),
  ];
  const picks = options
    .filter((option) => value.preferences.includes(option.value))
    .map((option) => option.value);

  const commit = () => {
    onChange({ ...value, preferences: withCustomPreference(value.preferences, typed) });
    setTyped('');
    onAddingChange(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      setTyped('');
      onAddingChange(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-muted-foreground-strong text-xs font-medium">
        {t(K.steps.preferences)}
      </span>
      <DrawerChips
        multiple
        variant="outline"
        label={t(K.steps.preferences)}
        options={options}
        value={picks}
        // Kept picks in the chips' order; a custom one dropped is gone.
        onChange={(next) => onChange({ ...value, preferences: next })}
        testId={`${testId}-preferences`}
        className="gap-1.25"
        trailing={
          adding ? (
            <input
              ref={focusOnMount}
              value={typed}
              maxLength={CONTACT_PREFERENCE_MAX}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={onKeyDown}
              onBlur={commit}
              placeholder={t(K.customPlaceholder)}
              aria-label={t(K.customAria)}
              data-testid={`${testId}-custom-input`}
              data-slot="pill"
              className="border-foreground bg-card placeholder:text-muted-foreground h-7 w-40 rounded-full border px-2.75 text-xs outline-none"
            />
          ) : (
            <button
              type="button"
              data-slot="pill"
              onClick={() => onAddingChange(true)}
              data-testid={`${testId}-custom`}
              className="bg-card text-foreground-soft hover:bg-muted border-disabled h-6 rounded-full border border-dashed px-2.5 text-xs font-medium whitespace-nowrap"
            >
              {t(K.custom)}
            </button>
          )
        }
      />
    </div>
  );
}
