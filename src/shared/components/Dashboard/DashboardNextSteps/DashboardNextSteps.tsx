import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  DASHBOARD_KEYS,
  DASHBOARD_NS,
} from '@/shared/components/Dashboard/dashboard.constants.ts';
import { buildDashboardQuickActions } from '@/shared/components/Dashboard/dashboard-quick-actions.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import type { MeContext } from '@/shared/tenancy/me-context.ts';

type DashboardNextStepsProps = {
  ctx: MeContext;
  className?: string;
  limit?: number;
};

/**
 * Priority action row — surfaces the top few destinations without a card grid.
 */
export function DashboardNextSteps({
  ctx,
  className,
  limit = 3,
}: DashboardNextStepsProps) {
  const { t } = useTranslation(DASHBOARD_NS);
  const actions = buildDashboardQuickActions(ctx, t).slice(0, limit);

  if (actions.length === 0) return null;

  return (
    <section
      aria-label={t(DASHBOARD_KEYS.nextSteps.ariaLabel)}
      data-testid="dashboard-next-steps"
      className={cn('flex flex-col gap-2', className)}
    >
      <h2 className="text-foreground text-sm font-semibold">
        {t(DASHBOARD_KEYS.nextSteps.heading)}
      </h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const stepTestId = action.testId.replace('dashboard-action', 'dashboard-next');
          return (
            <Button
              key={stepTestId}
              variant="secondary"
              size="sm"
              className="h-9 gap-2 rounded-full px-4"
              asChild
            >
              <a href={action.href} data-testid={stepTestId}>
                <action.icon className="size-4 shrink-0" aria-hidden="true" />
                {action.title}
              </a>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
