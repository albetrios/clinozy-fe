import type { TFunction } from 'i18next';
import { type ReactNode, useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { OFFERINGS_KEYS, OFFERINGS_NS } from '../../offerings.constants.ts';
import { CatalogueDeleteConfirm } from '../../shared/components/CatalogueDeleteConfirm/index.ts';
import type { OfferingsCatalogue } from '../../shared/hooks/useOfferingsCatalogue/index.ts';
import {
  OFFERING_DRAWER_KEYS,
  OFFERING_DRAWER_NS,
  OFFERING_DRAWER_TEST_ID,
} from './offering-drawer.constants.ts';
import {
  missingFieldToast,
  type OfferingDrawerView,
  type OfferingStepId,
  useOfferingDrawerView,
} from './offering-drawer-view.ts';
import {
  emptyOfferingForm,
  missingOfferingFields,
  OFFERING_QUICK_FILLS,
  offeringFormOf,
  type OfferingFormValues,
} from './offering-form.ts';
import {
  OfferingDetailsFields,
  OfferingIdentityFields,
  OfferingPriceFields,
  OfferingTimeFields,
  OffersOnThisFields,
} from './OfferingDrawerFields.tsx';
import { useOfferingSave } from './use-offering-save.ts';

const K = OFFERING_DRAWER_KEYS;

/** Seventeen fields with money, chips and a textarea among them: the everyday 680px. */
const CONTENT_PROFILE = { fieldCount: 17, hasHeavyField: true } as const;

/** The room's reads the drawer prices and words the draft with. */
export type OfferingDrawerCatalogue = Pick<
  OfferingsCatalogue,
  'offers' | 'branches' | 'pricingBranchId' | 'today'
>;

/** What every use of the drawer passes. */
interface OfferingDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard lets it through — and after a save or a delete (D28). */
  onClose: () => void;
  /** The room's reads: offers, branches, the pricing branch, today. */
  catalogue: OfferingDrawerCatalogue;
}

/** New offering over the list (`offerings/create/`, `S:99`); `?name=` prefills it. */
export interface OfferingCreateDrawerProps extends OfferingDrawerBaseProps {
  mode: 'create';
  prefill?: { name?: string };
}

/** Edit offering (`offerings/$offeringId/edit/`, `S:100`); `offering` arrives once loaded. */
export interface OfferingEditDrawerProps extends OfferingDrawerBaseProps {
  mode: 'edit';
  offering: OfferingRecord | undefined;
}

/** Props of {@link OfferingDrawer}. */
export type OfferingDrawerProps = OfferingCreateDrawerProps | OfferingEditDrawerProps;

/** The step a record's drawer had open last, and whose ('new' for New offering). */
interface StepMemory {
  key: string;
  step: OfferingStepId;
}

/** One opening of the drawer. */
interface SessionProps extends OfferingDrawerBaseProps {
  /** The saved offering; `null` for a new one. */
  offering: OfferingRecord | null;
  /** The URL's `?name=` — none after "Create & add another". */
  prefill: { name?: string } | undefined;
  /** The step this record had open last — reopening it returns there. */
  memory: StepMemory | null;
  onRemember: (memory: StepMemory) => void;
  /** "Create & add another" saved: start again, blank. */
  onAnother: () => void;
}

/** The form's values as they stand, every key present (the form starts with all of them). */
function useFormValues(form: UseFormReturn<OfferingFormValues>): OfferingFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as OfferingFormValues;
}

/** The Quick fill chips (new only): each presets fields and keeps the rest; none saves. */
function quickFillItems(
  form: UseFormReturn<OfferingFormValues>,
  t: TFunction,
): QuickFillItem[] {
  return OFFERING_QUICK_FILLS.map((fill) => ({
    id: fill.id,
    label: t(K.quickFill[fill.id]),
    tone: fill.tone,
    onSelect: () =>
      form.reset(
        { ...form.getValues(), ...fill.values },
        { keepDefaultValues: true, keepErrors: true },
      ),
  }));
}

/**
 * Who may do what here (D9, Q-U8): view only without Offerings Edit (or
 * Create on a new one); Delete with Offerings Delete; a saved offering's
 * prices locked without `prices` ("prices → offering edits" — a new
 * offering's first price is part of creating it); the Lowest price control
 * with `floor`.
 */
function useDrawerAccess(editing: boolean) {
  const access = useClinicAccess();
  const readOnly =
    access.isResolved && !access.can('offerings', editing ? 'edit' : 'create');
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('offerings', 'delete'),
    pricesLocked: editing && access.isResolved && !access.canAbility('prices'),
    canSeeFloor: access.isResolved && access.canAbility('floor'),
  };
}

/** The step that holds a field, in the drawer's two or three steps. */
function stepOfField(
  field: keyof OfferingFormValues,
  threeSteps: boolean,
): OfferingStepId {
  if (field === 'durationMin' || field === 'validityDays') return 'time';
  if (field === 'searchTerms' || field === 'description' || field === 'active') {
    return threeSteps ? 'details' : 'time';
  }
  return 'main';
}

/** The step a session opens on: the one this record had open last, if it still has it. */
function initialStep(
  memory: StepMemory | null,
  key: string,
  steps: readonly { id: OfferingStepId }[],
): OfferingStepId {
  const remembered = memory?.key === key ? memory.step : undefined;
  return steps.some((step) => step.id === remembered) && remembered ? remembered : 'main';
}

/** The open step, remembered for the record as it changes (reopening returns there). */
function useOpenStep(
  props: Pick<SessionProps, 'memory' | 'onRemember'>,
  key: string,
  steps: readonly { id: OfferingStepId }[],
) {
  const [openStep, setOpenStep] = useState<string>(() =>
    initialStep(props.memory, key, steps),
  );
  const selectStep = (stepId: string) => {
    setOpenStep(stepId);
    if (stepId) props.onRemember({ key, step: stepId as OfferingStepId });
  };
  return [openStep, selectStep] as const;
}

/** What the step bodies read beside the form. */
interface StepBodiesInput {
  fields: {
    form: UseFormReturn<OfferingFormValues>;
    values: OfferingFormValues;
    idPrefix: string;
    testId: string;
  };
  view: OfferingDrawerView;
  branches: OfferingDrawerCatalogue['branches'];
  pricesLocked: boolean;
  floor: { shown: boolean; onShownChange: (shown: boolean) => void } | null;
}

/** Each step's fields: the offering and its prices, then time (and details, or the offers on it). */
function stepBodies({
  fields,
  view,
  branches,
  pricesLocked,
  floor,
}: StepBodiesInput): Record<OfferingStepId, ReactNode> {
  const threeSteps = view.offersOnThis.length > 0;
  return {
    main: (
      <>
        <OfferingIdentityFields {...fields} branches={branches} />
        <OfferingPriceFields
          {...fields}
          pricesLocked={pricesLocked}
          floor={floor}
          offerPriceHint={view.offerPriceHint}
          billedToday={view.billedToday}
        />
      </>
    ),
    time: threeSteps ? (
      <>
        <OffersOnThisFields offersOnThis={view.offersOnThis} testId={fields.testId} />
        <OfferingTimeFields {...fields} />
      </>
    ) : (
      <>
        <OfferingTimeFields {...fields} />
        <OfferingDetailsFields {...fields} titled />
      </>
    ),
    // Alone in its step, the section needs no label of its own (H:3836).
    details: <OfferingDetailsFields {...fields} titled={false} />,
  };
}

/** The step cards: the view's heads, each titled for the drawer's two or three steps. */
function drawerSteps(
  view: OfferingDrawerView,
  bodies: Record<OfferingStepId, ReactNode>,
  readOnly: boolean,
  t: TFunction,
): DrawerStep[] {
  const titles: Record<OfferingStepId, string> = {
    main: t(K.steps.main),
    time: t(view.offersOnThis.length > 0 ? K.steps.offersTime : K.steps.timeDetails),
    details: t(K.steps.details),
  };
  return view.steps.map((step) => ({
    ...step,
    title: titles[step.id],
    content: <DrawerStepBody readOnly={readOnly}>{bodies[step.id]}</DrawerStepBody>,
  }));
}

/** Edit offering's Delete: the reason confirm, the drawer's summary in its pill. */
function OfferingDeleteConfirm({
  offering,
  open,
  record,
  onClose,
  onDeleted,
}: {
  offering: OfferingRecord | null;
  open: boolean;
  record: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  if (!offering) return null;
  return (
    <CatalogueDeleteConfirm
      target={
        open ? { kind: 'offering', id: offering.id, seq: offering.seq, record } : null
      }
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}

/** One opening of the drawer: the form, its checks and its save. */
function OfferingDrawerSession(props: SessionProps) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { catalogue, offering } = props;
  const idPrefix = `offering-${useId().replace(/:/g, '')}`;
  const testId = OFFERING_DRAWER_TEST_ID;
  const creating = offering === null;
  const { readOnly, canDelete, pricesLocked, canSeeFloor } = useDrawerAccess(!creating);

  const form = useForm<OfferingFormValues>({
    defaultValues: offering ? offeringFormOf(offering) : emptyOfferingForm(props.prefill),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  // "Lowest price" reads Hidden on every open (H:5457).
  const [floorShown, setFloorShown] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const view = useOfferingDrawerView({ values, offering, ...catalogue });
  const [openStep, selectStep] = useOpenStep(props, offering?.id ?? 'new', view.steps);
  const { saveState, save } = useOfferingSave({
    form,
    offeringId: offering?.id ?? null,
    onField: (field) => selectStep(stepOfField(field, view.offersOnThis.length > 0)),
    onDone: (_outcome, another) => (another ? props.onAnother() : props.onClose()),
  });

  const bodies = stepBodies({
    fields: { form, values, idPrefix, testId },
    view,
    branches: catalogue.branches,
    pricesLocked,
    floor: canSeeFloor ? { shown: floorShown, onShownChange: setFloorShown } : null,
  });

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={t(creating ? K.title.create : K.title.edit)}
        tag={offering ? displayId.offering(offering.seq) : undefined}
        sub={t(K.sub)}
        badges={view.badges}
        quickFill={creating ? quickFillItems(form, t) : undefined}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.offerings}
        steps={drawerSteps(view, bodies, readOnly, t)}
        openStep={openStep}
        onOpenStepChange={selectStep}
        onMissing={() => {
          const message = missingFieldToast(missingOfferingFields(form.getValues()), t);
          if (message) notify.warning(message);
        }}
        summary={view.summary}
        readOnly={readOnly}
        saveLabel={t(creating ? K.save.create : K.save.edit)}
        onSave={() => void save(false)}
        saveState={saveState}
        saveAndAddLabel={t(K.save.createAnother)}
        onSaveAndAdd={creating ? () => void save(true) : undefined}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={testId}
      />
      <OfferingDeleteConfirm
        offering={offering}
        open={deleting}
        record={view.summary}
        onClose={() => setDeleting(false)}
        onDeleted={props.onClose}
      />
    </>
  );
}

/** Edit offering while its record loads: the shell over a skeleton, nothing to save. */
function PendingOfferingDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { t: tRoom } = useTranslation(OFFERINGS_NS);
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title.edit)}
      sub={t(K.sub)}
      content={CONTENT_PROFILE}
      testId={OFFERING_DRAWER_TEST_ID}
    >
      <PanelSkeleton
        name={tRoom(OFFERINGS_KEYS.record)}
        testId={`${OFFERING_DRAWER_TEST_ID}-skeleton`}
      />
    </RecordDrawer>
  );
}

/**
 * The Offering drawer (KICKOFF §6.11; `offerings.md:59–89, 131–143, 237–244`)
 * on the shared record drawer: New offering over the list — with the Quick
 * fill presets and "Create & add another" — and Edit offering, view only
 * without Offerings Edit. Its steps are "Offering, price & sessions" →
 * "Time, validity & details", or three — "… → Offers on this, time &
 * validity → Details" — while an offer that has not ended names it; reopening
 * the same record returns to the step it had open. The draft is priced live
 * for the header's branch ("Billed today", the badges, the footer). Save is
 * never disabled: an empty Name or Price opens step 1 with "Add a name" / "Add
 * a price"; the price rules toast before the write. A save closes the drawer
 * onto the list (D28) with "Offering #275 created" / "Offering #273 saved".
 * Every opening starts a fresh form.
 */
export function OfferingDrawer(props: OfferingDrawerProps) {
  const [session, setSession] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [memory, setMemory] = useState<StepMemory | null>(null);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) {
      setSession((current) => current + 1);
      setFresh(false);
    }
  }

  const { open, onClose, catalogue } = props;
  if (props.mode === 'edit' && !props.offering) {
    return <PendingOfferingDrawer open={open} onClose={onClose} />;
  }
  const offering = props.mode === 'edit' ? (props.offering ?? null) : null;
  return (
    <OfferingDrawerSession
      key={`${session}-${offering?.id ?? 'new'}`}
      open={open}
      onClose={onClose}
      catalogue={catalogue}
      offering={offering}
      prefill={props.mode === 'create' && !fresh ? props.prefill : undefined}
      memory={memory}
      onRemember={setMemory}
      onAnother={() => {
        setSession((current) => current + 1);
        setFresh(true);
      }}
    />
  );
}
