import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BillingSubscription } from '@/shared/api/billing-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  useCancelSubscription,
  useResumeSubscription,
} from '@/shared/hooks/useSubscription/index.ts';

interface BillingCancellationSectionProps {
  subscription: BillingSubscription;
  canManage: boolean;
}

/** Cancel or resume subscription — shown last on the billing panel. */
export function BillingCancellationSection({
  subscription,
  canManage,
}: BillingCancellationSectionProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const keys = SETTINGS_KEYS.panels.billing.cancellation;
  const { formatDate } = useLocaleFormat();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  // Controlled, because the confirm has to outlive the click that fired it.
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canManage) return null;

  const periodEnd = formatDate(subscription.currentPeriodEnd);

  return (
    <SettingsCard
      data-testid="billing-cancellation-card"
      title={t(keys.title)}
      description={t(subscription.cancelAtPeriodEnd ? keys.endsOn : keys.cancelAnytime, {
        date: periodEnd,
      })}
    >
      <div>
        {subscription.cancelAtPeriodEnd ? (
          <Button
            size="sm"
            variant="outline"
            isLoading={resumeSubscription.isPending}
            onClick={() => resumeSubscription.mutate(subscription.id)}
            data-testid="billing-resume"
          >
            {resumeSubscription.isPending ? t(keys.resuming) : t(keys.resume)}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={
                cancelSubscription.isPending || subscription.status === 'incomplete'
              }
              onClick={() => setConfirmOpen(true)}
              data-testid="billing-cancel"
            >
              {t(keys.cancelAction)}
            </Button>
            {/* Held open until the request resolves, so a failure lands on the
                confirm that caused it and the button cannot be pressed twice on
                the way out (SET-14); Esc and the overlay wait for it too. */}
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={t(keys.confirmTitle)}
              description={t(keys.confirmDescription, { date: periodEnd })}
              cancelLabel={t(keys.keep)}
              confirmLabel={t(keys.confirm)}
              destructive
              onConfirm={async () => {
                await cancelSubscription.mutateAsync(subscription.id);
              }}
              testIds={{
                dialog: 'billing-cancel-dialog',
                accept: 'billing-cancel-confirm',
              }}
            />
          </>
        )}
      </div>
    </SettingsCard>
  );
}
