import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  OFFERING_SUGGESTIONS_KEYS,
  OFFERING_SUGGESTIONS_NS,
  OFFERING_SUGGESTIONS_TEST_IDS,
  ROW_FLOOR,
} from './offering-suggestions.constants.ts';
import type {
  SuggestionActivityLine,
  SuggestionActivityStatusTone,
  SuggestionPurchase,
} from './offering-suggestions.types.ts';

const KEYS = OFFERING_SUGGESTIONS_KEYS;

/**
 * Purchases on six tracks (H:2820); under 720px of card width three columns
 * — date · bought · invoice, then paid · sessions — Qty dropped and the
 * header hidden (H:418).
 */
const PURCHASE_GRID =
  'grid grid-cols-[64px_minmax(0,1fr)_32px_80px_minmax(0,120px)_max-content] items-center gap-2 px-3.5 [&>*]:min-w-0 @max-[720px]:grid-cols-[64px_minmax(0,1fr)_auto] @max-[720px]:gap-y-1 @max-[720px]:py-2';

/** Each purchase cell's place under 720px — literal classes for Tailwind. */
const PURCHASE_AT = {
  date: '@max-[720px]:col-start-1 @max-[720px]:row-start-1',
  bought: '@max-[720px]:col-start-2 @max-[720px]:row-start-1',
  qty: '@max-[720px]:hidden',
  paid: '@max-[720px]:col-start-3 @max-[720px]:row-start-1',
  sessions: '@max-[720px]:col-start-2 @max-[720px]:row-start-2',
  invoice:
    '@max-[720px]:col-start-3 @max-[720px]:row-start-2 @max-[720px]:justify-self-end',
} as const;

/**
 * Activity on four tracks (H:2824); under 720px three columns: when ·
 * channel, the message on its own line, then the status under it in the first
 * column — where the prototype's grid places it (H:419).
 */
const ACTIVITY_GRID =
  'grid grid-cols-[72px_92px_minmax(0,1fr)_96px] items-center gap-2 px-3.5 [&>*]:min-w-0 @max-[720px]:grid-cols-[64px_minmax(0,1fr)_auto] @max-[720px]:gap-y-0.5';

/** A message status's ink (H:4372): Read green, Not delivered red, Queued amber. */
const STATUS_INK: Readonly<Record<SuggestionActivityStatusTone, string>> = {
  success: 'text-success',
  danger: 'text-destructive',
  pending: TONE_CLASSES.butter.ink,
};

/** A table's 11px uppercase header row, hidden under 720px. */
const TABLE_HEAD =
  'border-border text-micro text-muted-foreground border-b py-1.25 font-semibold tracking-[0.05em] uppercase @max-[720px]:hidden';

/** A section's title line: "<title> · <summary>" (H:2819, H:2823). */
function SectionTitle({
  title,
  summary,
  action,
  className,
}: {
  title: string;
  summary: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 px-3.5 pt-2.5 pb-1', className)}>
      <span className="text-micro text-muted-foreground leading-[1.2] font-semibold tracking-[0.05em] uppercase">
        {title}
      </span>
      <span aria-hidden="true" className="text-micro text-disabled leading-[1.2]">
        ·
      </span>
      <span className="text-caption text-muted-foreground min-w-0 truncate leading-[1.2]">
        {summary}
      </span>
      {action ? (
        <>
          <span className="flex-1" />
          {action}
        </>
      ) : null}
    </div>
  );
}

/**
 * "<first>’s last purchases · <n> lines · <₹> paid so far" (H:2819–2821):
 * Date · Bought (category pill + name) · Qty · Paid · Sessions (a 64px bar,
 * "<n> of <n> used") · Invoice (its id, which opens it, and its status).
 */
export function PurchasesTable({
  firstName,
  purchases,
  paidSoFar,
}: {
  firstName: string;
  purchases: readonly SuggestionPurchase[];
  /** Everything the patient has paid, not only these lines (H:4371). */
  paidSoFar: number;
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const money = usePaiseFormat();
  const columns = KEYS.purchaseColumns;
  return (
    <section aria-label={t(KEYS.purchasesTitle, { first: firstName })}>
      <SectionTitle
        title={t(KEYS.purchasesTitle, { first: firstName })}
        summary={t(KEYS.purchasesSummary, {
          count: purchases.length,
          paid: money(paidSoFar),
        })}
      />
      <div aria-hidden="true" className={cn(PURCHASE_GRID, TABLE_HEAD)}>
        <span>{t(columns.date)}</span>
        <span>{t(columns.bought)}</span>
        <span>{t(columns.qty)}</span>
        <span className="text-end">{t(columns.paid)}</span>
        <span>{t(columns.sessions)}</span>
        <span>{t(columns.invoice)}</span>
      </div>
      {purchases.map((purchase) => (
        <div
          key={purchase.id}
          data-testid={OFFERING_SUGGESTIONS_TEST_IDS.purchase}
          className={cn(
            PURCHASE_GRID,
            ROW_FLOOR,
            'border-muted text-detail min-h-9 border-b py-1 leading-[1.2]',
          )}
        >
          <span
            className={cn(
              'text-muted-foreground-strong whitespace-nowrap tabular-nums',
              PURCHASE_AT.date,
            )}
          >
            {purchase.date}
          </span>
          <span className={cn('flex items-center gap-1.5', PURCHASE_AT.bought)}>
            <TonePill tone={purchase.category.tone} size="xs" className="text-micro h-5">
              {purchase.category.label}
            </TonePill>
            <span className="min-w-0 truncate font-medium">{purchase.name}</span>
          </span>
          <span className={cn('tabular-nums', PURCHASE_AT.qty)}>{purchase.qty}</span>
          <span className={cn('text-end font-semibold tabular-nums', PURCHASE_AT.paid)}>
            {money(purchase.paid)}
          </span>
          <span className={cn('flex items-center gap-1.5', PURCHASE_AT.sessions)}>
            {purchase.sessions ? (
              <>
                <span
                  aria-hidden="true"
                  data-slot="pill"
                  className="bg-muted-strong h-1 w-16 flex-none overflow-hidden rounded-full"
                >
                  <span
                    style={
                      {
                        '--used': `${Math.round((purchase.sessions.used / Math.max(1, purchase.sessions.total)) * 100)}%`,
                      } as CSSProperties
                    }
                    className="bg-success block h-full w-(--used)"
                  />
                </span>
                <span className="text-caption text-muted-foreground-strong leading-[1.2] whitespace-nowrap">
                  {t(KEYS.sessionsUsed, {
                    used: purchase.sessions.used,
                    total: purchase.sessions.total,
                  })}
                </span>
              </>
            ) : (
              <span className="text-caption text-disabled">—</span>
            )}
          </span>
          <span className={cn('inline-flex items-center gap-1.5', PURCHASE_AT.invoice)}>
            <button
              type="button"
              data-slot="pill"
              onClick={purchase.onOpenInvoice}
              disabled={!purchase.onOpenInvoice}
              className="border-border bg-muted text-foreground-soft hover:bg-muted-strong text-caption h-6 rounded-full border px-2 font-medium whitespace-nowrap transition-colors"
            >
              {purchase.invoice.label}
            </button>
            <TonePill tone={purchase.invoice.tone} size="xs" className="text-micro h-5">
              {purchase.invoice.status}
            </TonePill>
          </span>
        </div>
      ))}
    </section>
  );
}

/**
 * "Contact activity · <summary>" with "Open chat" (H:2823–2825): When ·
 * Channel (a 6px dot) · Message ("Sent" on lav / "Got" on sage) · Status.
 */
export function ActivityTable({
  summary,
  lines,
  onOpenChat,
}: {
  summary: string;
  lines: readonly SuggestionActivityLine[];
  onOpenChat?: () => void;
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const columns = KEYS.activityColumns;
  return (
    <section aria-label={t(KEYS.activityTitle)} className="border-border border-t">
      <SectionTitle
        title={t(KEYS.activityTitle)}
        summary={summary}
        action={
          onOpenChat ? (
            <button
              type="button"
              data-slot="button"
              onClick={onOpenChat}
              className="border-border bg-card hover:bg-muted h-6.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors"
            >
              {t(KEYS.openChat)}
            </button>
          ) : undefined
        }
      />
      <div aria-hidden="true" className={cn(ACTIVITY_GRID, TABLE_HEAD)}>
        <span>{t(columns.when)}</span>
        <span>{t(columns.channel)}</span>
        <span>{t(columns.message)}</span>
        <span>{t(columns.status)}</span>
      </div>
      {lines.map((line) => (
        <div
          key={line.id}
          data-testid={OFFERING_SUGGESTIONS_TEST_IDS.activity}
          className={cn(
            ACTIVITY_GRID,
            ROW_FLOOR,
            'border-muted text-detail min-h-8.5 border-b py-1 leading-[1.2]',
          )}
        >
          <span className="text-muted-foreground-strong whitespace-nowrap tabular-nums">
            {line.at}
          </span>
          <span className="inline-flex items-center gap-1.25 @max-[720px]:col-start-2 @max-[720px]:row-start-1">
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 flex-none rounded-full',
                TONE_CLASSES[line.channel.tone].dot,
              )}
            />
            <span className="truncate">{line.channel.label}</span>
          </span>
          <span className="flex items-center gap-1.5 @max-[720px]:col-span-full">
            <span
              className={cn(
                'text-tiny inline-flex h-4.5 flex-none items-center rounded-sm px-1.5 font-semibold whitespace-nowrap',
                line.direction === 'sent'
                  ? TONE_CLASSES.lav.surface
                  : TONE_CLASSES.sage.surface,
              )}
            >
              {t(line.direction === 'sent' ? KEYS.sent : KEYS.got)}
            </span>
            <span className="text-foreground-soft min-w-0 truncate" title={line.text}>
              {line.text}
            </span>
          </span>
          <span
            className={cn(
              'text-caption leading-[1.2] whitespace-nowrap @max-[720px]:col-start-1 @max-[720px]:row-start-3',
              line.statusTone ? STATUS_INK[line.statusTone] : 'text-muted-foreground',
            )}
          >
            {line.status}
          </span>
        </div>
      ))}
    </section>
  );
}
