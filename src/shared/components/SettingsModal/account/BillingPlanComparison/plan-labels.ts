import type { TFunction } from 'i18next';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';
import type { PillTone } from '@/shared/components/Cells/TonePill/index.ts';
import { SETTINGS_KEYS } from '@/shared/components/SettingsModal/settings.constants.ts';

import { BILLING_PLAN_KEYS } from './billing-plan.constants.ts';
import {
  planAudience,
  type PlanChangeKind,
  type PlanHighlight,
} from './plan-comparison.ts';

const PLAN_KEYS = BILLING_PLAN_KEYS.plan;
const CONFIRM_KEYS = BILLING_PLAN_KEYS.confirm;
const BILLING_KEYS = SETTINGS_KEYS.panels.billing;

/** The two number and date formatters the labels need, from `useLocaleFormat`. */
export interface PlanLabelFormat {
  formatNumber: (value: number) => string;
  formatDate: (iso: string) => string;
}

/** The tagline: the plan's own description, else who it is for from its seats (`app` copy). */
export function planTagline({
  plan,
  t,
  format,
}: {
  plan: Pick<BillingPlan, 'description' | 'seatLimit'>;
  t: TFunction;
  format: PlanLabelFormat;
}): string {
  if (plan.description) return plan.description;
  const audience = planAudience(plan.seatLimit);
  if (audience.kind === 'solo') return t(PLAN_KEYS.audienceSolo);
  if (audience.kind === 'any') return t(PLAN_KEYS.audienceAny);
  return t(PLAN_KEYS.audienceTeam, { seats: format.formatNumber(audience.seats) });
}

/** "1 seat", "Up to 5 seats", "Unlimited seats" (`app` copy). */
function seatsLabel(seats: number | null, t: TFunction, format: PlanLabelFormat): string {
  if (seats === null) return t(PLAN_KEYS.seatsUnlimited);
  if (seats <= 1) return t(PLAN_KEYS.seatsOne);
  return t(PLAN_KEYS.seatsUpTo, { seats: format.formatNumber(seats) });
}

/** A billing date — a renewal, the day a plan ends — is a day: "14 Nov 2026", never a time. */
export const PLAN_DATE: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/** One checklist line: the seats, or a capability's name (with its value when it has one). */
export function highlightLabel(
  highlight: PlanHighlight,
  t: TFunction,
  format: PlanLabelFormat,
): string {
  if (highlight.kind === 'seats') return seatsLabel(highlight.seats, t, format);
  const label = t(highlight.feature.label);
  if (highlight.value.kind !== 'value') return label;
  const { value } = highlight.value;
  return `${label} · ${typeof value === 'number' ? format.formatNumber(value) : value}`;
}

/** A subscription status's pill tone: running sage, payment trouble blush, else plain. */
export function subscriptionStatusTone(status: BillingSubscription['status']): PillTone {
  if (status === 'active' || status === 'trialing') return 'sage';
  if (status === 'incomplete' || status === 'past_due' || status === 'unpaid') {
    return 'blush';
  }
  return 'neutral';
}

/**
 * The confirm's title, which its button repeats: "Choose <plan>" with no plan at all, "Upgrade
 * to <plan>" for a dearer one (Free included as the start), else "Switch to <plan>".
 */
export function planChangeTitle({
  target,
  current,
  upgrade,
  tPlan,
  tSettings,
}: {
  target: BillingPlan;
  current: BillingPlan | null;
  upgrade: boolean;
  tPlan: TFunction;
  tSettings: TFunction;
}): string {
  if (!current) return tSettings(BILLING_KEYS.choose, { name: target.name });
  if (upgrade) return tPlan(BILLING_PLAN_KEYS.upgradeTo, { name: target.name });
  return tSettings(BILLING_KEYS.switchTo, { name: target.name });
}

/**
 * When the move takes effect, as clinozy-be does it: Free at the end of the paid period; a first
 * plan right away (a card to confirm next when payments are on); a change right away, prorated on
 * the next invoice when the subscription is billed through the provider.
 */
export function planChangeWhen({
  kind,
  currentName,
  endDate,
  billedThroughProvider,
  paymentsEnabled,
  t,
}: {
  kind: PlanChangeKind;
  currentName: string;
  endDate: string;
  billedThroughProvider: boolean;
  paymentsEnabled: boolean;
  t: TFunction;
}): string {
  if (kind === 'toFree')
    return t(CONFIRM_KEYS.whenFree, { name: currentName, date: endDate });
  if (kind === 'first') {
    return t(paymentsEnabled ? CONFIRM_KEYS.whenFirstPayment : CONFIRM_KEYS.whenFirst);
  }
  return t(
    billedThroughProvider && paymentsEnabled
      ? CONFIRM_KEYS.whenProrated
      : CONFIRM_KEYS.whenNow,
  );
}
