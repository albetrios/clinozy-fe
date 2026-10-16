import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  BillingCycle,
  BillingPlan,
  BillingSubscription,
} from '@/shared/api/billing-contracts.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import { BillingPlanComparison } from './BillingPlanComparison.tsx';

const PICKER_KEYS = BILLING_PLAN_KEYS.picker;

/** The picker's width: Settings' own, so it covers the panel it opened from. */
const PICKER_WIDTH = 1040;

/** Props of {@link BillingPlanPicker}. */
export interface BillingPlanPickerProps {
  open: boolean;
  onClose: () => void;
  plans: readonly BillingPlan[];
  subscription: BillingSubscription | null;
  canManage: boolean;
  billingCycle: BillingCycle;
  /** The Monthly · Yearly switch, when this workspace may still pick a cycle. */
  cycleSwitch?: ReactNode;
  pendingPlanId: string | null;
  onChoose: (planId: string) => void;
}

/**
 * The plan picker: every plan side by side with its features, and the comparison under them — a
 * drawer stacked on Settings at Settings' own width ("Back" returns to Billing), full screen on a
 * phone. No URL: Settings stays the `#settings/*` hash modal, as its other child drawers do.
 */
export function BillingPlanPicker({
  open,
  onClose,
  plans,
  subscription,
  canManage,
  billingCycle,
  cycleSwitch,
  pendingPlanId,
  onChoose,
}: BillingPlanPickerProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(PICKER_KEYS.title)}
      sub={t(PICKER_KEYS.sub)}
      width={PICKER_WIDTH}
      stacked
      hideFooter
      // The padding moves onto the content: on the scroll box it would hold the feature
      // table's pinned head one padding below the drawer's edge.
      flushBody
      dismissTestId="billing-plan-picker-close"
      testId="billing-plan-picker"
    >
      <div className="flex flex-col gap-6 p-(--drawer-body-pad)">
        {cycleSwitch ? <div className="flex justify-center">{cycleSwitch}</div> : null}
        <BillingPlanComparison
          plans={plans}
          subscription={subscription}
          canManage={canManage}
          billingCycle={billingCycle}
          pendingPlanId={pendingPlanId}
          onChoose={onChoose}
        />
      </div>
    </RecordDrawer>
  );
}
