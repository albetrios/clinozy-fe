import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { PatientPurchaseRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import {
  billedPrice,
  type PlanActivityRow,
  type PlanIdeaRow,
  type PlanOffering,
  type PlanSuggestionRow,
  type SuggestionChange,
} from '@/shared/api/clinic/plan-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { OFFERING_CATEGORY_TONES } from '@/shared/clinic/clinic-tones.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLead } from '@/shared/hooks/useLeads/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatientPurchases } from '@/shared/hooks/usePatientPackages/index.ts';
import {
  useAddSuggestion,
  usePlan,
  usePlanActivity,
  usePlanIdeas,
  usePlanOfferings,
  useRemoveSuggestion,
  useRestoreSuggestion,
  useUpdateSuggestion,
} from '@/shared/hooks/usePlan/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  OFFERING_SUGGESTIONS_KEYS,
  OFFERING_SUGGESTIONS_NS,
} from './offering-suggestions.constants.ts';
import type {
  SuggestionActivityLine,
  SuggestionActivityStatusTone,
  SuggestionIdea,
  SuggestionLine,
  SuggestionPatch,
  SuggestionPurchase,
} from './offering-suggestions.types.ts';
import type { OfferingSuggestionsProps } from './OfferingSuggestions.tsx';

const KEYS = OFFERING_SUGGESTIONS_KEYS;

type Translate = ReturnType<typeof useTranslation>['t'];

/** A channel's tone in "Contact activity" (H:4371): WhatsApp sage, Instagram blush, a call sky. */
const CHANNEL_TONES: Readonly<Record<PlanActivityRow['channel'], Tone>> = {
  whatsapp: 'sage',
  instagram: 'blush',
  call: 'sky',
};

/** The API's rupees in the card's unit, paise — the formatter's and the price box's. */
const paiseOf = (rupees: number) => Math.round(rupees * 100);

/** What the host says about where the card sits. */
export interface PlanCardHost {
  /** The patient whose plan it is; empty while there is none — the card reads nothing. */
  patientId: string;
  /** The patient's contact — "Contact activity" reads their stream; none, no activity. */
  contactId?: string | null;
  /** The patient's lead — "Contact activity · Lead #<n> · <status>" and "Open chat". */
  leadId?: string | null;
  firstName: string;
  /** The host's Edit on the plan (`patient:update`). */
  canEdit: boolean;
  /** "Open chat" in "Contact activity" — the host opens the lead. */
  onOpenChat?: (leadId: string) => void;
}

/** The card's data-bound props, everything but where it sits and its price eye. */
export type PlanCardProps = Omit<
  OfferingSuggestionsProps,
  'variant' | 'pricesShown' | 'onPricesShownChange' | 'open' | 'onOpenChange'
>;

/** {@link usePlanCard}'s answer: the plan as the card shows it, and its load state. */
export interface PlanCard {
  /** The plan rows' read — `pending` until they and the catalogue answer. */
  status: 'pending' | 'error' | 'ready';
  retry: () => void;
  /** `null` until the plan is ready. */
  props: PlanCardProps | null;
}

/** A line's sessions or visits (H:4344): "7 sessions", "2 visits", "1 session". */
function sessionsText(t: Translate, sessions: number, qty: number): string {
  if (sessions > 1) return t(KEYS.info.sessions, { count: sessions * qty });
  if (qty > 1) return t(KEYS.info.visits, { count: qty });
  return t(KEYS.info.sessions, { count: 1 });
}

interface Formatters {
  t: Translate;
  money: (paise: number) => string;
  /** "24 Sep" — an instant's day. */
  day: (instant: string) => string;
  /** "24 Sep 4:10 pm" — the rooms' one time rule. */
  instant: (instant: string) => string;
}

/** An offering's category in words, or nothing when it is not in the catalogue. */
const categoryOf = (
  t: Translate,
  offering: Pick<PlanOffering, 'category'> | undefined,
) =>
  offering
    ? t(CLINIC_KEYS.offerings.categories[offering.category], { ns: CLINIC_NS })
    : '';

/** One unit's list and lowest price, as the details tooltip reads them (the lowest only when served). */
function pricesText(f: Formatters, offering: PlanOffering | undefined): string[] {
  if (!offering) return [];
  const list = f.t(KEYS.info.list, { price: f.money(paiseOf(offering.price)) });
  const { minPrice } = offering;
  if (minPrice === null || minPrice <= 0 || minPrice >= offering.price) return [list];
  return [list, f.t(KEYS.info.lowest, { price: f.money(paiseOf(minPrice)) })];
}

function lineOf(
  row: PlanSuggestionRow,
  offering: PlanOffering | undefined,
  member: DirectoryMember | undefined,
  f: Formatters,
): SuggestionLine {
  const { t } = f;
  return {
    id: row.id,
    name: row.name || offering?.name || t(KEYS.offeringRemoved),
    tone: offering ? OFFERING_CATEGORY_TONES[offering.category] : 'stone',
    info: [
      categoryOf(t, offering),
      sessionsText(t, offering?.sessions ?? 1, row.quantity),
      ...pricesText(f, offering),
      row.reason,
    ]
      .filter(Boolean)
      .join(' · '),
    qty: row.quantity,
    price: row.price === null ? null : paiseOf(row.price),
    listPrice: offering ? paiseOf(billedPrice(offering)) : 0,
    status: row.status,
    invoicedQty: row.invoicedQuantity,
    fullyInvoiced: row.isFullyInvoiced,
    belowLowest: row.isBelowLowestPrice,
    by: {
      initials: member?.initials ?? '?',
      tone: member?.tone ?? 'stone',
      label: [member?.name, f.instant(row.createdAt), row.sourceLabel]
        .filter(Boolean)
        .join(' · '),
    },
  };
}

function ideaOf(idea: PlanIdeaRow, f: Formatters): SuggestionIdea {
  const { t } = f;
  return {
    id: idea.offeringId,
    name: idea.name,
    tone: OFFERING_CATEGORY_TONES[idea.category],
    info: [
      t(KEYS.ideaReasons.history),
      idea.reason,
      categoryOf(t, idea),
      idea.sessions > 1 ? t(KEYS.info.sessions, { count: idea.sessions }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    listPrice: paiseOf(idea.price),
  };
}

function purchaseOf(
  row: PatientPurchaseRow,
  offering: PlanOffering | undefined,
  f: Formatters,
): SuggestionPurchase {
  return {
    id: row.id,
    date: f.day(row.createdAt),
    category: offering
      ? {
          label: categoryOf(f.t, offering),
          tone: OFFERING_CATEGORY_TONES[offering.category],
        }
      : null,
    name: row.name,
    sessions: row.isPackage ? { used: row.sessionsUsed, total: row.sessionsTotal } : null,
  };
}

/** A message's status word and colour (H:4372). */
function activityStatus(
  line: PlanActivityRow,
  t: Translate,
): { status: string; statusTone?: SuggestionActivityStatusTone } {
  if (line.direction === 'received') return { status: t(KEYS.delivery.received) };
  switch (line.delivery) {
    case 'read':
      return { status: t(KEYS.delivery.read), statusTone: 'success' };
    case 'failed':
      return { status: t(KEYS.delivery.failed), statusTone: 'danger' };
    case 'queued':
      return { status: t(KEYS.delivery.queued), statusTone: 'pending' };
    case 'delivered':
      return { status: t(KEYS.delivery.delivered) };
    default:
      return { status: t(KEYS.delivery.sent) };
  }
}

function activityOf(line: PlanActivityRow, f: Formatters): SuggestionActivityLine {
  return {
    id: line.id,
    at: f.instant(line.at),
    channel: {
      label: f.t(CLINIC_KEYS.channels[line.channel], { ns: CLINIC_NS }),
      tone: CHANNEL_TONES[line.channel],
    },
    direction: line.direction === 'received' ? 'got' : 'sent',
    text: line.text,
    ...activityStatus(line, f.t),
  };
}

/** A line's edit in the API's words and money: quantity, the whole line's rupees, status. */
function changeOf(patch: SuggestionPatch): SuggestionChange {
  return {
    ...(patch.qty !== undefined && { quantity: patch.qty }),
    ...(patch.price !== undefined && {
      price: patch.price === null ? null : patch.price / 100,
    }),
    ...(patch.status !== undefined && { status: patch.status }),
  };
}

/** A unit's lowest price for the "Add offering" row — only when served and under the list price. */
function minPriceText(f: Formatters, offering: PlanOffering): string {
  const { minPrice } = offering;
  if (minPrice === null || minPrice <= 0 || minPrice >= offering.price) return '';
  return f.t(KEYS.minPrice, { price: f.money(paiseOf(minPrice)) });
}

/**
 * "Add offering"'s list (`addDD`, H:4373): the active offerings, grouped by category — "Single"
 * or "<n> sessions", " · min <₹>" — the ones the plan holds disabled.
 */
function offeringOptionsOf(
  offerings: readonly PlanOffering[],
  held: ReadonlySet<string>,
  f: Formatters,
): PickerOption[] {
  return offerings
    .filter((offering) => offering.isActive)
    .map((offering) => ({
      key: offering.id,
      label: offering.name,
      sub: [
        offering.sessions > 1
          ? f.t(KEYS.info.sessions, { count: offering.sessions })
          : f.t(KEYS.single),
        minPriceText(f, offering),
      ]
        .filter(Boolean)
        .join(' · '),
      meta: f.money(paiseOf(offering.price)),
      group: categoryOf(f.t, offering),
      tone: OFFERING_CATEGORY_TONES[offering.category],
      disabled: held.has(offering.id),
    }));
}

/**
 * "Contact activity" (H:2823): the contact's last messages, under their lead's number and status
 * when the member may read it, with "Open chat" to the lead — nothing without a message.
 */
function activityPropsOf({
  lines = [],
  lead,
  leadId,
  onOpenChat,
  f,
}: {
  lines: readonly PlanActivityRow[] | undefined;
  lead: Pick<LeadRecord, 'leadNumber' | 'status'> | undefined;
  leadId: string | null | undefined;
  onOpenChat: PlanCardHost['onOpenChat'];
  f: Formatters;
}): PlanCardProps['activity'] {
  if (lines.length === 0) return undefined;
  return {
    summary: lead
      ? [
          f.t(KEYS.activityLead, { id: `#${lead.leadNumber}` }),
          f.t(CLINIC_KEYS.leads.statuses[lead.status], { ns: CLINIC_NS }),
        ].join(' · ')
      : undefined,
    lines: lines.map((line) => activityOf(line, f)),
    onOpenChat: leadId && onOpenChat ? () => onOpenChat(leadId) : undefined,
  };
}

/**
 * Whether a row holds its offering in the plan (PK9): planned, next time or accepted — not once
 * an accepted row is invoiced in full. "Add offering" disables what the plan holds; the server
 * refuses a second one (`409 suggestion_exists`).
 */
const holdsOffering = (row: PlanSuggestionRow) =>
  row.status !== 'declined' && !(row.status === 'accepted' && row.isFullyInvoiced);

/**
 * A patient's plan bound to the Offering suggestions card (api-integration §5.4): the rows
 * (`…/offering-suggestions`) with the server's total, flags and labels, named and priced from
 * the offerings catalogue and signed by the team directory; the server's ideas; the last
 * purchases (`…/offerings`); the contact's last messages with their lead — each in the member's
 * words and money — the "Add offering" list, and the writes behind every control: optimistic
 * edits, "+ Add" and "Add offering" ("<name> added to <first>’s suggestions"), and Remove with
 * Undo (`…/restore`).
 */
export function usePlanCard(host: PlanCardHost): PlanCard {
  const { t } = useTranslation([OFFERING_SUGGESTIONS_NS, CLINIC_NS]);
  const money = usePaiseFormat();
  const clock = useClinicClock();
  const access = useClinicAccess();
  const team = useTeamDirectory();
  // No patient yet: nothing to read.
  const patientId = host.patientId || null;
  const plan = usePlan(patientId);
  const ideas = usePlanIdeas(patientId);
  const offerings = usePlanOfferings({ enabled: patientId !== null });
  const purchases = usePatientPurchases(patientId);
  const activity = usePlanActivity(host.contactId ?? null, {
    enabled: access.canCode('contact_activity:read'),
  });
  const lead = useLead(
    access.canCode('lead:read') ? (host.leadId ?? undefined) : undefined,
  ).data;
  const update = useUpdateSuggestion();
  const add = useAddSuggestion();
  const remove = useRemoveSuggestion();
  const restore = useRestoreSuggestion();

  const f: Formatters = {
    t,
    money,
    day: (instant) => clock.date(clock.dayOf(instant)),
    instant: (instant) => clock.moment(instant),
  };
  const retry = () => void plan.refetch();

  const data = plan.data;
  if (plan.isError) return { status: 'error', retry, props: null };
  if (!data || offerings.isPending) return { status: 'pending', retry, props: null };

  const catalogue = offerings.data ?? [];
  const byOffering = new Map(catalogue.map((row) => [row.id, row]));
  const memberOf = (row: PlanSuggestionRow) =>
    row.suggestedById ? team.byId.get(row.suggestedById) : undefined;
  const rows = new Map(data.suggestions.map((row) => [row.id, row]));
  const held = new Set(
    data.suggestions.filter(holdsOffering).map((row) => row.offeringId),
  );
  const addTo = (offeringId: string, name: string, reason: string | null = null) => {
    add.mutate(
      { patientId: host.patientId, offeringId, reason },
      { onSuccess: () => notify.success(t(KEYS.added, { name, first: host.firstName })) },
    );
  };
  const offeringOptions = offeringOptionsOf(catalogue, held, f);

  return {
    status: 'ready',
    retry,
    props: {
      firstName: host.firstName,
      lines: data.suggestions.map((row) =>
        lineOf(row, byOffering.get(row.offeringId), memberOf(row), f),
      ),
      total: paiseOf(data.planTotal),
      ideas: (ideas.data ?? []).map((idea) => ideaOf(idea, f)),
      purchases: (purchases.data ?? []).map((row) =>
        purchaseOf(row, byOffering.get(row.offeringId), f),
      ),
      activity: activityPropsOf({
        lines: activity.data,
        lead,
        leadId: host.leadId,
        onOpenChat: host.onOpenChat,
        f,
      }),
      canEdit: host.canEdit,
      canSeeLowestPrice: access.canCode('offering:lower_price:read'),
      onChange: (line, patch) => {
        const row = rows.get(line.id);
        if (!row) return;
        update.mutate(
          {
            patientId: host.patientId,
            suggestionId: row.id,
            change: changeOf(patch),
            expectedUpdatedAt: row.updatedAt,
          },
          // Refused (a stale save, a quantity under what was invoiced): read the plan again.
          { onError: retry },
        );
      },
      onRemove: async (line, choice) => {
        await remove.mutateAsync({
          patientId: host.patientId,
          suggestionId: line.id,
          reason: choice.reason,
          note: choice.note,
        });
        notify.undo(t(KEYS.removed, { name: line.name }), {
          onUndo: () =>
            restore.mutate({ patientId: host.patientId, suggestionId: line.id }),
        });
      },
      onAddIdea: (idea) => {
        const source = ideas.data?.find((row) => row.offeringId === idea.id);
        addTo(idea.id, idea.name, source?.reason ?? null);
      },
      addOffering: {
        options: offeringOptions,
        onPick: (key) => {
          const option = offeringOptions.find((row) => row.key === key);
          if (option) addTo(key, option.label);
        },
      },
    },
  };
}
