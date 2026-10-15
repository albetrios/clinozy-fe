import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { BillingPlan } from '@/shared/api/billing-contracts.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Check, Minus } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import {
  comparisonSections,
  type PlanComparisonRow,
  readPlanFeature,
  wholeAmountOptions,
  yearlySavingsPercent,
} from './plan-comparison.ts';

const PLAN_KEYS = BILLING_PLAN_KEYS.plan;
const COMPARE_KEYS = BILLING_PLAN_KEYS.compare;

/**
 * The row-name column: held at the inline start while the plans scroll sideways,
 * with a hairline at its inline end (a pseudo-element — a collapsed table's own
 * border would stay behind when the cell sticks).
 */
const ROW_HEAD =
  'bg-card after:bg-border sticky start-0 z-10 w-40 px-3 py-2.5 text-start align-top font-normal after:absolute after:inset-y-0 after:end-0 after:w-px';
const CELL = 'px-3 py-2.5 align-top';
/**
 * The head row, held at the picker's top once the table no longer scrolls sideways. The picker's
 * scroll box has no padding of its own (it would inset where the row may rest), so the row
 * sits flush with its edge, no strip of rows showing above it.
 */
const STICKY_HEAD =
  '@3xl:sticky @3xl:top-0 @3xl:z-20 @3xl:shadow-[0_1px_0_var(--color-border)]';

/** A tick or a dash, each with its word for assistive tech. */
function Mark({ included, label }: { included: boolean; label: string }) {
  const Icon = included ? Check : Minus;
  return (
    <>
      <Icon
        aria-hidden
        className={cn('size-4', included ? 'text-success' : 'text-muted-foreground')}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

function rowLabels(row: PlanComparisonRow): { label: string; hint: string } {
  switch (row.kind) {
    case 'monthly':
      return { label: COMPARE_KEYS.rows.monthly, hint: COMPARE_KEYS.rows.monthlyHint };
    case 'yearly':
      return { label: COMPARE_KEYS.rows.yearly, hint: COMPARE_KEYS.rows.yearlyHint };
    case 'seats':
      return { label: COMPARE_KEYS.rows.seats, hint: COMPARE_KEYS.rows.seatsHint };
    case 'feature':
      return { label: row.feature.label, hint: row.feature.hint };
  }
}

/** Props of {@link BillingPlanTable}. */
export interface BillingPlanTableProps {
  /** Plans cheapest first, one column each. */
  plans: readonly BillingPlan[];
  currentPlanId: string | null;
}

/**
 * Every plan side by side, as the detail under the cards — claude.com's "Compare features across
 * plans": one column per plan (the current one marked and tinted), rows grouped as pricing, team
 * and features, each row named with a one-line explanation. A real table — the plans are column
 * headers, the rows row headers. Where the picker is wide enough for the whole table (`@3xl`), its
 * head row stays in view while the picker scrolls; narrower, it scrolls sideways with the row
 * names held in place (a box that scrolls sideways cannot also let its head stick to the page).
 */
export function BillingPlanTable({ plans, currentPlanId }: BillingPlanTableProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const { formatCurrency, formatNumber } = useLocaleFormat();
  const sections = comparisonSections(plans);

  function cell(row: PlanComparisonRow, plan: BillingPlan): ReactNode {
    switch (row.kind) {
      case 'monthly':
        return formatCurrency(
          plan.priceMonthly,
          plan.currency,
          wholeAmountOptions(plan.priceMonthly),
        );
      case 'yearly': {
        if (plan.priceYearly === null) {
          return <Mark included={false} label={t(COMPARE_KEYS.notOffered)} />;
        }
        const savings = yearlySavingsPercent(plan);
        return (
          <span className="flex flex-col gap-0.5">
            <span>
              {formatCurrency(
                plan.priceYearly,
                plan.currency,
                wholeAmountOptions(plan.priceYearly),
              )}
            </span>
            {savings === null ? null : (
              <span className="text-success text-xs">
                {t(PLAN_KEYS.save, { percent: savings })}
              </span>
            )}
          </span>
        );
      }
      case 'seats':
        return plan.seatLimit === null
          ? t(COMPARE_KEYS.unlimited)
          : formatNumber(plan.seatLimit);
      case 'feature': {
        const value = readPlanFeature(plan.features, row.feature.key);
        if (value.kind === 'value') {
          return typeof value.value === 'number'
            ? formatNumber(value.value)
            : value.value;
        }
        const included = value.kind === 'included';
        return (
          <Mark
            included={included}
            label={t(included ? COMPARE_KEYS.included : COMPARE_KEYS.notIncluded)}
          />
        );
      }
    }
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border @3xl:overflow-visible"
      data-testid="plan-compare-table"
    >
      <table className="text-detail w-full min-w-[34rem] table-fixed border-collapse tabular-nums">
        <caption className="sr-only">{t(COMPARE_KEYS.caption)}</caption>
        <thead>
          <tr>
            <td className={cn(ROW_HEAD, STICKY_HEAD, 'py-3')} />
            {plans.map((plan) => {
              const current = plan.id === currentPlanId;
              return (
                <th
                  key={plan.id}
                  scope="col"
                  data-current={current || undefined}
                  className={cn(
                    CELL,
                    STICKY_HEAD,
                    'py-3 text-start font-semibold',
                    current ? 'bg-muted' : 'bg-card',
                  )}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span dir="auto">{plan.name}</span>
                    {current ? (
                      <TonePill tone="neutral" size="xs">
                        {t(COMPARE_KEYS.current)}
                      </TonePill>
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.id}>
              <tr className="bg-muted/40 border-t">
                <th
                  scope="colgroup"
                  colSpan={plans.length + 1}
                  className="text-muted-foreground-strong px-3 py-1.5 text-start text-xs font-medium tracking-wide uppercase"
                >
                  <span className="sticky start-3">
                    {t(COMPARE_KEYS.groups[section.id])}
                  </span>
                </th>
              </tr>
              {section.rows.map((row) => {
                const labels = rowLabels(row);
                return (
                  <tr
                    key={row.kind === 'feature' ? row.feature.key : row.kind}
                    className="border-t"
                  >
                    <th scope="row" className={ROW_HEAD}>
                      <span className="text-foreground block font-medium">
                        {t(labels.label)}
                      </span>
                      <span className="text-muted-foreground block text-xs leading-[1.45]">
                        {t(labels.hint)}
                      </span>
                    </th>
                    {plans.map((plan) => (
                      <td
                        key={plan.id}
                        className={cn(CELL, plan.id === currentPlanId && 'bg-muted/50')}
                      >
                        {cell(row, plan)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
