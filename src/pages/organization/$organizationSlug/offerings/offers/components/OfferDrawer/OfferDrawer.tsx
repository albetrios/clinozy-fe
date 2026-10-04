import type { TFunction } from 'i18next';
import { type ReactNode, useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { CatalogueDeleteConfirm } from '../../../shared/components/CatalogueDeleteConfirm/index.ts';
import { CatalogueDrawerPending } from '../../../shared/components/CatalogueDrawerPending/index.ts';
import type { OfferingsCatalogue } from '../../../shared/hooks/useOfferingsCatalogue/index.ts';
import {
  type StepMemory,
  useRememberedStep,
} from '../../../shared/hooks/useRememberedStep/index.ts';
import { OFFERS_KEYS, OFFERS_NS } from '../../offers.constants.ts';
import {
  OFFER_DRAWER_KEYS,
  OFFER_DRAWER_NS,
  OFFER_DRAWER_TEST_ID,
} from './offer-drawer.constants.ts';
import {
  missingOfferToast,
  type OfferStepId,
  useOfferDrawerView,
} from './offer-drawer-view.ts';
import {
  emptyOfferForm,
  missingOfferFields,
  offerFormOf,
  type OfferFormValues,
} from './offer-form.ts';
import {
  OfferMainFields,
  OfferNotesFields,
  OfferWhereFields,
} from './OfferDrawerFields.tsx';
import { useOfferSave } from './use-offer-save.ts';

const K = OFFER_DRAWER_KEYS;

/** Eleven fields with chips, swatches, a picker and a textarea: the everyday 680px. */
const CONTENT_PROFILE = { fieldCount: 11, hasHeavyField: true } as const;

/** The room's reads the drawer words and previews the draft with. */
export type OfferDrawerCatalogue = Pick<
  OfferingsCatalogue,
  'offerings' | 'branches' | 'today'
>;

/** What every use of the drawer passes. */
interface OfferDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard lets it through — and after a save or a delete (D28). */
  onClose: () => void;
  /** The room's reads: the catalogue, the branches, today. */
  catalogue: OfferDrawerCatalogue;
}

/** New offer over the Offers tab (`offerings/offers/create/`, `S:102`). */
export interface OfferCreateDrawerProps extends OfferDrawerBaseProps {
  mode: 'create';
}

/** Edit offer (`offerings/offers/$offerId/edit/`, `S:103`); `offer` arrives once loaded. */
export interface OfferEditDrawerProps extends OfferDrawerBaseProps {
  mode: 'edit';
  offer: OfferRecord | undefined;
}

/** Props of {@link OfferDrawer}. */
export type OfferDrawerProps = OfferCreateDrawerProps | OfferEditDrawerProps;

/** One opening of the drawer. */
interface SessionProps extends OfferDrawerBaseProps {
  /** The saved offer; `null` for a new one. */
  offer: OfferRecord | null;
  memory: StepMemory<OfferStepId> | null;
  onRemember: (memory: StepMemory<OfferStepId>) => void;
}

/** Which step holds each field — a check or the server opens it. */
const FIELD_STEPS: Readonly<Record<keyof OfferFormValues, OfferStepId>> = {
  name: 'offer',
  code: 'offer',
  kind: 'offer',
  value: 'offer',
  tone: 'offer',
  offeringIds: 'where',
  branchIds: 'where',
  startsOn: 'where',
  endsOn: 'where',
  note: 'notes',
  live: 'notes',
};

/** The form's values as they stand, every key present (the form starts with all of them). */
function useFormValues(form: UseFormReturn<OfferFormValues>): OfferFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as OfferFormValues;
}

/**
 * Who may do what here (D9, Q-U8): the drawer is editable with Offerings Edit
 * (Create for a new offer) and the `prices` ability, else view only; Delete
 * with Offerings Delete.
 */
function useDrawerAccess(editing: boolean) {
  const access = useClinicAccess();
  const canWrite =
    access.can('offerings', editing ? 'edit' : 'create') && access.canAbility('prices');
  const readOnly = access.isResolved && !canWrite;
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('offerings', 'delete'),
  };
}

/** The step cards: the view's heads, titled "Offer" · "Where it applies" · "Notes". */
function drawerSteps(
  heads: ReturnType<typeof useOfferDrawerView>['steps'],
  bodies: Record<OfferStepId, ReactNode>,
  readOnly: boolean,
  t: TFunction,
): DrawerStep[] {
  return heads.map((step) => ({
    ...step,
    title: t(K.steps[step.id]),
    content: <DrawerStepBody readOnly={readOnly}>{bodies[step.id]}</DrawerStepBody>,
  }));
}

/** One opening of the drawer: the form, its checks and its save. */
function OfferDrawerSession(props: SessionProps) {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const { catalogue, offer } = props;
  const idPrefix = `offer-${useId().replace(/:/g, '')}`;
  const testId = OFFER_DRAWER_TEST_ID;
  const creating = offer === null;
  const { readOnly, canDelete } = useDrawerAccess(!creating);

  const form = useForm<OfferFormValues>({
    defaultValues: offer ? offerFormOf(offer) : emptyOfferForm(),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [deleting, setDeleting] = useState(false);

  const view = useOfferDrawerView({
    values,
    offerings: catalogue.offerings,
    branches: catalogue.branches,
  });
  const [openStep, selectStep] = useRememberedStep({
    memory: props.memory,
    onRemember: props.onRemember,
    key: offer?.id ?? 'new',
    steps: view.steps.map((step) => step.id),
  });
  const { saveState, save } = useOfferSave({
    form,
    offerId: offer?.id ?? null,
    onField: (field) => selectStep(FIELD_STEPS[field]),
    onDone: props.onClose,
  });

  const fields = { form, values, idPrefix, testId };
  const bodies: Record<OfferStepId, ReactNode> = {
    offer: <OfferMainFields {...fields} />,
    where: (
      <OfferWhereFields
        {...fields}
        offerings={catalogue.offerings}
        branches={catalogue.branches}
        previews={view.previews}
        today={catalogue.today}
      />
    ),
    notes: <OfferNotesFields {...fields} />,
  };

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={t(creating ? K.title.create : K.title.edit)}
        tag={offer?.name}
        sub={t(K.sub)}
        badges={view.badges}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.offerings}
        steps={drawerSteps(view.steps, bodies, readOnly, t)}
        openStep={openStep}
        onOpenStepChange={selectStep}
        onMissing={() => {
          const message = missingOfferToast(missingOfferFields(form.getValues()), t);
          if (message) notify.warning(message);
        }}
        summary={view.summary}
        readOnly={readOnly}
        saveLabel={t(creating ? K.save.create : K.save.edit)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={testId}
      />
      {offer ? (
        <CatalogueDeleteConfirm
          target={
            deleting
              ? { kind: 'offer', id: offer.id, name: offer.name, record: offer.name }
              : null
          }
          onClose={() => setDeleting(false)}
          onDeleted={props.onClose}
        />
      ) : null}
    </>
  );
}

/**
 * The Offer drawer (KICKOFF §6.11; `offerings.md:91–112, 145–157, 246–253`)
 * on the shared record drawer: New offer over the Offers tab and Edit offer —
 * editable with Offerings Edit and the `prices` ability (Q-U8), else view
 * only. Always three steps, "Offer" → "Where it applies" → "Notes"; reopening
 * the same offer returns to the step it had open. The value field follows the
 * Type, and switching Type resets it (10 · 500 · empty · 1); each picked
 * offering previews the offer on it ("₹1,200 → ₹1,080", "2 → 3 sessions").
 * Save is never disabled: an empty Name or no offering opens its step with
 * "Name the offer" / "Pick at least one offering"; a value of nothing and an
 * end before the start toast before the write. A save closes the drawer onto
 * the list (D28) with "<name> created · applies automatically" / "<name>
 * saved". Esc closes it (§7.3). No "Create & add another".
 */
export function OfferDrawer(props: OfferDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const [memory, setMemory] = useState<StepMemory<OfferStepId> | null>(null);
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const { t: tRoom } = useTranslation(OFFERS_NS);

  const { open, onClose, catalogue } = props;
  if (props.mode === 'edit' && !props.offer) {
    return (
      <CatalogueDrawerPending
        open={open}
        onClose={onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={tRoom(OFFERS_KEYS.record)}
        testId={OFFER_DRAWER_TEST_ID}
      />
    );
  }
  const offer = props.mode === 'edit' ? (props.offer ?? null) : null;
  return (
    <OfferDrawerSession
      key={`${session}-${offer?.id ?? 'new'}`}
      open={open}
      onClose={onClose}
      catalogue={catalogue}
      offer={offer}
      memory={memory}
      onRemember={setMemory}
    />
  );
}
