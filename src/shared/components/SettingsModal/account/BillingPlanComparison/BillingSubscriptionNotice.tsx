import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { BillingSubscription } from '@/shared/api/billing-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useResumeSubscription } from '@/shared/hooks/useSubscription/index.ts';
import { Calendar, TriangleAlert } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import {
  type SubscriptionNoticeKind,
  subscriptionNoticeKind,
} from './plan-comparison.ts';
import { PLAN_DATE } from './plan-labels.ts';

const NOTICE_KEYS = BILLING_PLAN_KEYS.notice;

/** A payment that failed or has not gone through reads as a warning; dates read plainly. */
const NEEDS_ACTION: ReadonlySet<SubscriptionNoticeKind> = new Set([
  'pastDue',
  'incomplete',
]);

/** Props of {@link BillingSubscriptionNotice}. */
export interface BillingSubscriptionNoticeProps {
  subscription: BillingSubscription | null;
  /** The plan's name, for "Update your payment method to keep <plan>." */
  planName: string;
  /** "Resubscribe" is a billing manager's act; a member reads the notice alone. */
  canManage: boolean;
}

/**
 * The subscription's state in one line under the plan, the way Claude's billing page states it:
 * "Your plan renews on <day>.", "Your subscription will be canceled on <day>." with "Resubscribe"
 * beside it (the resume route), a trial's end, or a payment that needs attention. Nothing on Free.
 */
export function BillingSubscriptionNotice({
  subscription,
  planName,
  canManage,
}: BillingSubscriptionNoticeProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const { formatDate } = useLocaleFormat();
  const resume = useResumeSubscription();
  const kind = subscriptionNoticeKind(subscription);
  if (!subscription || !kind) return null;

  const day = (iso: string) => formatDate(iso, PLAN_DATE);
  const lines: Record<SubscriptionNoticeKind, string> = {
    renews: t(NOTICE_KEYS.renews, { date: day(subscription.currentPeriodEnd) }),
    ends: t(NOTICE_KEYS.ends, { date: day(subscription.currentPeriodEnd) }),
    trial: t(NOTICE_KEYS.trialEnds, {
      date: day(subscription.trialEnd ?? subscription.currentPeriodEnd),
    }),
    pastDue: t(NOTICE_KEYS.pastDue, { name: planName }),
    incomplete: t(NOTICE_KEYS.incomplete),
  };
  const warning = NEEDS_ACTION.has(kind);
  const Icon = warning ? TriangleAlert : Calendar;

  return (
    <div
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2.5',
        warning ? TONE_CLASSES.butter.surface : 'bg-muted/40',
      )}
      data-testid="billing-notice"
      data-kind={kind}
    >
      <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
      <p className="text-detail min-w-0 flex-1 text-pretty">{lines[kind]}</p>
      {kind === 'ends' && canManage ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          isLoading={resume.isPending}
          onClick={() => resume.mutate(subscription.id)}
          data-testid="billing-resubscribe"
        >
          {t(NOTICE_KEYS.resubscribe)}
        </Button>
      ) : null}
    </div>
  );
}
