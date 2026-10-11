import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { type ReactNode, useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { fetchOffering, offeringQueryKeys } from '@/shared/api/app/offerings-api.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { OFFERINGS_KEYS, OFFERINGS_NS } from '../../offerings.constants.ts';
import { CatalogueDeleteConfirm } from '../../shared/components/CatalogueDeleteConfirm/index.ts';
import type { OfferingsCatalogue } from '../../shared/hooks/useOfferingsCatalogue/index.ts';
import {
  type StepMemory,
  useRememberedStep,
} from '../../shared/hooks/useRememberedStep/index.ts';
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
  'offers' | 'branches' | 'pricingBranchId'
>;

/** What every use of the drawer passes. */
interface OfferingDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard lets it through — and after a save or a delete (D28). */
  onClose: () => void;
  /** The room's reads: offers, branches, the pricing branch. */
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

/** One opening of the drawer. */
interface SessionProps extends OfferingDrawerBaseProps {
  /** The saved offering; `null` for a new one. */
  offering: OfferingRecord | null;
  /** The URL's `?name=` — none after "Create & add another". */
  prefill: { name?: string } | undefined;
  /** The step this record had open last — reopening it returns there. */
  memory: StepMemory<OfferingStepId> | null;
  onRemember: (memory: StepMemory<OfferingStepId>) => void;
  /** "Create & add another" saved: start again, blank. */
  onAnother: () => void;
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
      resetFormInPlace(
        form,
        { ...form.getValues(), ...fill.values },
        { keepDefaultValues: true, keepErrors: true },
      ),
  }));
}

/**
 * Who may do what here (D9, research §7): view only without `offering:update`
 * (or `offering:create` on a new one) — prices included, they need no code of
 * their own (O3); Delete with `offering:delete`; the Lowest price only with
 * `offering:lower_price:read` — hidden from everyone else, and never sent for
 * them (gap 6). View-as hides it too (`canCode` is false while it runs).
 */
function useDrawerAccess(editing: boolean) {
  const access = useAppAccess();
  const readOnly =
    access.isResolved && !access.can('offerings', editing ? 'edit' : 'create');
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('offerings', 'delete'),
    canSeeFloor: access.isResolved && access.canCode('offering:lower_price:read'),
  };
}

/**
 * The session's form over the offering it edits (a new one's defaults and
 * prefill otherwise), kept in step with a reload: a save refused as stale (`409
 * record_changed`) offers Reload (`onStale`), which reads the offering again and
 * restarts the form on what was saved — its `updated_at` guards the next save.
 */
function useOfferingForm(
  offering: OfferingRecord | null,
  prefill: { name?: string } | undefined,
) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const form = useForm<OfferingFormValues>({
    defaultValues: offering ? offeringFormOf(offering) : emptyOfferingForm(prefill),
  });
  const [record, setRecord] = useState(offering);
  const reload = async (saved: OfferingRecord) => {
    try {
      const fresh = await queryClient.query({
        queryKey: offeringQueryKeys.detail(organizationId, saved.id),
        queryFn: () => fetchOffering(saved.id),
        staleTime: 0,
      });
      setRecord(fresh);
      // In place: every input shows what was saved, not what was typed (`resetFormInPlace`).
      resetFormInPlace(form, offeringFormOf(fresh));
      // The list behind the drawer shows what was saved too (as the Offer drawer's Reload).
      await queryClient.invalidateQueries({
        queryKey: offeringQueryKeys.list(organizationId),
      });
    } catch (error) {
      notify.error(mapApiError(error));
    }
  };
  return {
    form,
    record,
    onStale: record ? () => void reload(record) : undefined,
  };
}

/**
 * The Lowest price control — only for a member with `offering:lower_price:read`
 * (`null` otherwise). It reads Hidden on every open (H:5457), Shown in a
 * view-only drawer, whose toggle is locked with the rest; a rule or a refusal on
 * the field shows it (`show`).
 */
function useFloorControl(canSeeFloor: boolean, readOnly: boolean) {
  const [shown, setShown] = useState(false);
  return {
    floor: canSeeFloor ? { shown: shown || readOnly, onShownChange: setShown } : null,
    show: () => setShown(true),
  };
}

/** The step that holds a field, in the drawer's two or three steps. */
function stepOfField(
  field: keyof OfferingFormValues,
  threeSteps: boolean,
): OfferingStepId {
  if (field === 'durationMinutes' || field === 'validityDays') return 'time';
  if (field === 'searchTerms' || field === 'description' || field === 'isActive') {
    return threeSteps ? 'details' : 'time';
  }
  return 'offering';
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
  floor: { shown: boolean; onShownChange: (shown: boolean) => void } | null;
}

/** Each step's fields: the offering and its prices, then time (and details, or the offers on it). */
function stepBodies({
  fields,
  view,
  branches,
  floor,
}: StepBodiesInput): Record<OfferingStepId, ReactNode> {
  const threeSteps = view.offersOnThis.length > 0;
  return {
    offering: (
      <>
        <OfferingIdentityFields {...fields} branches={branches} />
        <OfferingPriceFields
          {...fields}
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
    offering: t(K.steps.main),
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
        open
          ? {
              kind: 'offering',
              id: offering.id,
              offeringNumber: offering.offeringNumber,
              record,
            }
          : null
      }
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}

/** One opening of the drawer: the form, its checks and its save. */
function OfferingDrawerSession(props: SessionProps) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { catalogue } = props;
  const idPrefix = `offering-${useId().replace(/:/g, '')}`;
  const testId = OFFERING_DRAWER_TEST_ID;
  const creating = props.offering === null;
  const { readOnly, canDelete, canSeeFloor } = useDrawerAccess(!creating);

  const {
    form,
    record: offering,
    onStale,
  } = useOfferingForm(props.offering, props.prefill);
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const floor = useFloorControl(canSeeFloor, readOnly);
  const [deleting, setDeleting] = useState(false);

  const view = useOfferingDrawerView({ values, offering, ...catalogue });
  const [openStep, selectStep] = useRememberedStep({
    memory: props.memory,
    onRemember: props.onRemember,
    key: offering?.id ?? 'new',
    steps: view.steps.map((step) => step.id),
  });
  const { saveState, save } = useOfferingSave({
    form,
    record: offering,
    canSeeFloor,
    onField: (field) => {
      if (field === 'minPrice') floor.show();
      selectStep(stepOfField(field, view.offersOnThis.length > 0));
    },
    onStale,
    onDone: (_outcome, another) => (another ? props.onAnother() : props.onClose()),
  });

  const bodies = stepBodies({
    fields: { form, values, idPrefix, testId },
    view,
    branches: catalogue.branches,
    floor: floor.floor,
  });

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={t(creating ? K.title.create : K.title.edit)}
        tag={offering ? displayId.offering(offering.offeringNumber) : undefined}
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

/**
 * The Offering drawer (KICKOFF §6.11; `offerings.md:59–89, 131–143, 237–244`)
 * on the shared record drawer and clinozy-be (`POST /app/offerings`, `PATCH
 * /app/offerings/{offering_id}`): New offering over the list — with the Quick
 * fill presets and "Create & add another" — and Edit offering, view only
 * without `offering:update`. Money is rupees, typed and shown; GST is one of
 * the API's rates (chips), the category's until one is picked; the Lowest price
 * is there only for `offering:lower_price:read`. Its steps are "Offering, price
 * & sessions" → "Time, validity & details", or three — "… → Offers on this,
 * time & validity → Details" — while an offer the server does not call ended
 * names it; reopening the same record returns to the step it had open. The
 * draft is priced live for the header's branch ("Billed today", the badges, the
 * footer). Save is never disabled: an empty Name or Price opens step 1 with "Add
 * a name" / "Add a price"; the price rules toast before the write; a refusal
 * lands on its field. A save closes the drawer onto the list (D28) with
 * "Offering #8 created" / "Offering #5 saved". Every opening starts a fresh form.
 */
export function OfferingDrawer(props: OfferingDrawerProps) {
  const { session, fresh, restart } = useDrawerSession(props.open);
  const [memory, setMemory] = useState<StepMemory<OfferingStepId> | null>(null);
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { t: tRoom } = useTranslation(OFFERINGS_NS);

  const { open, onClose, catalogue } = props;
  if (props.mode === 'edit' && !props.offering) {
    return (
      <RecordDrawerPending
        open={open}
        onClose={onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={tRoom(OFFERINGS_KEYS.record)}
        testId={OFFERING_DRAWER_TEST_ID}
      />
    );
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
      onAnother={restart}
    />
  );
}
