import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { formatAppPhone, toAppPhone } from '@/shared/app/app-phone.ts';
import {
  PersonAvatar,
  personInitials,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import type {
  DrawerPeekItem,
  DrawerStep,
} from '@/shared/components/DrawerSteps/index.ts';
import {
  KIND_TINT,
  KIND_TONE,
} from '@/shared/components/PersonCard/ContactCard/contact-card.types.ts';
import type {
  ContactCardActions,
  ContactKind,
} from '@/shared/components/PersonCard/index.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';

import {
  CONTACT_CHANNEL_STYLES,
  CONTACT_EDITOR_KEYS,
  CONTACT_EDITOR_NS,
  CONTACT_EDITOR_TEST_ID,
} from './contact-editor.constants.ts';
import {
  ContactIdentityFields,
  type ContactLinkedNotice,
  ContactPreferenceFields,
} from './contact-editor-fields.tsx';
import {
  type ContactEditorValue,
  contactValueName,
  customPreferenceLabel,
  isPresetPreference,
} from './contact-editor-value.ts';

const K = CONTACT_EDITOR_KEYS;

/** The record the editor writes (D32: a lead or a patient — there is no Contact entity). */
export interface ContactEditorRecord {
  /** Tints the band (lav lead, sage patient) and names its pill. */
  kind: ContactKind;
  /** The record's own display id for the ID chip ("#2365"). */
  displayId: string;
}

/** Props of {@link ContactEditor}. */
export interface ContactEditorProps extends Pick<
  ContactCardActions,
  'onOpenPatientFile' | 'onNewLead' | 'onNewAppointment' | 'onNewPatient'
> {
  open: boolean;
  /** What it starts from, read each time it opens. */
  value: ContactEditorValue;
  /**
   * The record behind the contact; none for New lead's "New contact" (a
   * canvas band with "?", no ID chip, no actions).
   */
  record?: ContactEditorRecord | null;
  /** The contact came from an existing record (New lead's search): the notice and its Undo. */
  linked?: ContactLinkedNotice;
  /** "Done": the values as edited. The caller saves them, or keeps them in its form. */
  onDone: (value: ContactEditorValue) => void;
  /** ×, the backdrop or Esc: nothing is kept. */
  onClose: () => void;
  testId?: string;
}

/** The step the editor opens on. */
type EditorStep = 'identity' | 'preferences' | '';

/** The band's buttons the caller offers — "+ Patient" never for a patient. */
function bandButtons(actions: BandActions, isPatient: boolean) {
  return [
    { id: 'lead', label: PERSON_CARD_KEYS.newLead, run: actions.onNewLead },
    {
      id: 'appointment',
      label: PERSON_CARD_KEYS.newAppointment,
      run: actions.onNewAppointment,
    },
    {
      id: 'patient',
      label: PERSON_CARD_KEYS.newPatient,
      run: isPatient ? undefined : actions.onNewPatient,
    },
  ].flatMap((button) => (button.run ? [{ ...button, run: button.run }] : []));
}

/** What the band can do for a known contact. */
type BandActions = Pick<
  ContactEditorProps,
  'onOpenPatientFile' | 'onNewLead' | 'onNewAppointment' | 'onNewPatient'
>;

/**
 * The tinted band under the header (H:1967): the 48px avatar, the name as typed
 * ("New contact" until then; a patient's links to the file, "↗"), the kind pill,
 * and "+ Lead" · "+ Appointment" · "+ Patient" for a known contact — each
 * closes the editor first. The name reads in its own direction, as the contact
 * card's does.
 */
function ContactEditorBand({
  name,
  record,
  actions,
  onLeave,
  testId,
}: {
  name: string;
  record: ContactEditorRecord | null;
  actions: BandActions;
  onLeave: () => void;
  testId: string;
}) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const { t: tCard } = useTranslation(PERSON_CARD_NS);
  const typed = name.trim();
  const shown = typed || t(K.newContact);
  const isPatient = record?.kind === 'patient';
  // A new contact: "?" until a name is typed, then its initials and "Contact" (H:1967).
  const kind = record?.kind ?? (typed ? 'contact' : null);
  const leaveThen = (action: () => void) => () => {
    onLeave();
    action();
  };
  const buttons = record ? bandButtons(actions, isPatient) : [];
  const openFile = isPatient ? actions.onOpenPatientFile : undefined;

  return (
    <div
      data-testid={`${testId}-band`}
      className={cn(
        'grid flex-none grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-(--drawer-pad-x) py-3.5',
        record ? KIND_TINT[record.kind] : 'bg-canvas',
      )}
    >
      <PersonAvatar
        size="card"
        initials={kind ? personInitials(shown) : '?'}
        tone={record ? KIND_TONE[record.kind] : 'stone'}
        patient={isPatient}
      />
      <div className="flex min-w-0 flex-col gap-1">
        {openFile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={leaveThen(openFile)}
                className="text-title decoration-border-strong inline-flex max-w-full items-center gap-1 self-start text-start leading-[1.2] font-semibold underline underline-offset-3 hover:decoration-current"
              >
                <span dir="auto" className="[text-align:match-parent] wrap-anywhere">
                  {shown}
                </span>
                <span aria-hidden="true" className="text-body text-muted-foreground">
                  ↗
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{tCard(PERSON_CARD_KEYS.openPatientFile)}</TooltipContent>
          </Tooltip>
        ) : (
          <span
            dir="auto"
            className="text-title [text-align:match-parent] leading-[1.2] font-semibold wrap-anywhere"
          >
            {shown}
          </span>
        )}
        {kind ? (
          <span className="flex flex-wrap gap-1">
            <TonePill tone={record ? KIND_TONE[kind] : 'stone'} size="sm">
              {tCard(PERSON_CARD_KEYS.kind[kind])}
            </TonePill>
          </span>
        ) : null}
      </div>
      {buttons.length > 0 ? (
        // A phone gives the actions their own row: beside the name they crush it.
        <div className="flex flex-wrap gap-1.5 max-md:col-span-full">
          {buttons.map((button) => (
            <Button
              key={button.id}
              type="button"
              variant="outline"
              onClick={leaveThen(button.run)}
              data-testid={`${testId}-new-${button.id}`}
              className="h-8 rounded-lg px-2.5 text-xs whitespace-nowrap"
            >
              {tCard(button.label)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** What each collapsed step summarises: the values "Done" would keep. */
function useContactPeeks(draft: ContactEditorValue) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const phones = draft.phones.map((entry) => entry.digits).filter(Boolean);
  const handles = draft.instagram.map((handle) => handle.trim()).filter(Boolean);
  const identity: DrawerPeekItem[] = [
    { kind: 'value', label: t(K.firstName), value: draft.firstName.trim() },
    { kind: 'value', label: t(K.lastName), value: draft.lastName.trim() },
    {
      kind: 'value',
      label: t(K.mobiles),
      value: phones
        .map((digits) => formatAppPhone(toAppPhone(digits) ?? digits))
        .join(' · '),
    },
    {
      kind: 'value',
      label: tApp(APP_KEYS.channels.instagram),
      value: handles.join(' · '),
    },
    {
      kind: 'value',
      label: t(K.defaultChannel),
      value: tApp(APP_KEYS.channels[draft.defaultChannel]),
      tone: CONTACT_CHANNEL_STYLES[draft.defaultChannel].tone,
    },
  ];
  const preferences: DrawerPeekItem[] = [
    {
      kind: 'multi',
      label: t(K.steps.preferences),
      values: draft.preferences.map((preference) => ({
        label: isPresetPreference(preference)
          ? t(K.preferences[preference])
          : customPreferenceLabel(preference),
      })),
    },
  ];
  return { identity, preferences };
}

/**
 * One opening of the editor (keyed on its session): its own copy of the
 * values, kept only by "Done" — ×, the backdrop and Esc ask first when it was
 * edited (Q-P1).
 */
function ContactEditorPanel({
  open,
  value,
  record = null,
  linked,
  onDone,
  onClose,
  testId = CONTACT_EDITOR_TEST_ID,
  ...actions
}: ContactEditorProps) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const [draft, setDraft] = useState(value);
  const [step, setStep] = useState<EditorStep>('identity');
  // "+ Custom" is being typed: Esc leaves the field, not the editor.
  const [adding, setAdding] = useState(false);

  const name = contactValueName(draft);
  const peeks = useContactPeeks(draft);
  const steps: DrawerStep[] = [
    {
      id: 'identity',
      title: t(K.steps.identity),
      // Complete once named (H:4483) — the default channel alone is no answer.
      complete: draft.firstName.trim() !== '',
      peek: peeks.identity,
      content: (
        <ContactIdentityFields
          value={draft}
          onChange={setDraft}
          recordId={record?.displayId ?? null}
          linked={linked}
          testId={testId}
        />
      ),
    },
    {
      id: 'preferences',
      title: t(K.steps.preferences),
      peek: peeks.preferences,
      content: (
        <ContactPreferenceFields
          value={draft}
          onChange={setDraft}
          adding={adding}
          onAddingChange={setAdding}
          testId={testId}
        />
      ),
    },
  ];

  return (
    <TooltipProvider>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(K.title)}
        sub={t(K.sub)}
        largeTitle
        band={
          <ContactEditorBand
            name={name}
            record={record}
            actions={actions}
            onLeave={onClose}
            testId={testId}
          />
        }
        steps={steps}
        openStep={step}
        onOpenStepChange={(next) => setStep(next as EditorStep)}
        // The prototype's step circles are ink, not a section's tone (`accVM`).
        tone="stone"
        // Six fields, none heavy: the 560px drawer (`leads.md:22`).
        content={{ fieldCount: 6 }}
        closeStyle="form"
        stacked
        saveLabel={t(K.done)}
        onSave={() => onDone(draft)}
        saveTestId={`${testId}-done`}
        dirty={JSON.stringify(draft) !== JSON.stringify(value)}
        onEscapeKeyDown={(event) => {
          if (!adding) return;
          event.preventDefault();
          setAdding(false);
        }}
        testId={testId}
      />
    </TooltipProvider>
  );
}

/**
 * The contact editor (KICKOFF §6.3; `leads.md:22, 92–107, 152–164, 289–296`,
 * H:1963–1984) — one shared child drawer, opened from New lead's "New contact"
 * and from "Edit contact" on a contact card: the record drawer at 560px with
 * the form drawers' floating × (full screen on a phone), stacked ("Back").
 * "Edit contact", the tinted band, then two step cards — "Identity & reach"
 * and "Contact preferences" — and "Done", the only way anything is kept: ×,
 * the backdrop, Esc (which the prototype misses, D33) and "Back" close without
 * it, asking first once something was edited (Q-P1). Each opening starts from
 * `value` (`useDrawerSession`). The caller decides what Done does — save the
 * lead or patient now ("Contact updated · applies everywhere"), or carry the
 * contact back into New lead.
 */
export function ContactEditor(props: ContactEditorProps) {
  const { session } = useDrawerSession(props.open);
  return <ContactEditorPanel key={session} {...props} />;
}
