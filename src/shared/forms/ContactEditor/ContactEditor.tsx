import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  PersonAvatar,
  personInitials,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { type DrawerStep, DrawerSteps } from '@/shared/components/DrawerSteps/index.ts';
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
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { X } from '@/shared/icons/index.ts';

import {
  CONTACT_EDITOR_KEYS,
  CONTACT_EDITOR_NS,
  CONTACT_EDITOR_TEST_ID,
} from './contact-editor.constants.ts';
import {
  ContactIdentityFields,
  type ContactLinkedNotice,
  ContactPreferenceFields,
} from './contact-editor-fields.tsx';
import type { ContactEditorValue } from './contact-editor-value.ts';

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
 * closes the editor first.
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
                <span className="wrap-anywhere">{shown}</span>
                <span aria-hidden="true" className="text-body text-muted-foreground">
                  ↗
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{tCard(PERSON_CARD_KEYS.openPatientFile)}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-title leading-[1.2] font-semibold wrap-anywhere">
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

/** One opening of the editor: its own copy of the values, so ×, backdrop and Esc keep nothing. */
function ContactEditorPanel({
  value,
  record = null,
  linked,
  onDone,
  onClose,
  testId = CONTACT_EDITOR_TEST_ID,
  ...actions
}: Omit<ContactEditorProps, 'open'>) {
  const { t } = useTranslation(CONTACT_EDITOR_NS);
  const { t: tLocale } = useTranslation(LOCALE_NS);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState(value);
  const [step, setStep] = useState<EditorStep>('identity');
  // "+ Custom" is being typed: Esc leaves the field, not the editor.
  const [adding, setAdding] = useState(false);

  const steps: DrawerStep[] = [
    {
      id: 'identity',
      title: t(K.steps.identity),
      // Collapsed, the card names the contact; green once it has a name (H:4483, `accVM`).
      summary: step === 'identity' ? undefined : draft.name.trim() || undefined,
      complete: draft.name.trim() !== '',
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
    <SheetContent
      side="end"
      showCloseButton={false}
      overlayClassName="bg-overlay/35 data-[state=open]:animate-backdrop-in data-[state=closed]:animate-none"
      data-testid={testId}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        titleRef.current?.focus();
      }}
      onEscapeKeyDown={(event) => {
        if (!adding) return;
        event.preventDefault();
        setAdding(false);
      }}
      className="data-[state=open]:animate-drawer-in w-[min(35rem,calc(100vw-2.875rem))] max-w-none gap-0 outline-none data-[state=closed]:animate-none sm:max-w-none"
    >
      <TooltipProvider>
        {/* The ×: 36px, 10px outside the inline-start edge — on a phone too,
            in the 46px the panel leaves (H:1965, `leads.md:22`). */}
        <button
          type="button"
          onClick={onClose}
          aria-label={tLocale(LOCALE_KEYS.closeAria)}
          data-testid={`${testId}-close`}
          data-slot="floating-edge"
          className="bg-background text-foreground-soft hover:bg-muted animate-pop-in absolute -start-[2.875rem] top-3.5 flex size-9 items-center justify-center rounded-lg border"
        >
          <X aria-hidden="true" className="size-4.5" />
        </button>
        <div className="flex flex-none flex-col gap-0.5 border-b px-(--drawer-pad-x) py-4">
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-xl leading-[1.2] tracking-[-0.01em] outline-none"
          >
            {t(K.title)}
          </SheetTitle>
          <SheetDescription className="text-xs">{t(K.sub)}</SheetDescription>
        </div>
        <ContactEditorBand
          name={draft.name}
          record={record}
          actions={actions}
          onLeave={onClose}
          testId={testId}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-(--drawer-pad-x) py-4">
          <DrawerSteps
            steps={steps}
            value={step}
            onValueChange={(next) => setStep(next as EditorStep)}
            // The prototype's step circles are ink, not a section's tone (`accVM`).
            tone="stone"
            testId={testId}
          />
        </div>
        <div className="flex flex-none justify-end border-t p-(--drawer-footer-pad)">
          <Button
            type="button"
            onClick={() => onDone(draft)}
            data-testid={`${testId}-done`}
            className="text-field h-9 rounded-lg px-(--drawer-pad-x) max-md:h-11 max-md:w-full"
          >
            {t(K.done)}
          </Button>
        </div>
      </TooltipProvider>
    </SheetContent>
  );
}

/**
 * The contact editor (KICKOFF §6.3; `leads.md:22, 92–107, 152–164, 289–296`,
 * H:1963–1984) — one shared child drawer, opened from New lead's "New contact"
 * and from "Edit contact" on a contact card. 560px at the inline end over a 35%
 * backdrop, the × floating outside; on a phone the panel leaves 46px for it.
 * "Edit contact", the tinted band, then two step cards — "Identity & reach"
 * and "Contact preferences" — and "Done", the only way anything is kept: ×,
 * the backdrop and Esc (which the prototype misses, D33) close without it
 * (Q-P1). The caller decides what Done does — save the lead or patient now
 * ("Contact updated · applies everywhere"), or carry the contact back into
 * New lead.
 */
export function ContactEditor({ open, onClose, ...props }: ContactEditorProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open ? <ContactEditorPanel onClose={onClose} {...props} /> : null}
    </Sheet>
  );
}
