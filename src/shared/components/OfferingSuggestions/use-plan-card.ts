import { useTranslation } from 'react-i18next';

import type { Channel, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type {
  PatientPlan,
  PlanActivity,
  PlanIdea,
  PlanIdeaReason,
  PlanPurchase,
  PlanSuggestion,
} from '@/shared/api/clinic/plan-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  INVOICE_STATUS_TONES,
  OFFERING_CATEGORY_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  useAddSuggestion,
  usePlan,
  useRemoveSuggestion,
  useRestoreSuggestion,
  useUpdateSuggestion,
} from '@/shared/hooks/usePlan/index.ts';
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
  SuggestionPurchase,
} from './offering-suggestions.types.ts';
import type { OfferingSuggestionsProps } from './OfferingSuggestions.tsx';

const KEYS = OFFERING_SUGGESTIONS_KEYS;

type Translate = ReturnType<typeof useTranslation>['t'];

/** A channel's tone in "Contact activity" (H:4371): WhatsApp sage, Instagram blush, a call sky. */
const CHANNEL_TONES: Readonly<Record<Channel, Tone>> = {
  whatsapp: 'sage',
  instagram: 'blush',
  call: 'sky',
  sms: 'lav',
  email: 'stone',
  note: 'butter',
};

/** What the host says about where the card sits. */
export interface PlanCardHost {
  /** The patient whose plan it is; empty while there is none — the card reads nothing. */
  patientId: string;
  firstName: string;
  /** Where a suggestion added here is made ("Appt #2861 · Hydrafacial", "Patient file"). */
  sourceLabel: string;
  /** The visit a suggestion added here is for; `null` in the patient file. */
  appointmentId: string | null;
  /** The host's Edit — the appointment's in the form, the patient's in the file. */
  canEdit: boolean;
  /** "Open chat" in "Contact activity" — the host opens the person's thread. */
  onOpenChat?: (leadId: string) => void;
}

/** The card's data-bound props, everything but where it sits and its price eye. */
export type PlanCardProps = Omit<
  OfferingSuggestionsProps,
  'variant' | 'pricesShown' | 'onPricesShownChange' | 'open' | 'onOpenChange'
>;

/** {@link usePlanCard}'s answer: the plan as the card shows it, and its load state. */
export interface PlanCard {
  status: 'pending' | 'error' | 'ready';
  retry: () => void;
  /** The plan itself — the form's plan flag counts it. */
  plan: PatientPlan | undefined;
  props: PlanCardProps | null;
}

/** A suggestion's sessions or visits (H:4344): "7 sessions", "2 visits", "1 session". */
function sessionsText(t: Translate, sessions: number, qty: number): string {
  if (sessions > 1) return t(KEYS.info.sessions, { count: sessions * qty });
  if (qty > 1) return t(KEYS.info.visits, { count: qty });
  return t(KEYS.info.sessions, { count: 1 });
}

/** Why an idea is offered, in words (H:4357–4366). */
export function ideaReasonText(t: Translate, reason: PlanIdeaReason): string {
  switch (reason.kind) {
    case 'note':
      return t(KEYS.ideaReasons.note, { text: reason.text });
    case 'complaint':
      return t(KEYS.ideaReasons.complaint, { text: reason.text });
    case 'visits':
      return t(KEYS.ideaReasons.visits, { count: reason.count });
    case 'renew':
      return t(KEYS.ideaReasons.renew);
    case 'first':
      return t(KEYS.ideaReasons.first);
  }
}

interface Formatters {
  t: Translate;
  money: (paise: number) => string;
  day: (date: string) => string;
  instant: (at: string) => string;
  canFloor: boolean;
}

function lineOf(row: PlanSuggestion, f: Formatters): SuggestionLine {
  const { t, money } = f;
  const category = row.category
    ? t(CLINIC_KEYS.offerings.categories[row.category], { ns: CLINIC_NS })
    : '';
  const list = row.listPrice * row.qty;
  const floor = row.floorPrice === null ? null : row.floorPrice * row.qty;
  const priceText =
    floor !== null && floor < list && f.canFloor
      ? `${t(KEYS.info.list, { price: money(list) })} · ${t(KEYS.info.lowest, { price: money(floor) })}`
      : t(KEYS.info.list, { price: money(list) });
  return {
    id: row.id,
    name: row.name ?? t(KEYS.offeringRemoved),
    tone: row.category ? OFFERING_CATEGORY_TONES[row.category] : row.tone,
    info: [category, sessionsText(t, row.sessions, row.qty), priceText, row.reason]
      .filter(Boolean)
      .join(' · '),
    qty: row.qty,
    price: row.price,
    listPrice: row.listPrice,
    floorPrice: row.floorPrice,
    status: row.status,
    invoicedQty: row.invoicedQty,
    invoicedAmount: row.invoicedAmount,
    by: {
      initials: row.suggestedBy?.initials ?? '?',
      tone: row.suggestedBy?.tone ?? 'stone',
      label: [row.suggestedBy?.name, f.instant(row.createdAt), row.sourceLabel]
        .filter(Boolean)
        .join(' · '),
    },
  };
}

function ideaOf(idea: PlanIdea, f: Formatters): SuggestionIdea {
  const { t } = f;
  return {
    id: idea.offeringId,
    name: idea.name,
    tone: OFFERING_CATEGORY_TONES[idea.category],
    info: [
      t(KEYS.ideaReasons.history),
      ideaReasonText(t, idea.reason),
      t(CLINIC_KEYS.offerings.categories[idea.category], { ns: CLINIC_NS }),
      idea.sessions > 1 ? t(KEYS.info.sessions, { count: idea.sessions }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    listPrice: idea.listPrice,
  };
}

function purchaseOf(line: PlanPurchase, f: Formatters): SuggestionPurchase {
  const { t } = f;
  let category = { label: t(KEYS.purchaseKinds.item), tone: 'stone' as Tone };
  if (line.category) {
    category = {
      label: t(CLINIC_KEYS.offerings.categories[line.category], { ns: CLINIC_NS }),
      tone: OFFERING_CATEGORY_TONES[line.category],
    };
  } else if (line.invoiceType === 'medical') {
    category = { label: t(KEYS.purchaseKinds.medicine), tone: 'blush' };
  }
  return {
    id: line.id,
    date: f.day(line.date),
    category,
    name: line.name,
    qty: line.qty,
    paid: line.amount,
    sessions: line.sessions,
    invoice: {
      label: `#${line.invoiceSeq}`,
      status: t(CLINIC_KEYS.invoiceStatuses[line.invoiceStatus], { ns: CLINIC_NS }),
      tone: INVOICE_STATUS_TONES[line.invoiceStatus],
    },
  };
}

/** A message's status word and colour (H:4372). */
function activityStatus(
  line: PlanActivity,
  t: Translate,
): { status: string; statusTone?: SuggestionActivityStatusTone } {
  if (line.direction === 'got') return { status: t(KEYS.delivery.received) };
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

function activityOf(line: PlanActivity, f: Formatters): SuggestionActivityLine {
  return {
    id: line.id,
    at: f.instant(line.at),
    channel: {
      label: f.t(CLINIC_KEYS.channels[line.channel], { ns: CLINIC_NS }),
      tone: CHANNEL_TONES[line.channel],
    },
    direction: line.direction,
    text: line.text,
    ...activityStatus(line, f.t),
  };
}

/**
 * A patient's plan bound to the Offering suggestions card (`getPlan`,
 * `S:1635`) — the appointment form's and the patient file's: the lines,
 * ideas, last purchases and contact activity in the member's words and money,
 * the "Add offering" list, and the writes behind every control — optimistic
 * edits, "+ Add" and "Add offering" ("<name> added to <first>’s
 * suggestions"), and Remove with a 10s Undo.
 */
export function usePlanCard(host: PlanCardHost): PlanCard {
  const { t } = useTranslation([OFFERING_SUGGESTIONS_NS, CLINIC_NS]);
  const money = usePaiseFormat();
  const { formatDate } = useLocaleFormat();
  const access = useClinicAccess();
  // No patient yet (a lead's booking, a New form): nothing to read.
  const plan = usePlan(host.patientId || null);
  const offerings = useOfferings();
  const update = useUpdateSuggestion();
  const add = useAddSuggestion();
  const remove = useRemoveSuggestion();
  const restore = useRestoreSuggestion();

  const f: Formatters = {
    t,
    money,
    day: (date) =>
      formatDate(
        localDateOf(date),
        { day: 'numeric', month: 'short' },
        { civilDay: true },
      ),
    instant: (at) =>
      formatDate(at, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    canFloor: access.canAbility('floor'),
  };

  const data = plan.data;
  let status: PlanCard['status'] = 'ready';
  if (plan.isPending) status = 'pending';
  else if (plan.isError) status = 'error';
  if (!data) {
    return { status, retry: () => void plan.refetch(), plan: undefined, props: null };
  }

  const suggested = new Set(
    data.suggestions
      .filter((row) => row.status !== 'declined')
      .map((row) => row.offeringId),
  );
  const addTo = (offeringId: string, name: string, reason: string | null = null) => {
    add.mutate(
      {
        patientId: host.patientId,
        offeringId,
        appointmentId: host.appointmentId,
        sourceLabel: host.sourceLabel,
        reason,
      },
      { onSuccess: () => notify.success(t(KEYS.added, { name, first: host.firstName })) },
    );
  };
  const offeringOptions: PickerOption[] = (offerings.data ?? [])
    .filter((offering) => offering.active)
    .map((offering) => ({
      key: offering.id,
      label: offering.name,
      sub: [
        offering.sessions > 1
          ? t(KEYS.info.sessions, { count: offering.sessions })
          : t(KEYS.single),
        offering.minPrice > 0 && offering.minPrice < offering.price
          ? t(KEYS.minPrice, { price: money(offering.minPrice) })
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      meta: money(offering.price),
      group: t(CLINIC_KEYS.offerings.categories[offering.category], { ns: CLINIC_NS }),
      tone: OFFERING_CATEGORY_TONES[offering.category],
      disabled: suggested.has(offering.id),
    }));
  const lead = data.lead;

  return {
    status,
    retry: () => void plan.refetch(),
    plan: data,
    props: {
      firstName: host.firstName,
      lines: data.suggestions.map((row) => lineOf(row, f)),
      ideas: data.ideas.map((idea) => ideaOf(idea, f)),
      purchases: {
        lines: data.purchases.map((line) => purchaseOf(line, f)),
        paidSoFar: data.paidSoFar,
      },
      activity: lead
        ? {
            summary: [
              t(KEYS.activityLead, { id: `#${lead.seq}` }),
              lead.status
                ? t(CLINIC_KEYS.leads.statuses[lead.status], { ns: CLINIC_NS })
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
            lines: data.activity.map((line) => activityOf(line, f)),
            onOpenChat: host.onOpenChat ? () => host.onOpenChat?.(lead.id) : undefined,
          }
        : undefined,
      canEdit: host.canEdit,
      canDiscount: f.canFloor,
      onChange: (line, patch) =>
        update.mutate({ id: line.id, patientId: host.patientId, patch }),
      onRemove: async (line, choice) => {
        await remove.mutateAsync({
          id: line.id,
          reason: choice.reason,
          note: choice.note,
        });
        notify.undo(t(KEYS.removed, { name: line.name }), {
          onUndo: () => restore.mutate(line.id),
        });
      },
      onAddIdea: (idea) => {
        const source = data.ideas.find((row) => row.offeringId === idea.id);
        addTo(idea.id, idea.name, source ? ideaReasonText(t, source.reason) : null);
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
